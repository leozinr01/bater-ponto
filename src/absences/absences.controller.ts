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
  AbsenceResponseDto,
  CreateAbsenceDto,
  ListAbsencesQueryDto,
} from './absences.dto';
import { AbsencesService } from './absences.service';

@ApiTags('Abonos e afastamentos')
@ApiBearerAuth()
@Controller('absences')
export class AbsencesController {
  constructor(private absencesService: AbsencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Abonos, atestados, férias e afastamentos que tocam o período',
    description:
      'Inclui os cancelados. Funcionários veem apenas os próprios; administradores podem filtrar por employeeId.',
  })
  @ApiOkResponse({ type: [AbsenceResponseDto] })
  @ApiForbiddenResponse({
    description: 'Funcionário consultando outro funcionário',
  })
  list(@CurrentUser() user: AuthUser, @Query() query: ListAbsencesQueryDto) {
    return this.absencesService.list(user, query);
  }

  @Post()
  @Roles(['ADMIN'])
  @ApiOperation({
    summary:
      'Lança abono, atestado, férias ou afastamento de dias inteiros (admin)',
    description:
      'Nos dias de trabalho cobertos não há horas previstas nem falta. Não pode se sobrepor a outro lançamento ativo.',
  })
  @ApiCreatedResponse({ type: AbsenceResponseDto })
  @ApiConflictResponse({ description: 'Sobreposição com outro lançamento' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAbsenceDto) {
    return this.absencesService.create(user, dto);
  }

  @Post(':id/cancel')
  @Roles(['ADMIN'])
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancela um lançamento (admin)',
    description: 'O lançamento é mantido no histórico como cancelado.',
  })
  @ApiOkResponse({ type: AbsenceResponseDto })
  @ApiConflictResponse({ description: 'Já cancelado' })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.absencesService.cancel(user, id);
  }
}
