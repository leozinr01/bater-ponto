import { DATE_REGEX } from '@/common/time';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';

const DATE_MESSAGE = 'deve estar no formato YYYY-MM-DD';

export class HourBankQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Funcionário. Funcionários só podem consultar a si mesmos; vazio = usuário autenticado.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'employeeId inválido' })
  employeeId?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Saldo até esta data (inclusiva). Padrão: hoje.',
  })
  @IsOptional()
  @Matches(DATE_REGEX, { message: `until ${DATE_MESSAGE}` })
  until?: string;
}

export class CreateHourBankEntryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'employeeId inválido' })
  employeeId: string;

  @ApiProperty({
    example: '2026-10-31',
    description: 'Data em que o ajuste entra no saldo',
  })
  @Matches(DATE_REGEX, { message: `date ${DATE_MESSAGE}` })
  date: string;

  @ApiProperty({
    example: -600,
    description:
      'Minutos: positivo = crédito, negativo = débito (ex.: -600 = 10h pagas em folha)',
  })
  @IsInt({ message: 'minutes deve ser um número inteiro de minutos' })
  @NotEquals(0, { message: 'minutes não pode ser zero' })
  @Min(-100_000)
  @Max(100_000)
  minutes: number;

  @ApiProperty({ example: '10h extras pagas na folha de outubro' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a justificativa' })
  @MinLength(5, { message: 'A justificativa deve ter pelo menos 5 caracteres' })
  @MaxLength(500, {
    message: 'A justificativa deve ter no máximo 500 caracteres',
  })
  reason: string;
}

export class HourBankEntryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() employeeId: string;
  @ApiProperty() date: string;
  @ApiProperty() minutes: number;
  @ApiProperty() reason: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() createdById: string;
  @ApiProperty({ nullable: true, type: String }) createdByName: string | null;
  @ApiProperty() canceled: boolean;
  @ApiProperty({ nullable: true, type: Date }) canceledAt: Date | null;
}

class HourBankMovementDto {
  @ApiProperty({ description: 'Horas extras' }) overtimeMinutes: number;
  @ApiProperty({ description: 'Falta de horas' }) deficitMinutes: number;
  @ApiProperty({ description: 'Consumido por folgas de banco' })
  compensatedMinutes: number;
  @ApiProperty({ description: 'Ajustes manuais (créditos − débitos)' })
  adjustmentMinutes: number;
  @ApiProperty({ description: 'Resultado: extras − falta − folgas + ajustes' })
  balanceMinutes: number;
}

class HourBankMonthDto extends HourBankMovementDto {
  @ApiProperty({ example: '2026-10' }) month: string;
  @ApiProperty({ description: 'Saldo acumulado ao fim do mês' })
  accumulatedMinutes: number;
  @ApiProperty({ description: 'Dias incompletos, ainda fora do saldo' })
  pendingDays: number;
}

export class HourBankResponseDto {
  @ApiProperty() employee: { id: string; name: string };
  @ApiProperty({ description: 'Início do banco (data de cadastro)' })
  since: string;
  @ApiProperty() until: string;
  @ApiProperty({ type: HourBankMovementDto }) totals: HourBankMovementDto;
  @ApiProperty({ description: 'Dias incompletos, ainda fora do saldo' })
  pendingDays: number;
  @ApiProperty({ type: [HourBankMonthDto] }) months: HourBankMonthDto[];
  @ApiProperty({ type: [HourBankEntryResponseDto] })
  entries: HourBankEntryResponseDto[];
}
