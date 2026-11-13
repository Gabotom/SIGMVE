import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role, Roles, RolesGuard } from '../common/roles';
import { MaintenancesService } from './maintenances.service';
import { CreateMaintenanceDto, MaintenanceQueryDto, UpdateMaintenanceDto } from './maintenance.dto';

@ApiTags('maintenances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maintenances')
export class MaintenancesController {
  constructor(private service: MaintenancesService) {}

  @Get('costs') costs() { return this.service.costsByVehicle(); }

  @Get() findAll(@Query() q: MaintenanceQueryDto) { return this.service.findAll(q); }

  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }

  @Roles(Role.ADMIN, Role.OPERATOR)
  @Post() create(@Body() dto: CreateMaintenanceDto) { return this.service.create(dto); }

  @Roles(Role.ADMIN, Role.OPERATOR)
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMaintenanceDto) { return this.service.update(id, dto); }

  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
