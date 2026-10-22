import { hashPassword } from '@/auth/auth.service';
import { paginated, toPrismaPage } from '@/common/pagination';
import { PrismaService } from '@/infra/database/prisma.service';
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

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto) {
    await this.ensureEmailAvailable(dto.email);
    if (dto.workScheduleId) await this.ensureScheduleExists(dto.workScheduleId);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role ?? 'EMPLOYEE',
        workScheduleId: dto.workScheduleId,
        password: await hashPassword(dto.password),
      },
      select: employeeSelect,
    });
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

    const [data, total] = await this.prisma.$transaction([
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
    if (dto.workScheduleId) await this.ensureScheduleExists(dto.workScheduleId);

    return this.prisma.user.update({
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
    if (existing)
      throw new ConflictException('Já existe um usuário com este e-mail');
  }

  private async ensureScheduleExists(id: string) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id },
    });
    if (!schedule)
      throw new BadRequestException('Jornada de trabalho não encontrada');
  }
}
