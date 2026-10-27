import { DATE_REGEX } from '@/common/time';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({
    example: '2026-11-20',
    description: 'Data do feriado (YYYY-MM-DD, no fuso APP_TIMEZONE)',
  })
  @Matches(DATE_REGEX, { message: 'date deve estar no formato YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: 'Aniversário da cidade' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do feriado' })
  @MaxLength(80)
  name: string;
}

export class YearQueryDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt({ message: 'year deve ser um ano válido' })
  @Min(2000, { message: 'year deve ser um ano válido' })
  @Max(2100, { message: 'year deve ser um ano válido' })
  year: number;
}

export class HolidayResponseDto extends CreateHolidayDto {
  @ApiProperty() id: string;
  @ApiProperty() createdAt: Date;
}

export class ImportHolidaysResponseDto {
  @ApiProperty({ description: 'Feriados incluídos agora' }) created: number;
  @ApiProperty({ description: 'Datas que já estavam cadastradas' })
  skipped: number;
}
