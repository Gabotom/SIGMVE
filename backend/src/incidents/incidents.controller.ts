import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role, Roles, RolesGuard } from '../common/roles';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { IncidentsService } from './incidents.service';
import {
  ChangeIncidentStatusDto,
  CreateIncidentDto,
  CreateMaintenanceFromIncidentDto,
  IncidentQueryDto,
  UpdateIncidentDto,
} from './incident.dto';

@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private service: IncidentsService) {}

  @ApiOperation({ summary: 'Incidencias abiertas por severidad (dashboard)' })
  @Get('summary') summary() { return this.service.summary(); }

  @Get() findAll(@Query() q: IncidentQueryDto) { return this.service.findAll(q); }

  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }

  @ApiOperation({ summary: 'Reportar una incidencia. Si es crítica, el vehículo queda fuera de servicio' })
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Post() create(@Body() dto: CreateIncidentDto, @CurrentUser() user: AuthUser) { return this.service.create(dto, user); }

  @Roles(Role.ADMIN, Role.OPERATOR)
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIncidentDto) { return this.service.update(id, dto); }

  @ApiOperation({ summary: 'Cambiar estado (resolver/descartar exige resolución)' })
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Patch(':id/status')
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeIncidentStatusDto, @CurrentUser() user: AuthUser) {
    return this.service.changeStatus(id, dto, user);
  }

  @ApiOperation({ summary: 'Generar mantención correctiva desde la incidencia' })
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Post(':id/maintenance')
  createMaintenance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMaintenanceFromIncidentDto) {
    return this.service.createMaintenance(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
