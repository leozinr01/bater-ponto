import { PaginationQueryDto } from '@/common/pagination';
import { TIME_REGEX } from '@/common/time';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWorkScheduleDto {
  @ApiProperty({ example: 'Comercial 44h' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(80)
  name: string;

  @ApiProperty({
    example: '08:00',
    description:
      'Início previsto (HH:mm, no fuso APP_TIMEZONE). Usado para atrasos.',
  })
  @Matches(TIME_REGEX, {
    message: 'startTime deve estar no formato HH:mm (ex: 08:00)',
  })
  startTime: string;

  @ApiProperty({
    example: 480,
    description: 'Minutos de trabalho esperados por dia de trabalho (480 = 8h)',
  })
  @IsInt({ message: 'dailyMinutes deve ser um número inteiro de minutos' })
  @Min(1, { message: 'dailyMinutes deve ser maior que zero' })
  @Max(1440, { message: 'dailyMinutes deve ser no máximo 1440' })
  dailyMinutes: number;

  @ApiProperty({
    example: [1, 2, 3, 4, 5],
    description: 'Dias de trabalho: 0 = domingo ... 6 = sábado',
    type: [Number],
  })
  @IsArray({ message: 'workDays deve ser uma lista' })
  @ArrayMinSize(1, { message: 'Informe pelo menos um dia de trabalho' })
  @ArrayMaxSize(7)
  @ArrayUnique({ message: 'workDays não pode ter dias repetidos' })
  @IsInt({ each: true, message: 'workDays deve conter inteiros de 0 a 6' })
  @Min(0, { each: true, message: 'workDays deve conter inteiros de 0 a 6' })
  @Max(6, { each: true, message: 'workDays deve conter inteiros de 0 a 6' })
  workDays: number[];

  @ApiProperty({
    example: 10,
    description: 'Atrasos até este limite (minutos) não são computados',
  })
  @IsInt({ message: 'lateToleranceMinutes deve ser um inteiro' })
  @Min(0)
  @Max(120)
  lateToleranceMinutes: number;

  @ApiProperty({
    example: 10,
    description:
      'Diferença diária (extra ou falta) até este limite não é computada',
  })
  @IsInt({ message: 'overtimeToleranceMinutes deve ser um inteiro' })
  @Min(0)
  @Max(120)
  overtimeToleranceMinutes: number;
}

export class UpdateWorkScheduleDto extends PartialType(CreateWorkScheduleDto) {}

export class ListWorkSchedulesQueryDto extends PaginationQueryDto {}

export class WorkScheduleResponseDto extends CreateWorkScheduleDto {
  @ApiProperty() id: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true, type: Date }) updatedAt: Date | null;
}
