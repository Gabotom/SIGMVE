import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { IncidentSeverity, IncidentStatus } from './incident.entity';
import { Trim } from '../common/transforms';

export class CreateIncidentDto {
  @ApiProperty() @IsUUID() vehicleId: string;
  @ApiProperty({ example: 'Falla en bomba de agua' }) @Trim() @IsString() @MinLength(5) @MaxLength(150) title: string;
  @ApiProperty({ example: 'La bomba no alcanza presión sobre 8 bar durante el ejercicio de la mañana.' })
  @Trim() @IsString() @MinLength(10) @MaxLength(2000) description: string;
  @ApiProperty({ enum: IncidentSeverity, description: 'critica deja el vehículo fuera_de_servicio automáticamente' })
  @IsEnum(IncidentSeverity) severity: IncidentSeverity;
  @ApiPropertyOptional({ example: 45200, description: 'Kilometraje al reportar; si es mayor al registrado, actualiza el vehículo' })
  @IsOptional() @IsInt() @Min(0) mileage?: number;
}

/** Corrección de datos de una incidencia abierta (el vehículo no se cambia: se reporta otra). */
export class UpdateIncidentDto extends PartialType(PickType(CreateIncidentDto, ['title', 'description', 'severity'] as const)) {}

export class ChangeIncidentStatusDto {
  @ApiProperty({ enum: IncidentStatus }) @IsEnum(IncidentStatus) status: IncidentStatus;
  @ApiPropertyOptional({ description: 'Obligatoria al resolver o descartar' })
  @ValidateIf((o) => o.status === IncidentStatus.RESUELTA || o.status === IncidentStatus.DESCARTADA)
  @Trim() @IsString() @MinLength(5, { message: 'Debes indicar la resolución (mínimo 5 caracteres) al resolver o descartar' }) @MaxLength(2000)
  resolution?: string;
}

/** Genera una mantención correctiva a partir de la incidencia. */
export class CreateMaintenanceFromIncidentDto {
  @ApiProperty({ example: '2026-10-20' }) @IsDateString({ strict: true }) scheduledDate: string;
  @ApiPropertyOptional({ description: 'Por defecto: título de la incidencia' })
  @IsOptional() @Trim() @IsString() @MinLength(3) @MaxLength(500) description?: string;
}

export class IncidentQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() vehicleId?: string;
  @ApiPropertyOptional({ enum: IncidentStatus }) @IsOptional() @IsEnum(IncidentStatus) status?: IncidentStatus;
  @ApiPropertyOptional({ enum: IncidentSeverity }) @IsOptional() @IsEnum(IncidentSeverity) severity?: IncidentSeverity;
  @ApiPropertyOptional({ description: 'true = solo abiertas o en atención' })
  @IsOptional() @IsEnum(['true', 'false']) open?: 'true' | 'false';
}
