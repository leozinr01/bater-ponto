import { AuthUser, CurrentUser, Roles } from '@/auth/decorators';
import { ApiPaginatedResponse } from '@/common/swagger';
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
  CorrectionResponseDto,
  ListPunchesQueryDto,
  ManualPunchDto,
  PeriodQueryDto,
  PunchResponseDto,
  RegisterPunchResponseDto,
  ReplacePunchDto,
  ReportItemDto,
  ReportQueryDto,
  TimesheetResponseDto,
  TodayResponseDto,
  VoidPunchDto,
} from './punches.dto';
import { PunchesService } from './punches.service';

@ApiTags('Ponto')
@ApiBearerAuth()
@Controller('punches')
export class PunchesController {
  constructor(private punchesService: PunchesService) {}

  @Post()
  @ApiOperation({
    summary: 'Registra uma marcação do usuário autenticado',
    description:
      'O horário é sempre o do servidor. Não há tipo: a ordem cronológica define entrada/saída/intervalos.',
  })
  @ApiCreatedResponse({ type: RegisterPunchResponseDto })
  @ApiConflictResponse({
    description: 'Marcação duplicada em menos de 1 minuto',
  })
  register(@CurrentUser() user: AuthUser) {
    return this.punchesService.register(user);
  }

  @Get()
  @ApiOperation({
    summary: 'Histórico de marcações (inclui as desconsideradas por correção)',
    description:
      'Funcionários veem apenas as próprias. Administradores podem filtrar por employeeId.',
  })
  @ApiPaginatedResponse(PunchResponseDto)
  @ApiForbiddenResponse({
    description: 'Funcionário consultando outro funcionário',
  })
  list(@CurrentUser() user: AuthUser, @Query() query: ListPunchesQueryDto) {
    return this.punchesService.list(user, query);
  }

  @Get('timesheet')
  @ApiOperation({
    summary: 'Espelho de ponto do período',
    description:
      'Horas trabalhadas, intervalos, atrasos, horas extras e faltas por dia, conforme a jornada do funcionário. Máximo de 93 dias.',
  })
  @ApiOkResponse({ type: TimesheetResponseDto })
  @ApiForbiddenResponse({
    description: 'Funcionário consultando outro funcionário',
  })
  timesheet(@CurrentUser() user: AuthUser, @Query() query: PeriodQueryDto) {
    return this.punchesService.timesheet(user, query);
  }

  @Get('report')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Totais do período por funcionário (admin)' })
  @ApiPaginatedResponse(ReportItemDto)
  report(@Query() query: ReportQueryDto) {
    return this.punchesService.report(query);
  }

  @Get('today')
  @Roles(['ADMIN'])
  @ApiOperation({
    summary: 'Painel do dia: situação de cada funcionário ativo agora (admin)',
    description:
      'Trabalhando, em intervalo, encerrou, atrasado (passou do horário + tolerância sem marcar), ainda não chegou ou de folga.',
  })
  @ApiOkResponse({ type: TodayResponseDto })
  today() {
    return this.punchesService.today();
  }

  @Post('manual')
  @Roles(['ADMIN'])
  @ApiOperation({
    summary:
      'Correção: inclui uma marcação faltante, com justificativa (admin)',
  })
  @ApiCreatedResponse({ type: CorrectionResponseDto })
  createManual(@CurrentUser() user: AuthUser, @Body() dto: ManualPunchDto) {
    return this.punchesService.createManual(user, dto);
  }

  @Post(':id/void')
  @Roles(['ADMIN'])
  @HttpCode(200)
  @ApiOperation({
    summary: 'Correção: desconsidera uma marcação, com justificativa (admin)',
    description:
      'A marcação original é mantida e continua visível no histórico.',
  })
  @ApiOkResponse({ type: CorrectionResponseDto })
  @ApiConflictResponse({ description: 'Marcação já desconsiderada' })
  void(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidPunchDto,
  ) {
    return this.punchesService.void(user, id, dto.reason);
  }

  @Post(':id/replace')
  @Roles(['ADMIN'])
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Correção: troca o horário de uma marcação, com justificativa (admin)',
    description:
      'Desconsidera a original e inclui uma nova vinculada a ela, de forma atômica.',
  })
  @ApiOkResponse({ type: CorrectionResponseDto })
  @ApiConflictResponse({ description: 'Marcação já desconsiderada' })
  replace(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacePunchDto,
  ) {
    return this.punchesService.replace(user, id, dto);
  }
}
