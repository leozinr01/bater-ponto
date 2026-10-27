import {
  paginated,
  PaginationQueryDto,
  toPrismaPage,
} from '@/common/pagination';
import { localDate } from '@/common/time';
import { PrismaService } from '@/infra/database/prisma.service';
import { EnvService } from '@/infra/env/env.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateWorkScheduleDto,
  UpdateWorkScheduleDto,
} from './work-schedules.dto';
import { recordSchedule, scheduleValuesChanged } from './schedule-history';

const sortDays = (days?: number[]) => days && [...days].sort((a, b) => a - b);

@Injectable()
export class WorkSchedulesService {
  constructor(
    private prisma: PrismaService,
    private env: EnvService,
  ) {}

  create(dto: CreateWorkScheduleDto) {
    return this.prisma.workSchedule.create({
      data: { ...dto, workDays: sortDays(dto.workDays) },
    });
  }

  async list(query: PaginationQueryDto) {
    // Página e total em paralelo: numa lista, não precisam da mesma transação
    const [data, total] = await Promise.all([
      this.prisma.workSchedule.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toPrismaPage(query),
      }),
      this.prisma.workSchedule.count(),
    ]);
    return paginated(data, total, query);
  }

  async findById(id: string) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id },
    });
    if (!schedule)
      throw new NotFoundException('Jornada de trabalho não encontrada');
    return schedule;
  }

  /** A alteração vale a partir de hoje para quem usa a jornada; os dias anteriores não mudam. */
  async update(id: string, dto: UpdateWorkScheduleDto) {
    const before = await this.findById(id);
    const today = localDate(new Date(), this.env.get('APP_TIMEZONE'));

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.workSchedule.update({
        where: { id },
        data: { ...dto, workDays: sortDays(dto.workDays) },
      });
      if (scheduleValuesChanged(before, after)) {
        const users = await tx.user.findMany({
          where: { workScheduleId: id },
          select: { id: true },
        });
        for (const user of users) {
          await recordSchedule(tx, user.id, before, after, today);
        }
      }
      return after;
    });
  }
}
