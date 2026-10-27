import { AuthUser, CurrentUser, Roles } from '@/auth/decorators';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateHourBankEntryDto,
  HourBankEntryResponseDto,
  HourBankQueryDto,
  HourBankResponseDto,
} from './hour-bank.dto';
import { HourBankService } from './hour-bank.service';

@ApiTags('Banco de horas')
@ApiBearerAuth()
@Controller('hour-bank')
export class HourBankController {
  constructor(private hourBankService: HourBankService) {}

  @Get()
  @ApiOperation({
    summary: 'Saldo e extrato mensal do banco de horas',
    description:
      'Acumulado desde o cadastro: extras − falta de horas − folgas de banco + ajustes. Funcionários veem apenas o próprio.',
  })
  @ApiOkResponse({ type: HourBankResponseDto })
  @ApiForbiddenResponse({
    description: 'Funcionário consultando outro funcionário',
  })
  statement(@CurrentUser() user: AuthUser, @Query() query: HourBankQueryDto) {
    return this.hourBankService.statement(user, query);
  }

  @Post('entries')
  @Roles(['ADMIN'])
  @ApiOperation({
    summary: 'Lança um ajuste no banco de horas (admin)',
    description:
      'Crédito (minutos positivos) ou débito (negativos), com justificativa. Ex.: horas extras pagas em folha.',
  })
  @ApiCreatedResponse({ type: HourBankEntryResponseDto })
  createEntry(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateHourBankEntryDto,
  ) {
    return this.hourBankService.createEntry(user, dto);
  }

  @Post('entries/:id/cancel')
  @Roles(['ADMIN'])
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancela um ajuste (admin)',
    description: 'O ajuste continua no extrato como cancelado.',
  })
  @ApiOkResponse({ type: HourBankEntryResponseDto })
  @ApiConflictResponse({ description: 'Já cancelado' })
  cancelEntry(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.hourBankService.cancelEntry(user, id);
  }
}
