import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role, Roles, RolesGuard } from '../common/roles';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AlertsService } from './alerts.service';
import { AcknowledgeAlertDto, AlertQueryDto } from './alert.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private service: AlertsService) {}

  @ApiOperation({ summary: 'Alertas vivas por severidad y tipo (dashboard y contador de la campana)' })
  @Get('summary') summary() { return this.service.summary(); }

  @ApiOperation({ summary: 'Listado; por defecto solo las vivas (activa y reconocida), críticas primero' })
  @Get() findAll(@Query() q: AlertQueryDto) { return this.service.findAll(q); }

  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }

  @ApiOperation({ summary: 'Reconocer una alerta (queda registrado quién y cuándo)' })
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Patch(':id/acknowledge')
  acknowledge(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AcknowledgeAlertDto, @CurrentUser() user: AuthUser) {
    return this.service.acknowledge(id, dto, user);
  }

  @ApiOperation({ summary: 'Forzar la evaluación de reglas ahora' })
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @Post('evaluate') evaluate() { return this.service.evaluate(); }
}
