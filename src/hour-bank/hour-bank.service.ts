import { AuthUser } from '@/auth/decorators';
import { isValidDate, localDate } from '@/common/time';
import { PrismaService } from '@/infra/database/prisma.service';
import { EnvService } from '@/infra/env/env.service';
import {
  EmployeeWithSchedule,
  PunchesService,
} from '@/punches/punches.service';
import { TimesheetDay } from '@/punches/timesheet';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HourBankEntry } from '@prisma/client';
import { CreateHourBankEntryDto, HourBankQueryDto } from './hour-bank.dto';
import { emptyMovement, Movement, runLedger } from './ledger';

/**
 * Banco de horas: saldo acumulado desde o cadastro do funcionário.
 * Saldo = extras de dias úteis − falta de horas − folgas de banco + ajustes manuais
 * + sábado usado para pagar horas negativas (×1,5). O resto do sábado (50%) e as extras
 * de domingo e feriado (100%) vão para a folha de pagamento. Regras em ./ledger.
 * Dias incompletos ficam de fora até serem corrigidos (como no espelho).
 */
@Injectable()
export class HourBankService {
  private readonly tz: string;

  constructor(
    private prisma: PrismaService,
    private punches: PunchesService,
    env: EnvService,
  ) {
    this.tz = env.get('APP_TIMEZONE');
  }

  async statement(actor: AuthUser, query: HourBankQueryDto) {
    const employeeId = this.resolveEmployeeId(actor, query.employeeId);
    const until = query.until ?? localDate(new Date(), this.tz);
    if (!isValidDate(until)) {
      throw new BadRequestException('until não é uma data válida');
    }

    const employee = await this.prisma.user.findUnique({
      where: { id: employeeId },
      include: { workSchedule: true },
    });
    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    const since = localDate(employee.createdAt, this.tz);
    const [daysByEmployee, entries] = await Promise.all([
      since <= until
        ? this.punches.computeDays([employee], since, until)
        : new Map<string, TimesheetDay[]>(),
      this.prisma.hourBankEntry.findMany({
        where: { userId: employeeId, date: { lte: until } },
        include: { createdBy: { select: { name: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const days = daysByEmployee.get(employeeId) ?? [];
    const active = entries.filter((e) => !e.canceledAt);

    // Extrato mês a mês, em ordem cronológica, com o acumulado
    const { byMonth } = runLedger(days, active);
    const pendingByMonth = new Map<string, number>();
    for (const day of days) {
      if (day.status !== 'incomplete') continue;
      const month = day.date.slice(0, 7);
      pendingByMonth.set(month, (pendingByMonth.get(month) ?? 0) + 1);
    }

    let accumulated = 0;
    const months = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, m]) => {
        accumulated += m.balanceMinutes;
        return {
          month,
          ...m,
          pendingDays: pendingByMonth.get(month) ?? 0,
          accumulatedMinutes: accumulated,
        };
      });

    const totals = months.reduce<Movement>((t, m) => {
      t.overtimeMinutes += m.overtimeMinutes;
      t.deficitMinutes += m.deficitMinutes;
      t.compensatedMinutes += m.compensatedMinutes;
      t.adjustmentMinutes += m.adjustmentMinutes;
      t.saturdayCreditMinutes += m.saturdayCreditMinutes;
      t.payroll50Minutes += m.payroll50Minutes;
      t.payroll100Minutes += m.payroll100Minutes;
      t.balanceMinutes += m.balanceMinutes;
      return t;
    }, emptyMovement());

    return {
      employee: { id: employee.id, name: employee.name },
      since,
      until,
      totals,
      pendingDays: months.reduce((sum, m) => sum + m.pendingDays, 0),
      months,
      entries: entries.map((e) => this.toResponse(e, e.createdBy.name)),
    };
  }

  /** Saldo de cada funcionário até a data (coluna do relatório). */
  async balances(employees: EmployeeWithSchedule[], until: string) {
    const result = new Map<string, number>();
    if (!employees.length) return result;
    const since = employees
      .map((e) => localDate(e.createdAt, this.tz))
      .reduce((a, b) => (a < b ? a : b));
    const ids = employees.map((e) => e.id);
    const [daysByEmployee, entries] = await Promise.all([
      since <= until
        ? this.punches.computeDays(employees, since, until)
        : new Map<string, TimesheetDay[]>(),
      this.prisma.hourBankEntry.findMany({
        where: { userId: { in: ids }, date: { lte: until }, canceledAt: null },
        select: { userId: true, date: true, minutes: true },
      }),
    ]);
    for (const id of ids) {
      const { balance } = runLedger(
        daysByEmployee.get(id) ?? [],
        entries.filter((e) => e.userId === id),
      );
      result.set(id, balance);
    }
    return result;
  }

  /** Ajuste manual por um administrador, com justificativa. */
  async createEntry(actor: AuthUser, dto: CreateHourBankEntryDto) {
    this.assertNotSelf(actor, dto.employeeId);
    if (!isValidDate(dto.date)) {
      throw new BadRequestException('date não é uma data válida');
    }
    const employee = await this.prisma.user.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    const entry = await this.prisma.hourBankEntry.create({
      data: {
        userId: dto.employeeId,
        date: dto.date,
        minutes: dto.minutes,
        reason: dto.reason.trim(),
        createdById: actor.id,
      },
      include: { createdBy: { select: { name: true } } },
    });
    return this.toResponse(entry, entry.createdBy.name);
  }

  /** Cancela sem apagar: o ajuste continua no extrato. */
  async cancelEntry(actor: AuthUser, id: string) {
    const entry = await this.prisma.hourBankEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Ajuste não encontrado');
    this.assertNotSelf(actor, entry.userId);

    const { count } = await this.prisma.hourBankEntry.updateMany({
      where: { id, canceledAt: null },
      data: { canceledAt: new Date(), canceledById: actor.id },
    });
    if (count === 0) {
      throw new ConflictException('Este ajuste já foi cancelado');
    }
    const canceled = await this.prisma.hourBankEntry.findUniqueOrThrow({
      where: { id },
      include: { createdBy: { select: { name: true } } },
    });
    return this.toResponse(canceled, canceled.createdBy.name);
  }

  private resolveEmployeeId(actor: AuthUser, employeeId?: string) {
    if (!employeeId || employeeId === actor.id) return actor.id;
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Você só pode consultar os seus próprios registros',
      );
    }
    return employeeId;
  }

  private assertNotSelf(actor: AuthUser, employeeId: string) {
    if (actor.id === employeeId) {
      throw new ForbiddenException(
        'Um administrador não pode ajustar o próprio banco de horas; peça a outro administrador',
      );
    }
  }

  private toResponse(entry: HourBankEntry, createdByName: string | null) {
    return {
      id: entry.id,
      employeeId: entry.userId,
      date: entry.date,
      minutes: entry.minutes,
      reason: entry.reason,
      createdAt: entry.createdAt,
      createdById: entry.createdById,
      createdByName,
      canceled: entry.canceledAt !== null,
      canceledAt: entry.canceledAt,
    };
  }
}
