import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '../common/roles';
import { NormalizeEmail, PASSWORD_MESSAGE, PASSWORD_REGEX, Trim } from '../common/transforms';

export class LoginDto {
  @ApiProperty({ example: 'admin@sigmve.cl' }) @NormalizeEmail() @IsEmail() email: string;
  // En el login no se aplica la política de clave: solo se compara contra el hash.
  @ApiProperty({ example: 'Admin1234' }) @IsString() @IsNotEmpty() @MaxLength(72) password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'operador@sigmve.cl' }) @NormalizeEmail() @IsEmail() email: string;
  @ApiProperty({ example: 'Clave1234' }) @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }) password: string;
  @ApiProperty({ example: 'Juan Pérez' }) @Trim() @IsString() @MinLength(3) @MaxLength(120) fullName: string;
  @ApiProperty({ enum: Role }) @IsEnum(Role) role: Role;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() currentPassword: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }) newPassword: string;
}
