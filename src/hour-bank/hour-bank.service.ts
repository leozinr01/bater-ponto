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

export interface Movement {
  overtimeMinutes: number;
  deficitMinutes: number;
  compensatedMinutes: number;
  adjustmentMinutes: number;
  balanceMinutes: number;
}

const emptyMovement = (): Movement => ({
  overtimeMinutes: 0,
  deficitMinutes: 0,
  compensatedMinutes: 0,
  adjustmentMinutes: 0,
  balanceMinutes: 0,
});

/**
 * Banco de horas: saldo acumulado desde o cadastro do funcionário.
 * Saldo = horas extras − falta de horas − folgas de banco + ajustes manuais.
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
    const byMonth = new Map<string, Movement & { pendingDays: number }>();
    const monthOf = (month: string) => {
      let m = byMonth.get(month);
      if (!m) byMonth.set(month, (m = { ...emptyMovement(), pendingDays: 0 }));
      return m;
    };
    for (const day of days) {
      const m = monthOf(day.date.slice(0, 7));
      m.overtimeMinutes += day.overtimeMinutes ?? 0;
      m.deficitMinutes += day.deficitMinutes ?? 0;
      m.compensatedMinutes += day.compensatedMinutes;
      if (day.status === 'incomplete') m.pendingDays++;
    }
    for (const entry of active) {
      monthOf(entry.date.slice(0, 7)).adjustmentMinutes += entry.minutes;
    }

    let accumulated = 0;
    const months = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, m]) => {
        const balanceMinutes = balanceOf(m);
        accumulated += balanceMinutes;
        return {
          month,
          ...m,
          balanceMinutes,
          accumulatedMinutes: accumulated,
        };
      });

    const totals = months.reduce<Movement>((t, m) => {
      t.overtimeMinutes += m.overtimeMinutes;
      t.deficitMinutes += m.deficitMinutes;
      t.compensatedMinutes += m.compensatedMinutes;
      t.adjustmentMinutes += m.adjustmentMinutes;
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
      this.prisma.hourBankEntry.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, date: { lte: until }, canceledAt: null },
        _sum: { minutes: true },
      }),
    ]);
    for (const id of ids) {
      const days = daysByEmployee.get(id) ?? [];
      result.set(
        id,
        days.reduce(
          (sum, d) =>
            sum +
            (d.overtimeMinutes ?? 0) -
            (d.deficitMinutes ?? 0) -
            d.compensatedMinutes,
          0,
        ) + (entries.find((e) => e.userId === id)?._sum.minutes ?? 0),
      );
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

function balanceOf(m: Movement) {
  return (
    m.overtimeMinutes -
    m.deficitMinutes -
    m.compensatedMinutes +
    m.adjustmentMinutes
  );
}
