import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class WorkplaceDto {
  @ApiProperty({ example: 'Matriz' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do local' })
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: -23.55052 })
  @IsLatitude({ message: 'Latitude inválida' })
  latitude: number;

  @ApiProperty({ example: -46.633308 })
  @IsLongitude({ message: 'Longitude inválida' })
  longitude: number;

  @ApiProperty({
    example: 150,
    description:
      'Raio em metros: marcações fora dele (descontada a margem de erro do GPS) recebem alerta',
  })
  @IsInt({ message: 'O raio deve ser um número inteiro de metros' })
  @Min(30, { message: 'O raio deve ter pelo menos 30 metros' })
  @Max(5000, { message: 'O raio deve ter no máximo 5000 metros' })
  radiusMeters: number;
}

export class WorkplaceResponseDto extends WorkplaceDto {
  @ApiProperty() id: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true, type: Date }) updatedAt: Date | null;
}
