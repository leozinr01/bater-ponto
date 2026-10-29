import { Roles } from '@/auth/decorators';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WorkplaceDto, WorkplaceResponseDto } from './workplaces.dto';
import { WorkplacesService } from './workplaces.service';

@ApiTags('Locais de trabalho (admin)')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Apenas administradores' })
@Roles(['ADMIN'])
@Controller('workplaces')
export class WorkplacesController {
  constructor(private workplacesService: WorkplacesService) {}

  @Get()
  @ApiOperation({ summary: 'Locais de trabalho' })
  @ApiOkResponse({ type: [WorkplaceResponseDto] })
  list() {
    return this.workplacesService.list();
  }

  @Post()
  @ApiOperation({
    summary: 'Cadastra um local de trabalho',
    description:
      'Marcações fora do raio de todos os locais recebem o alerta "fora do local". Nenhuma marcação é recusada.',
  })
  @ApiCreatedResponse({ type: WorkplaceResponseDto })
  create(@Body() dto: WorkplaceDto) {
    return this.workplacesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Altera um local de trabalho',
    description: 'Vale para as próximas marcações; as anteriores não mudam.',
  })
  @ApiOkResponse({ type: WorkplaceResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: WorkplaceDto) {
    return this.workplacesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove um local de trabalho' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workplacesService.remove(id);
  }
}
