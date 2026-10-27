import { isValidDate } from '@/common/time';
import { PrismaService } from '@/infra/database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateHolidayDto } from './holidays.dto';
import { nationalHolidays } from './national-holidays';

@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) {}

  list(year: number) {
    return this.prisma.holiday.findMany({
      where: { date: { gte: `${year}-01-01`, lte: `${year}-12-31` } },
      orderBy: { date: 'asc' },
    });
  }

  async create(dto: CreateHolidayDto) {
    if (!isValidDate(dto.date)) {
      throw new BadRequestException('date não é uma data válida');
    }
    try {
      return await this.prisma.holiday.create({
        data: { date: dto.date, name: dto.name.trim() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um feriado nesta data');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const { count } = await this.prisma.holiday.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundException('Feriado não encontrado');
  }

  /** Inclui os feriados nacionais do ano, sem mexer nas datas já cadastradas. */
  async importNational(year: number) {
    const holidays = nationalHolidays(year);
    const { count } = await this.prisma.holiday.createMany({
      data: holidays,
      skipDuplicates: true,
    });
    return { created: count, skipped: holidays.length - count };
  }

  /** Feriados do período, por data (usado no cálculo do espelho). */
  async byDate(from: string, to: string): Promise<Map<string, string>> {
    const holidays = await this.prisma.holiday.findMany({
      where: { date: { gte: from, lte: to } },
    });
    return new Map(holidays.map((h) => [h.date, h.name]));
  }
}
