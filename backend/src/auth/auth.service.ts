import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';

// Hash de relleno: si el correo no existe igual se ejecuta un bcrypt.compare, así el tiempo de
// respuesta no delata qué correos están registrados (enumeración de usuarios).
const DUMMY_HASH = '$2a$10$ZoHYSWEim75D5TpZfj4XMe8noGwHi21GXPNkjG2bjGQjilcAwo.Oy';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const passwordOk = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk) throw new UnauthorizedException('Credenciales inválidas');
    if (!user.active) throw new UnauthorizedException('Usuario desactivado. Contacta al administrador');

    await this.users.touchLogin(user.id);
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    };
  }

  register(dto: RegisterDto) {
    return this.users.create(dto.email, dto.password, dto.fullName, dto.role);
  }
}
