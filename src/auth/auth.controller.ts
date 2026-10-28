import { EmployeeResponseDto, employeeSelect } from '@/employees/employees.dto';
import { PrismaService } from '@/infra/database/prisma.service';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshTokenDto,
  TokensResponseDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser, Public } from './decorators';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  // 10 tentativas por minuto por conta (IP + e-mail); o teto por IP só barra varredura
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica com e-mail e senha' })
  @ApiOkResponse({ type: TokensResponseDto })
  @ApiUnauthorizedResponse({
    description: 'E-mail ou senha inválidos, ou usuário desativado',
  })
  @ApiTooManyRequestsResponse({
    description: 'Muitas tentativas; aguarde 1 minuto',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @Public()
  @UseGuards(ThrottlerGuard)
  // A equipe inteira sai pelo mesmo IP da empresa e renova a sessão ao abrir o app no início
  // do expediente. O token assinado já protege a rota; o limite só barra abuso.
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @SkipThrottle({ account: true })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Troca um refresh token válido por um novo par de tokens',
  })
  @ApiOkResponse({ type: TokensResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Refresh token inválido ou expirado',
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: employeeSelect,
    });
  }

  @Post('password')
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ account: true })
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Troca a própria senha',
    description: 'Invalida todos os tokens anteriores e devolve um novo par.',
  })
  @ApiOkResponse({ type: TokensResponseDto })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changeOwnPassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
