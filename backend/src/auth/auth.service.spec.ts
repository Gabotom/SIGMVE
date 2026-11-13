import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { Role } from '../common/roles';

describe('AuthService', () => {
  const jwt: any = { signAsync: jest.fn().mockResolvedValue('token-falso') };
  const users: any = { findByEmailWithPassword: jest.fn(), create: jest.fn(), touchLogin: jest.fn() };
  const service = new AuthService(users, jwt);
  let passwordHash: string;
  beforeAll(async () => (passwordHash = await bcrypt.hash('Admin1234', 4)));
  beforeEach(() => jest.clearAllMocks());

  const user = (extra = {}) => ({ id: '1', email: 'a@sigmve.cl', fullName: 'Admin', role: Role.ADMIN, active: true, passwordHash, ...extra });

  it('login correcto entrega token y datos del usuario sin el hash', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user());
    const res = await service.login({ email: 'a@sigmve.cl', password: 'Admin1234' });
    expect(res.accessToken).toBe('token-falso');
    expect(res.user.role).toBe(Role.ADMIN);
    expect(res.user).not.toHaveProperty('passwordHash');
  });

  it('registra la fecha del último login', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user());
    await service.login({ email: 'a@sigmve.cl', password: 'Admin1234' });
    expect(users.touchLogin).toHaveBeenCalledWith('1');
  });

  it('rechaza una contraseña incorrecta', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user());
    await expect(service.login({ email: 'a@sigmve.cl', password: 'otraClave' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un correo inexistente con el mismo error que una clave incorrecta (no delata qué correos existen)', async () => {
    users.findByEmailWithPassword.mockResolvedValue(null);
    // Si el hash de relleno fuera inválido, bcrypt lanzaría otro error en vez de 401.
    await expect(service.login({ email: 'x@x.cl', password: 'Admin1234' })).rejects.toThrow(new UnauthorizedException('Credenciales inválidas'));
  });

  it('rechaza a un usuario desactivado aunque la clave sea correcta', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user({ active: false }));
    await expect(service.login({ email: 'a@sigmve.cl', password: 'Admin1234' })).rejects.toThrow('desactivado');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('register delega la creación en UsersService', async () => {
    users.create.mockResolvedValue({ id: '2' });
    await service.register({ email: 'op@sigmve.cl', password: 'Clave123', fullName: 'Operador', role: Role.OPERATOR });
    expect(users.create).toHaveBeenCalledWith('op@sigmve.cl', 'Clave123', 'Operador', Role.OPERATOR);
  });
});
