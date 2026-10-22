import { AuthUser, CurrentUser, Roles } from '@/auth/decorators';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateEmployeeDto,
  EmployeeResponseDto,
  ListEmployeesQueryDto,
  ResetPasswordDto,
  UpdateEmployeeDto,
} from './employees.dto';
import { EmployeesService } from './employees.service';
import { ApiPaginatedResponse } from '@/common/swagger';

@ApiTags('Funcionários (admin)')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Apenas administradores' })
@ApiExtraModels(EmployeeResponseDto)
@Roles(['ADMIN'])
@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um funcionário ou administrador' })
  @ApiCreatedResponse({ type: EmployeeResponseDto })
  @ApiConflictResponse({ description: 'E-mail já cadastrado' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista funcionários com filtros e paginação' })
  @ApiPaginatedResponse(EmployeeResponseDto)
  list(@Query() query: ListEmployeesQueryDto) {
    return this.employeesService.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiNotFoundResponse()
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza dados, papel, jornada ou status',
    description:
      'Funcionários não são excluídos: use active=false para desativar o acesso.',
  })
  @ApiOkResponse({ type: EmployeeResponseDto })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(actor.id, id, dto);
  }

  @Post(':id/password')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Redefine a senha (invalida as sessões do funcionário)',
  })
  @ApiNoContentResponse()
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.employeesService.resetPassword(id, dto.password);
  }
}
