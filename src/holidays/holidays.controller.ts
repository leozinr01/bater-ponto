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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateHolidayDto,
  HolidayResponseDto,
  ImportHolidaysResponseDto,
  YearQueryDto,
} from './holidays.dto';
import { HolidaysService } from './holidays.service';

@ApiTags('Feriados (admin)')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Apenas administradores' })
@Roles(['ADMIN'])
@Controller('holidays')
export class HolidaysController {
  constructor(private holidaysService: HolidaysService) {}

  @Get()
  @ApiOperation({ summary: 'Feriados do ano' })
  @ApiOkResponse({ type: [HolidayResponseDto] })
  list(@Query() query: YearQueryDto) {
    return this.holidaysService.list(query.year);
  }

  @Post()
  @ApiOperation({
    summary: 'Cadastra um feriado',
    description:
      'Num dia de trabalho, o feriado não gera falta e o tempo trabalhado conta como extra.',
  })
  @ApiCreatedResponse({ type: HolidayResponseDto })
  @ApiConflictResponse({ description: 'Já existe um feriado nesta data' })
  create(@Body() dto: CreateHolidayDto) {
    return this.holidaysService.create(dto);
  }

  @Post('national')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inclui os feriados nacionais do ano',
    description: 'Datas já cadastradas são mantidas como estão.',
  })
  @ApiOkResponse({ type: ImportHolidaysResponseDto })
  importNational(@Query() query: YearQueryDto) {
    return this.holidaysService.importNational(query.year);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove um feriado' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.holidaysService.remove(id);
  }
}
