import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve ser um número inteiro' })
  @Min(1, { message: 'page deve ser maior ou igual a 1' })
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize deve ser um número inteiro' })
  @Min(1, { message: 'pageSize deve ser maior ou igual a 1' })
  @Max(100, { message: 'pageSize deve ser no máximo 100' })
  pageSize: number = 20;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function toPrismaPage({ page, pageSize }: PaginationQueryDto) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(
  data: T[],
  total: number,
  { page, pageSize }: PaginationQueryDto,
): Paginated<T> {
  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
