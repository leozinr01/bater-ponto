import {
  paginated,
  PaginationQueryDto,
  toPrismaPage,
} from '@/common/pagination';
import { PrismaService } from '@/infra/database/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateWorkScheduleDto,
  UpdateWorkScheduleDto,
} from './work-schedules.dto';

const sortDays = (days?: number[]) => days && [...days].sort((a, b) => a - b);

@Injectable()
export class WorkSchedulesService {
  constructor(private prisma: PrismaService) {}

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

  async update(id: string, dto: UpdateWorkScheduleDto) {
    await this.findById(id);
    return this.prisma.workSchedule.update({
      where: { id },
      data: { ...dto, workDays: sortDays(dto.workDays) },
    });
  }
}
