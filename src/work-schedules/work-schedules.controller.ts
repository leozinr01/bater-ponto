import { Roles } from '@/auth/decorators';
import { ApiPaginatedResponse } from '@/common/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateWorkScheduleDto,
  ListWorkSchedulesQueryDto,
  UpdateWorkScheduleDto,
  WorkScheduleResponseDto,
} from './work-schedules.dto';
import { WorkSchedulesService } from './work-schedules.service';

@ApiTags('Jornadas de trabalho (admin)')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Apenas administradores' })
@Roles(['ADMIN'])
@Controller('work-schedules')
export class WorkSchedulesController {
  constructor(private workSchedulesService: WorkSchedulesService) {}

  @Post()
  @ApiOperation({
    summary: 'Cadastra uma jornada (horário, carga diária, dias e tolerâncias)',
  })
  @ApiCreatedResponse({ type: WorkScheduleResponseDto })
  create(@Body() dto: CreateWorkScheduleDto) {
    return this.workSchedulesService.create(dto);
  }

  @Get()
  @ApiPaginatedResponse(WorkScheduleResponseDto)
  list(@Query() query: ListWorkSchedulesQueryDto) {
    return this.workSchedulesService.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: WorkScheduleResponseDto })
  @ApiNotFoundResponse()
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.workSchedulesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza uma jornada',
    description:
      'A alteração vale a partir de hoje para os funcionários que usam a jornada: os dias anteriores continuam calculados com os valores antigos.',
  })
  @ApiOkResponse({ type: WorkScheduleResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkScheduleDto,
  ) {
    return this.workSchedulesService.update(id, dto);
  }
}
