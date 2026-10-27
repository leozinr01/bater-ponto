import { DATE_REGEX } from '@/common/time';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AbsenceType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const DATE_MESSAGE = 'deve estar no formato YYYY-MM-DD';

export class CreateAbsenceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'employeeId inválido' })
  employeeId: string;

  @ApiProperty({
    enum: AbsenceType,
    description:
      'MEDICAL = atestado; VACATION = férias; LEAVE = afastamento; ALLOWANCE = abono',
  })
  @IsEnum(AbsenceType, { message: 'type inválido' })
  type: AbsenceType;

  @ApiProperty({
    example: '2026-10-20',
    description: 'Primeiro dia (inclusivo)',
  })
  @Matches(DATE_REGEX, { message: `startDate ${DATE_MESSAGE}` })
  startDate: string;

  @ApiProperty({ example: '2026-10-21', description: 'Último dia (inclusivo)' })
  @Matches(DATE_REGEX, { message: `endDate ${DATE_MESSAGE}` })
  endDate: string;

  @ApiProperty({ example: 'Atestado médico de 2 dias (CID não informado)' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a justificativa' })
  @MinLength(5, { message: 'A justificativa deve ter pelo menos 5 caracteres' })
  @MaxLength(500, {
    message: 'A justificativa deve ter no máximo 500 caracteres',
  })
  reason: string;
}

export class ListAbsencesQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Funcionário. Funcionários só podem consultar a si mesmos; vazio = usuário autenticado.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'employeeId inválido' })
  employeeId?: string;

  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE_REGEX, { message: `from ${DATE_MESSAGE}` })
  from: string;

  @ApiProperty({ example: '2026-10-31' })
  @Matches(DATE_REGEX, { message: `to ${DATE_MESSAGE}` })
  to: string;
}

export class AbsenceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() employeeId: string;
  @ApiProperty({ enum: AbsenceType }) type: AbsenceType;
  @ApiProperty() startDate: string;
  @ApiProperty() endDate: string;
  @ApiProperty() reason: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() createdById: string;
  @ApiProperty({ nullable: true, type: String }) createdByName: string | null;
  @ApiProperty() canceled: boolean;
  @ApiProperty({ nullable: true, type: Date }) canceledAt: Date | null;
  @ApiProperty({ nullable: true, type: String }) canceledById: string | null;
}
