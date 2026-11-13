import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role, Roles, RolesGuard } from '../common/roles';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto, VehicleQueryDto } from './vehicle.dto';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private service: VehiclesService) {}

  @Get('summary') summary() { return this.service.summary(); }

  @Get() findAll(@Query() q: VehicleQueryDto) { return this.service.findAll(q); }

  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }

  @Roles(Role.ADMIN, Role.OPERATOR)
  @Post() create(@Body() dto: CreateVehicleDto) { return this.service.create(dto); }

  @Roles(Role.ADMIN, Role.OPERATOR)
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) { return this.service.update(id, dto); }

  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
