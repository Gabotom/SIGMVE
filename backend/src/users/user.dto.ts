import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '../common/roles';
import { Trim } from '../common/transforms';

/** Lo que un administrador puede modificar de otro usuario. */
export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MinLength(3) @MaxLength(120) fullName?: string;
  @ApiPropertyOptional({ enum: Role }) @IsOptional() @IsEnum(Role) role?: Role;
  @ApiPropertyOptional({ description: 'false = usuario desactivado (no puede iniciar sesión)' })
  @IsOptional() @IsBoolean() active?: boolean;
}
