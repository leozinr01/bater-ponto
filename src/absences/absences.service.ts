import { AuthUser } from '@/auth/decorators';
import { addDays, isValidDate } from '@/common/time';
import { PrismaService } from '@/infra/database/prisma.service';
import { DayAbsence } from '@/punches/timesheet';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Absence, Prisma } from '@prisma/client';
import { CreateAbsenceDto, ListAbsencesQueryDto } from './absences.dto';

const MAX_ABSENCE_DAYS = 366;

/** Abonos ativos que tocam o período [from, to]. */
const overlapping = (from: string, to: string): Prisma.AbsenceWhereInput => ({
  canceledAt: null,
  startDate: { lte: to },
  endDate: { gte: from },
});

@Injectable()
export class AbsencesService {
  constructor(private prisma: PrismaService) {}

  async list(actor: AuthUser, query: ListAbsencesQueryDto) {
    const employeeId = this.resolveEmployeeId(actor, query.employeeId);
    if (query.from > query.to) {
      throw new BadRequestException('from deve ser anterior ou igual a to');
    }
    const absences = await this.prisma.absence.findMany({
      where: {
        userId: employeeId,
        startDate: { lte: query.to },
        endDate: { gte: query.from },
      },
      include: { createdBy: { select: { name: true } } },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return absences.map((a) => this.toResponse(a, a.createdBy.name));
  }

  /** Lançamento por um administrador, com justificativa. */
  async create(actor: AuthUser, dto: CreateAbsenceDto) {
    this.assertNotSelf(actor, dto.employeeId);
    for (const [field, value] of [
      ['startDate', dto.startDate],
      ['endDate', dto.endDate],
    ]) {
      if (!isValidDate(value)) {
        throw new BadRequestException(`${field} não é uma data válida`);
      }
    }
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException(
        'startDate deve ser anterior ou igual a endDate',
      );
    }
    if (addDays(dto.startDate, MAX_ABSENCE_DAYS - 1) < dto.endDate) {
      throw new BadRequestException(
        `O período deve ter no máximo ${MAX_ABSENCE_DAYS} dias`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Mesma trava das marcações: dois lançamentos simultâneos não se sobrepõem
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.employeeId}))`;
      const employee = await tx.user.findUnique({
        where: { id: dto.employeeId },
      });
      if (!employee) throw new NotFoundException('Funcionário não encontrado');

      const conflict = await tx.absence.findFirst({
        where: {
          userId: dto.employeeId,
          ...overlapping(dto.startDate, dto.endDate),
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Já existe um lançamento de ${conflict.startDate} a ${conflict.endDate} neste período`,
        );
      }

      const created = await tx.absence.create({
        data: {
          userId: dto.employeeId,
          type: dto.type,
          startDate: dto.startDate,
          endDate: dto.endDate,
          reason: dto.reason.trim(),
          createdById: actor.id,
        },
        include: { createdBy: { select: { name: true } } },
      });
      return this.toResponse(created, created.createdBy.name);
    });
  }

  /** Cancela sem apagar: o lançamento continua no histórico. */
  async cancel(actor: AuthUser, id: string) {
    const absence = await this.prisma.absence.findUnique({ where: { id } });
    if (!absence) throw new NotFoundException('Lançamento não encontrado');
    this.assertNotSelf(actor, absence.userId);

    const { count } = await this.prisma.absence.updateMany({
      where: { id, canceledAt: null },
      data: { canceledAt: new Date(), canceledById: actor.id },
    });
    if (count === 0) {
      throw new ConflictException('Este lançamento já foi cancelado');
    }
    const canceled = await this.prisma.absence.findUniqueOrThrow({
      where: { id },
      include: { createdBy: { select: { name: true } } },
    });
    return this.toResponse(canceled, canceled.createdBy.name);
  }

  /** Abonos ativos do período, por funcionário e data (usado no cálculo do espelho). */
  async byEmployeeAndDate(employeeIds: string[], from: string, to: string) {
    const absences = await this.prisma.absence.findMany({
      where: { userId: { in: employeeIds }, ...overlapping(from, to) },
    });
    const result = new Map<string, Map<string, DayAbsence>>();
    for (const absence of absences) {
      const days = result.get(absence.userId) ?? new Map<string, DayAbsence>();
      const start = absence.startDate > from ? absence.startDate : from;
      const end = absence.endDate < to ? absence.endDate : to;
      for (let date = start; date <= end; date = addDays(date, 1)) {
        days.set(date, { type: absence.type, reason: absence.reason });
      }
      result.set(absence.userId, days);
    }
    return result;
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
        'Um administrador não pode lançar abonos para si mesmo; peça a outro administrador',
      );
    }
  }

  private toResponse(absence: Absence, createdByName: string | null) {
    return {
      id: absence.id,
      employeeId: absence.userId,
      type: absence.type,
      startDate: absence.startDate,
      endDate: absence.endDate,
      reason: absence.reason,
      createdAt: absence.createdAt,
      createdById: absence.createdById,
      createdByName,
      canceled: absence.canceledAt !== null,
      canceledAt: absence.canceledAt,
      canceledById: absence.canceledById,
    };
  }
}
