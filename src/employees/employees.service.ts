import { hashPassword } from '@/auth/auth.service';
import { paginated, toPrismaPage } from '@/common/pagination';
import { localDate } from '@/common/time';
import { PrismaService } from '@/infra/database/prisma.service';
import { EnvService } from '@/infra/env/env.service';
import { baselineRow, recordSchedule } from '@/work-schedules/schedule-history';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateEmployeeDto,
  employeeSelect,
  ListEmployeesQueryDto,
  UpdateEmployeeDto,
} from './employees.dto';

const EMAIL_TAKEN = 'Já existe um usuário com este e-mail';

/** Dois cadastros simultâneos passam pela checagem prévia; o índice único do banco decide. */
function rethrowEmailConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(EMAIL_TAKEN);
  }
  throw error;
}

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private env: EnvService,
  ) {}

  async create(dto: CreateEmployeeDto) {
    await this.ensureEmailAvailable(dto.email);
    const schedule = dto.workScheduleId
      ? await this.ensureScheduleExists(dto.workScheduleId)
      : null;
    const password = await hashPassword(dto.password);

    return this.prisma
      .$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            role: dto.role ?? 'EMPLOYEE',
            workScheduleId: dto.workScheduleId,
            password,
          },
          select: employeeSelect,
        });
        await tx.scheduleHistory.create({
          data: baselineRow(user.id, schedule),
        });
        return user;
      })
      .catch(rethrowEmailConflict);
  }

  async list(query: ListEmployeesQueryDto) {
    const where: Prisma.UserWhereInput = {
      active: query.active,
      role: query.role,
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Página e total em paralelo: numa lista, não precisam da mesma transação
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: employeeSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toPrismaPage(query),
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginated(data, total, query);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: employeeSelect,
    });
    if (!user) throw new NotFoundException('Funcionário não encontrado');
    return user;
  }

  async update(actorId: string, id: string, dto: UpdateEmployeeDto) {
    const current = await this.findById(id);

    if (actorId === id && (dto.active === false || dto.role === 'EMPLOYEE')) {
      throw new BadRequestException(
        'Você não pode desativar nem remover o acesso de administrador da sua própria conta',
      );
    }
    if (dto.email && dto.email !== current.email) {
      await this.ensureEmailAvailable(dto.email);
    }
    const next = dto.workScheduleId
      ? await this.ensureScheduleExists(dto.workScheduleId)
      : null;
    const scheduleChanged =
      dto.workScheduleId !== undefined &&
      dto.workScheduleId !== current.workScheduleId;

    return this.prisma
      .$transaction(async (tx) => {
        if (scheduleChanged) {
          // A troca vale a partir de hoje: os dias anteriores mantêm a jornada da época
          const previous = current.workScheduleId
            ? await tx.workSchedule.findUnique({
                where: { id: current.workScheduleId },
              })
            : null;
          await recordSchedule(
            tx,
            id,
            previous,
            next,
            localDate(new Date(), this.env.get('APP_TIMEZONE')),
          );
        }
        return tx.user.update({
          where: { id },
          data: {
            name: dto.name,
            email: dto.email,
            role: dto.role,
            active: dto.active,
            workScheduleId: dto.workScheduleId,
          },
          select: employeeSelect,
        });
      })
      .catch(rethrowEmailConflict);
  }

  async resetPassword(id: string, password: string) {
    await this.findById(id);
    await this.prisma.user.update({
      where: { id },
      data: {
        password: await hashPassword(password),
        tokenVersion: { increment: 1 },
      },
    });
  }

  private async ensureEmailAvailable(email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException(EMAIL_TAKEN);
  }

  private async ensureScheduleExists(id: string) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id },
    });
    if (!schedule)
      throw new BadRequestException('Jornada de trabalho não encontrada');
    return schedule;
  }
}
