import { AuthUser } from '@/auth/decorators';
import { paginated, toPrismaPage } from '@/common/pagination';
import {
  addDays,
  isValidDate,
  localDate,
  localDateTime,
  zonedInstant,
} from '@/common/time';
import { PrismaService } from '@/infra/database/prisma.service';
import { EnvService } from '@/infra/env/env.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PunchClock } from '@prisma/client';
import {
  ListPunchesQueryDto,
  ManualPunchDto,
  ReplacePunchDto,
  ReportQueryDto,
} from './punches.dto';
import {
  buildTimesheet,
  groupIntoShifts,
  MAX_WORK_PERIOD_MINUTES,
} from './timesheet';

/** Duas marcações do mesmo funcionário em menos tempo que isso são tratadas como clique duplicado. */
const DUPLICATE_WINDOW_MS = 60_000;
const MAX_PERIOD_DAYS = 93;

type Tx = Prisma.TransactionClient;

@Injectable()
export class PunchesService {
  private readonly tz: string;

  constructor(
    private prisma: PrismaService,
    env: EnvService,
  ) {
    this.tz = env.get('APP_TIMEZONE');
  }

  /** Marcação feita pelo próprio funcionário, com o horário do servidor. */
  async register(user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockEmployee(tx, user.id);
      const now = new Date();

      const recent = await tx.punchClock.findMany({
        where: {
          userId: user.id,
          voidedAt: null,
          timestamp: {
            gte: new Date(now.getTime() - MAX_WORK_PERIOD_MINUTES * 2 * 60_000),
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      const last = recent.at(-1);
      if (
        last &&
        now.getTime() - last.timestamp.getTime() < DUPLICATE_WINDOW_MS
      ) {
        throw new ConflictException(
          `Marcação já registrada às ${localDateTime(last.timestamp, this.tz)}. Aguarde 1 minuto para marcar novamente.`,
        );
      }

      const punch = await tx.punchClock.create({
        data: { userId: user.id, timestamp: now, source: 'EMPLOYEE' },
      });

      const currentShift = groupIntoShifts([...recent, punch]).at(-1)!;
      return {
        ...this.toResponse(punch),
        interpretedAs: currentShift.length % 2 === 1 ? 'entrada' : 'saída',
      };
    });
  }

  async list(actor: AuthUser, query: ListPunchesQueryDto) {
    const employeeId = this.resolveEmployeeId(actor, query.employeeId);
    const where: Prisma.PunchClockWhereInput = {
      userId: employeeId,
      ...(query.includeVoided ? {} : { voidedAt: null }),
    };

    if (query.from || query.to) {
      if (query.from) this.assertDate(query.from, 'from');
      if (query.to) this.assertDate(query.to, 'to');
      if (query.from && query.to && query.from > query.to) {
        throw new BadRequestException('from deve ser anterior ou igual a to');
      }
      where.timestamp = {
        ...(query.from && { gte: zonedInstant(query.from, '00:00', this.tz) }),
        ...(query.to && {
          lt: zonedInstant(addDays(query.to, 1), '00:00', this.tz),
        }),
      };
    }

    // Página e total em paralelo: numa lista, não precisam da mesma transação
    const [punches, total] = await Promise.all([
      this.prisma.punchClock.findMany({
        where,
        orderBy: [{ timestamp: 'desc' }, { id: 'asc' }],
        ...toPrismaPage(query),
      }),
      this.prisma.punchClock.count({ where }),
    ]);

    return paginated(
      punches.map((p) => this.toResponse(p)),
      total,
      query,
    );
  }

  async timesheet(
    actor: AuthUser,
    query: { employeeId?: string; from: string; to: string },
  ) {
    const employeeId = this.resolveEmployeeId(actor, query.employeeId);
    this.assertPeriod(query.from, query.to);

    const employee = await this.prisma.user.findUnique({
      where: { id: employeeId },
      include: { workSchedule: true },
    });
    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    const punches = await this.validPunchesInWindow(
      [employeeId],
      query.from,
      query.to,
    );
    return this.buildEmployeeTimesheet(employee, punches, query.from, query.to);
  }

  /** Totais do período por funcionário, paginado por funcionário. */
  async report(query: ReportQueryDto) {
    this.assertPeriod(query.from, query.to);

    const where: Prisma.UserWhereInput = { id: query.employeeId };
    // Página e total em paralelo: numa lista, não precisam da mesma transação
    const [employees, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { workSchedule: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toPrismaPage(query),
      }),
      this.prisma.user.count({ where }),
    ]);

    const punches = await this.validPunchesInWindow(
      employees.map((e) => e.id),
      query.from,
      query.to,
    );

    const data = employees.map((employee) => {
      const sheet = this.buildEmployeeTimesheet(
        employee,
        punches.filter((p) => p.userId === employee.id),
        query.from,
        query.to,
      );
      return { employee: sheet.employee, totals: sheet.totals };
    });

    return paginated(data, total, query);
  }

  /** Inclusão manual de marcação por um administrador, com justificativa. */
  async createManual(actor: AuthUser, dto: ManualPunchDto) {
    this.assertNotSelfCorrection(actor, dto.employeeId);
    const timestamp = this.parseCorrectionTimestamp(dto.timestamp);

    return this.prisma.$transaction(async (tx) => {
      await this.lockEmployee(tx, dto.employeeId);
      const employee = await tx.user.findUnique({
        where: { id: dto.employeeId },
      });
      if (!employee) throw new NotFoundException('Funcionário não encontrado');

      const created = await tx.punchClock.create({
        data: {
          userId: dto.employeeId,
          timestamp,
          source: 'ADMIN',
          createdById: actor.id,
          reason: dto.reason,
        },
      });
      return { voided: null, created: this.toResponse(created) };
    });
  }

