import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Role, Roles, RolesGuard } from '../common/roles';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private users: UsersService) {}

  /** Limitado por IP (ver THROTTLE_LOGIN_* en .env) para frenar ataques de fuerza bruta. */
  @UseGuards(ThrottlerGuard)
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos de inicio de sesión' })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('register')
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  /** Perfil del usuario autenticado, leído desde la BD (no desde el token). */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) { return this.users.findOne(user.userId); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }
}
