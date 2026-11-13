import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AlertSeverity, AlertStatus, AlertType } from './alert.entity';
import { Trim } from '../common/transforms';

/** Filtros de GET /alerts. Sin status ni all=true, devuelve solo las vivas (activa y reconocida). */
export class AlertQueryDto {
  @ApiPropertyOptional({ enum: AlertStatus }) @IsOptional() @IsEnum(AlertStatus) status?: AlertStatus;
  @ApiPropertyOptional({ enum: AlertType }) @IsOptional() @IsEnum(AlertType) type?: AlertType;
  @ApiPropertyOptional({ enum: AlertSeverity }) @IsOptional() @IsEnum(AlertSeverity) severity?: AlertSeverity;
  @ApiPropertyOptional() @IsOptional() @IsUUID() vehicleId?: string;
  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'true incluye también las resueltas' })
  @IsOptional() @IsIn(['true', 'false']) all?: string;
}

export class AcknowledgeAlertDto {
  @ApiPropertyOptional({ example: 'Se coordinó con el taller para el lunes' })
  @IsOptional() @Trim() @IsString() @MaxLength(500) note?: string;
}