  /** Desconsidera uma marcação sem apagá-la. */
  async void(actor: AuthUser, punchId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const voided = await this.voidInTx(tx, actor, punchId, reason);
      return { voided: this.toResponse(voided), created: null };
    });
  }

  /** Corrige o horário: desconsidera a original e inclui a nova numa única transação. */
  async replace(actor: AuthUser, punchId: string, dto: ReplacePunchDto) {
    const timestamp = this.parseCorrectionTimestamp(dto.timestamp);

    return this.prisma.$transaction(async (tx) => {
      const voided = await this.voidInTx(tx, actor, punchId, dto.reason);
      const created = await tx.punchClock.create({
        data: {
          userId: voided.userId,
          timestamp,
          source: 'ADMIN',
          createdById: actor.id,
          reason: dto.reason,
          replacesId: voided.id,
        },
      });
      return {
        voided: this.toResponse(voided),
        created: this.toResponse(created),
      };
    });
  }

  private async voidInTx(
    tx: Tx,
    actor: AuthUser,
    punchId: string,
    reason: string,
  ) {
    const punch = await tx.punchClock.findUnique({ where: { id: punchId } });
    if (!punch) throw new NotFoundException('Marcação não encontrada');
    this.assertNotSelfCorrection(actor, punch.userId);

    await this.lockEmployee(tx, punch.userId);

    // Condição no próprio UPDATE: duas correções simultâneas não desconsideram a mesma marcação.
    const { count } = await tx.punchClock.updateMany({
      where: { id: punchId, voidedAt: null },
      data: { voidedAt: new Date(), voidedById: actor.id, voidReason: reason },
    });
    if (count === 0) {
      throw new ConflictException('Esta marcação já foi desconsiderada');
    }

    return tx.punchClock.findUniqueOrThrow({ where: { id: punchId } });
  }

  private buildEmployeeTimesheet(
    employee: Prisma.UserGetPayload<{ include: { workSchedule: true } }>,
    punches: PunchClock[],
    from: string,
    to: string,
  ) {
    const schedule = employee.workSchedule;
    const { days, totals } = buildTimesheet({
      punches,
      schedule,
      timezone: this.tz,
      from,
      to,
      now: new Date(),
      employeeSince: localDate(employee.createdAt, this.tz),
    });

    return {
      employee: { id: employee.id, name: employee.name },
      timezone: this.tz,
      from,
      to,
      schedule,
      days: days.map((day) => ({
        ...day,
        punches: day.punches.map((p) => ({
          id: p.id,
          timestamp: p.timestamp,
          localTime: localDateTime(p.timestamp, this.tz),
        })),
        periods: day.periods.map((period) => ({
          start: localDateTime(period.start, this.tz),
          end: period.end && localDateTime(period.end, this.tz),
          minutes: period.minutes,
        })),
      })),
      totals,
    };
  }

  /**
   * Busca uma folga de um dia antes e depois do período: jornadas que começam no
   * último dia e terminam no seguinte precisam de todas as marcações.
   */
  private validPunchesInWindow(
    employeeIds: string[],
    from: string,
    to: string,
  ) {
    return this.prisma.punchClock.findMany({
      where: {
        userId: { in: employeeIds },
        voidedAt: null,
        timestamp: {
          gte: zonedInstant(addDays(from, -1), '00:00', this.tz),
          lt: zonedInstant(addDays(to, 2), '00:00', this.tz),
        },
      },
      orderBy: { timestamp: 'asc' },
    });
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

  private assertNotSelfCorrection(actor: AuthUser, employeeId: string) {
    if (actor.id === employeeId) {
      throw new ForbiddenException(
        'Um administrador não pode corrigir as próprias marcações; peça a outro administrador',
      );
    }
  }

  private parseCorrectionTimestamp(value: string) {
    const timestamp = new Date(value);
    if (isNaN(timestamp.getTime())) {
      throw new BadRequestException('timestamp inválido');
    }
    if (timestamp.getTime() > Date.now()) {
      throw new BadRequestException(
        'Não é possível incluir marcações no futuro',
      );
    }
    return timestamp;
  }

  private assertDate(value: string, field: string) {
    if (!isValidDate(value))
      throw new BadRequestException(`${field} não é uma data válida`);
  }

  private assertPeriod(from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    if (from > to)
      throw new BadRequestException('from deve ser anterior ou igual a to');
    if (addDays(from, MAX_PERIOD_DAYS - 1) < to) {
      throw new BadRequestException(
        `O período deve ter no máximo ${MAX_PERIOD_DAYS} dias`,
      );
    }
  }

  /** Serializa operações de ponto do mesmo funcionário (evita duplicatas por cliques simultâneos). */
  private async lockEmployee(tx: Tx, employeeId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${employeeId}))`;
  }

  private toResponse(punch: PunchClock) {
    return {
      id: punch.id,
      employeeId: punch.userId,
      timestamp: punch.timestamp,
      localTime: localDateTime(punch.timestamp, this.tz),
      source: punch.source,
      reason: punch.reason,
      createdById: punch.createdById,
      replacesId: punch.replacesId,
      voided: punch.voidedAt !== null,
      voidedAt: punch.voidedAt,
      voidedById: punch.voidedById,
      voidReason: punch.voidReason,
      createdAt: punch.createdAt,
    };
  }
}
