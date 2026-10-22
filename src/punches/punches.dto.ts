import { PaginationQueryDto } from '@/common/pagination';
import { DATE_REGEX, ISO_WITH_OFFSET_REGEX } from '@/common/time';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PunchSource } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const DATE_MESSAGE = 'deve estar no formato YYYY-MM-DD';

export class PeriodQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Funcionário. Funcionários só podem consultar a si mesmos; vazio = usuário autenticado.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'employeeId inválido' })
  employeeId?: string;

  @ApiProperty({
    example: '2026-10-01',
    description: 'Data inicial (inclusiva), no fuso APP_TIMEZONE',
  })
  @Matches(DATE_REGEX, { message: `from ${DATE_MESSAGE}` })
  from: string;

  @ApiProperty({
    example: '2026-10-31',
    description: 'Data final (inclusiva), no fuso APP_TIMEZONE',
  })
  @Matches(DATE_REGEX, { message: `to ${DATE_MESSAGE}` })
  to: string;
}

export class ListPunchesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Funcionário. Funcionários só podem consultar a si mesmos; vazio = usuário autenticado.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'employeeId inválido' })
  employeeId?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: `from ${DATE_MESSAGE}` })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: `to ${DATE_MESSAGE}` })
  to?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Incluir marcações desconsideradas por correção',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'includeVoided deve ser true ou false' })
  includeVoided: boolean = true;
}

export class ReportQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE_REGEX, { message: `from ${DATE_MESSAGE}` })
  from: string;

  @ApiProperty({ example: '2026-10-31' })
  @Matches(DATE_REGEX, { message: `to ${DATE_MESSAGE}` })
  to: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'employeeId inválido' })
  employeeId?: string;
}

function Reason(): PropertyDecorator {
  return (target, key) => {
    IsString()(target, key);
    IsNotEmpty({ message: 'Informe a justificativa' })(target, key);
    MinLength(5, {
      message: 'A justificativa deve ter pelo menos 5 caracteres',
    })(target, key);
    MaxLength(500, {
      message: 'A justificativa deve ter no máximo 500 caracteres',
    })(target, key);
  };
}

const TIMESTAMP_MESSAGE =
  'timestamp deve ser ISO 8601 com fuso explícito (ex: 2026-10-20T08:00:00-03:00)';

export class ManualPunchDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'employeeId inválido' })
  employeeId: string;

  @ApiProperty({ example: '2026-10-20T08:00:00-03:00' })
  @Matches(ISO_WITH_OFFSET_REGEX, { message: TIMESTAMP_MESSAGE })
  timestamp: string;

  @ApiProperty({
    example: 'Funcionário esqueceu de marcar a entrada (relato do gestor)',
  })
  @Reason()
  reason: string;
}

export class VoidPunchDto {
  @ApiProperty({ example: 'Marcação duplicada por erro no equipamento' })
  @Reason()
  reason: string;
}

export class ReplacePunchDto {
  @ApiProperty({ example: '2026-10-20T12:00:00-03:00' })
  @Matches(ISO_WITH_OFFSET_REGEX, { message: TIMESTAMP_MESSAGE })
  timestamp: string;

  @ApiProperty({
    example: 'Saída marcada com atraso; horário confirmado pelo gestor',
  })
  @Reason()
  reason: string;
}

export class PunchResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() employeeId: string;
  @ApiProperty({ description: 'Instante em UTC' }) timestamp: Date;
  @ApiProperty({
    example: '2026-10-20T08:00:00-03:00',
    description: 'Horário no fuso APP_TIMEZONE',
  })
  localTime: string;
  @ApiProperty({
    enum: PunchSource,
    description: 'EMPLOYEE = marcação original; ADMIN = inclusão por correção',
  })
  source: PunchSource;
  @ApiProperty({ nullable: true, type: String }) reason: string | null;
  @ApiProperty({ nullable: true, type: String }) createdById: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Marcação substituída por esta',
  })
  replacesId: string | null;
  @ApiProperty() voided: boolean;
  @ApiProperty({ nullable: true, type: Date }) voidedAt: Date | null;
  @ApiProperty({ nullable: true, type: String }) voidedById: string | null;
  @ApiProperty({ nullable: true, type: String }) voidReason: string | null;
  @ApiProperty() createdAt: Date;
}

export class RegisterPunchResponseDto extends PunchResponseDto {
  @ApiProperty({
    enum: ['entrada', 'saída'],
    description:
      'Interpretação da marcação na jornada atual (pela ordem cronológica)',
  })
  interpretedAs: 'entrada' | 'saída';
}

export class CorrectionResponseDto {
  @ApiProperty({ type: PunchResponseDto, nullable: true })
  voided: PunchResponseDto | null;
  @ApiProperty({ type: PunchResponseDto, nullable: true })
  created: PunchResponseDto | null;
}

class TimesheetPunchDto {
  @ApiProperty() id: string;
  @ApiProperty() timestamp: Date;
  @ApiProperty() localTime: string;
}

class TimesheetPeriodDto {
  @ApiProperty() start: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'null = saída não marcada',
  })
  end: string | null;
  @ApiProperty() minutes: number;
}

class TimesheetDayDto {
  @ApiProperty({ example: '2026-10-20' }) date: string;
  @ApiProperty({ description: '0 = domingo ... 6 = sábado' }) weekday: number;
  @ApiProperty({ description: 'Dia de trabalho pela jornada' })
  scheduled: boolean;
  @ApiProperty({
    enum: ['complete', 'incomplete', 'in_progress', 'absent'],
    description:
      'incomplete = marcação faltando (não inventamos horários; extra/falta só após correção)',
  })
  status: string;
  @ApiProperty({ type: [TimesheetPunchDto] }) punches: TimesheetPunchDto[];
  @ApiProperty({ type: [TimesheetPeriodDto] }) periods: TimesheetPeriodDto[];
  @ApiProperty() workedMinutes: number;
  @ApiProperty() breakMinutes: number;
  @ApiProperty({ nullable: true, type: Number }) expectedMinutes: number | null;
  @ApiProperty({ nullable: true, type: Number }) lateMinutes: number | null;
  @ApiProperty({ nullable: true, type: Number }) overtimeMinutes: number | null;
  @ApiProperty({ nullable: true, type: Number }) deficitMinutes: number | null;
}

class TimesheetTotalsDto {
  @ApiProperty() workedMinutes: number;
  @ApiProperty({ nullable: true, type: Number }) expectedMinutes: number | null;
  @ApiProperty({ nullable: true, type: Number }) lateMinutes: number | null;
  @ApiProperty({ nullable: true, type: Number }) overtimeMinutes: number | null;
  @ApiProperty({ nullable: true, type: Number }) deficitMinutes: number | null;
  @ApiProperty() incompleteDays: number;
  @ApiProperty() absentDays: number;
}

class TimesheetEmployeeDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class TimesheetResponseDto {
  @ApiProperty({ type: TimesheetEmployeeDto }) employee: TimesheetEmployeeDto;
  @ApiProperty({ example: 'America/Sao_Paulo' }) timezone: string;
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty({ nullable: true, description: 'Jornada usada no cálculo' })
  schedule: object | null;
  @ApiProperty({ type: [TimesheetDayDto] }) days: TimesheetDayDto[];
  @ApiProperty({ type: TimesheetTotalsDto }) totals: TimesheetTotalsDto;
}

export class ReportItemDto {
  @ApiProperty({ type: TimesheetEmployeeDto }) employee: TimesheetEmployeeDto;
  @ApiProperty({ type: TimesheetTotalsDto }) totals: TimesheetTotalsDto;
}
