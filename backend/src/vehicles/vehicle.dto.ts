import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { VehicleStatus, VehicleType } from './vehicle.entity';
import { Trim } from '../common/transforms';

const normalizePlate = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));
const MAX_YEAR = new Date().getFullYear() + 1;

/** en_mantencion no se asigna a mano: lo pone el sistema al iniciar una mantención. */
export const MANUAL_STATUSES = [VehicleStatus.DISPONIBLE, VehicleStatus.EN_EMERGENCIA, VehicleStatus.FUERA_DE_SERVICIO];

export class CreateVehicleDto {
  // Patente chilena: formato nuevo BBBB-12 / BBBB12 o antiguo AA-1234 / AA1234
  @ApiProperty({ example: 'ABCD-12' })
  @normalizePlate()
  @Matches(/^([A-Z]{4}-?\d{2}|[A-Z]{2}-?\d{4})$/, { message: 'Patente inválida (formatos válidos: ABCD-12 o AB-1234)' })
  plate: string;
  @ApiProperty({ enum: VehicleType }) @IsEnum(VehicleType) type: VehicleType;
  @ApiProperty({ example: 'Mercedes-Benz' }) @Trim() @IsString() @MinLength(1) @MaxLength(60) brand: string;
  @ApiProperty({ example: 'Atego' }) @Trim() @IsString() @MinLength(1) @MaxLength(60) model: string;
  @ApiProperty({ example: 2018 }) @IsInt() @Min(1980) @Max(MAX_YEAR) year: number;
  @ApiPropertyOptional({ example: 'Primera Compañía' }) @IsOptional() @Trim() @IsString() @MaxLength(100) station?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) mileage?: number;
  @ApiPropertyOptional({ enum: MANUAL_STATUSES })
  @IsOptional() @IsIn(MANUAL_STATUSES, { message: `status debe ser uno de: ${MANUAL_STATUSES.join(', ')}` })
  status?: VehicleStatus;
}
export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}

/** Filtros de GET /vehicles. Antes un ?status=xx inválido provocaba un 500 en PostgreSQL. */
export class VehicleQueryDto {
  @ApiPropertyOptional({ enum: VehicleStatus }) @IsOptional() @IsEnum(VehicleStatus) status?: VehicleStatus;
  @ApiPropertyOptional({ enum: VehicleType }) @IsOptional() @IsEnum(VehicleType) type?: VehicleType;
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(100) station?: string;
  @ApiPropertyOptional({ description: 'Busca en patente, marca y modelo' })
  @IsOptional() @Trim() @IsString() @MaxLength(60) search?: string;
}
