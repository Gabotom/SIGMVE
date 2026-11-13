import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { MaintenanceStatus, MaintenanceType } from './maintenance.entity';
import { Trim } from '../common/transforms';

/** Al crear se puede registrar una mantención ya hecha (completada), pero no una cancelada. */
const CREATE_STATUSES = [MaintenanceStatus.PROGRAMADA, MaintenanceStatus.EN_PROCESO, MaintenanceStatus.COMPLETADA];

export class CreateMaintenanceDto {
  @ApiProperty() @IsUUID() vehicleId: string;
  @ApiProperty({ enum: MaintenanceType }) @IsEnum(MaintenanceType) type: MaintenanceType;
  @ApiProperty({ example: 'Cambio de aceite y filtros' }) @Trim() @IsString() @MinLength(3) @MaxLength(500) description: string;
  @ApiProperty({ example: '2026-10-20' }) @IsDateString({ strict: true }) scheduledDate: string;
  @ApiPropertyOptional({ example: 85000 }) @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) cost?: number;
  @ApiPropertyOptional({ enum: CREATE_STATUSES }) @IsOptional() @IsIn(CREATE_STATUSES) status?: MaintenanceStatus;
  @ApiPropertyOptional({ example: '2026-10-21' }) @IsOptional() @IsDateString({ strict: true }) completedDate?: string;
}

export class UpdateMaintenanceDto extends PartialType(OmitType(CreateMaintenanceDto, ['vehicleId', 'status'] as const)) {
  @ApiPropertyOptional({ enum: MaintenanceStatus }) @IsOptional() @IsEnum(MaintenanceStatus) status?: MaintenanceStatus;
}

/** Filtros de GET /maintenances. Antes ?vehicleId=abc provocaba un 500. */
export class MaintenanceQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() vehicleId?: string;
  @ApiPropertyOptional({ enum: MaintenanceStatus }) @IsOptional() @IsEnum(MaintenanceStatus) status?: MaintenanceStatus;
  @ApiPropertyOptional({ enum: MaintenanceType }) @IsOptional() @IsEnum(MaintenanceType) type?: MaintenanceType;
}
