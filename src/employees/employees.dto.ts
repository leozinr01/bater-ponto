import { normalizeEmail, StrongPassword } from '@/auth/auth.dto';
import { PaginationQueryDto } from '@/common/pagination';
import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Prisma, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const employeeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  workScheduleId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'maria@empresa.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty({ example: 'senha-inicial-123', minLength: 8 })
  @StrongPassword()
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.EMPLOYEE })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Papel inválido (EMPLOYEE ou ADMIN)' })
  role?: UserRole;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Jornada de trabalho do funcionário',
  })
  @IsOptional()
  @IsUUID('4', { message: 'workScheduleId inválido' })
  workScheduleId?: string;
}

export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['password', 'workScheduleId'] as const),
) {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'null remove a jornada',
  })
  @IsOptional()
  @IsUUID('4', { message: 'workScheduleId inválido' })
  workScheduleId?: string | null;

  @ApiPropertyOptional({
    description: 'false desativa o acesso (os registros são mantidos)',
  })
  @IsOptional()
  @IsBoolean({ message: 'active deve ser true ou false' })
  active?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: 8 })
  @StrongPassword()
  password: string;
}

export class ListEmployeesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome ou e-mail' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'active deve ser true ou false' })
  active?: boolean;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Papel inválido' })
  role?: UserRole;
}

export class EmployeeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty() active: boolean;
  @ApiProperty({ nullable: true, type: String }) workScheduleId: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true, type: Date }) updatedAt: Date | null;
}
