import { PrismaService } from '@/infra/database/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WorkplaceDto } from './workplaces.dto';

@Injectable()
export class WorkplacesService {
  constructor(private prisma: PrismaService) {}

  list(db: Prisma.TransactionClient = this.prisma) {
    return db.workplace.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  }

  create(dto: WorkplaceDto) {
    return this.prisma.workplace.create({
      data: { ...dto, name: dto.name.trim() },
    });
  }

  /** As marcações guardam o nome e a distância da época: editar não muda o passado. */
  async update(id: string, dto: WorkplaceDto) {
    try {
      return await this.prisma.workplace.update({
        where: { id },
        data: { ...dto, name: dto.name.trim() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Local não encontrado');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const { count } = await this.prisma.workplace.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundException('Local não encontrado');
  }
}
