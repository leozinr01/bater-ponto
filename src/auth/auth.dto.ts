import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PASSWORD_MIN = 8;
// bcrypt ignora o que passa de 72 bytes
export const PASSWORD_MAX = 72;

export const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Validação de senha nova, reutilizada no cadastro e nas trocas de senha. */
export function StrongPassword(): PropertyDecorator {
  return (target, key) => {
    IsString({ message: 'A senha deve ser um texto' })(target, key);
    MinLength(PASSWORD_MIN, {
      message: `A senha deve ter pelo menos ${PASSWORD_MIN} caracteres`,
    })(target, key);
    MaxLength(PASSWORD_MAX, {
      message: `A senha deve ter no máximo ${PASSWORD_MAX} caracteres`,
    })(target, key);
  };
}

export class LoginDto {
  @ApiProperty({ example: 'admin@empresa.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty({ example: 'senha-segura' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha' })
  @MaxLength(PASSWORD_MAX)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o refresh token' })
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha atual' })
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @StrongPassword()
  newPassword: string;
}

export class TokensResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}
