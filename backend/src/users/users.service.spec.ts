import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { Role } from '../common/roles';

describe('UsersService', () => {
  const qb: any = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn() };
  const repo: any = {
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ ...v, id: v.id ?? '1', createdAt: new Date() })),
    createQueryBuilder: jest.fn(() => qb),
  };
  const config: any = { get: jest.fn((_k: string, d: any) => d) };
  const service = new UsersService(repo, config);
  beforeEach(() => jest.clearAllMocks());

  it('guarda la contraseña cifrada y no la devuelve', async () => {
    repo.findOne.mockResolvedValue(null);
    const res: any = await service.create('u@sigmve.cl', 'Clave123', 'Usuario', Role.VIEWER);
    expect(res).not.toHaveProperty('passwordHash');
    const saved = repo.save.mock.calls[0][0];
    expect(saved.passwordHash).toBeDefined();
    expect(saved.passwordHash).not.toBe('Clave123');
  });

  it('guarda el correo normalizado en minúsculas', async () => {
    repo.findOne.mockResolvedValue(null);
    await service.create('  Op@SIGMVE.cl ', 'Clave123', 'Operador', Role.OPERATOR);
    expect(repo.save.mock.calls[0][0].email).toBe('op@sigmve.cl');
  });

  it('rechaza un correo ya registrado', async () => {
    repo.findOne.mockResolvedValue({ id: '9' });
    await expect(service.create('u@sigmve.cl', 'Clave123', 'Usuario', Role.VIEWER)).rejects.toBeInstanceOf(ConflictException);
  });

  it('crea el administrador inicial cuando no hay usuarios', async () => {
    repo.count.mockResolvedValue(0);
    repo.findOne.mockResolvedValue(null);
    await service.onModuleInit();
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save.mock.calls[0][0].role).toBe(Role.ADMIN);
  });

  it('no crea administrador si ya existen usuarios', async () => {
    repo.count.mockResolvedValue(3);
    await service.onModuleInit();
    expect(repo.save).not.toHaveBeenCalled();
  });

  describe('update (administración)', () => {
    it('un admin no puede desactivarse a sí mismo', async () => {
      repo.findOne.mockResolvedValue({ id: 'a1', role: Role.ADMIN, active: true });
      await expect(service.update('a1', { active: false }, 'a1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un admin no puede quitarse el rol de administrador', async () => {
      repo.findOne.mockResolvedValue({ id: 'a1', role: Role.ADMIN, active: true });
      await expect(service.update('a1', { role: Role.VIEWER }, 'a1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un admin puede desactivar a otro usuario', async () => {
      repo.findOne.mockResolvedValue({ id: 'u2', role: Role.OPERATOR, active: true });
      const res = await service.update('u2', { active: false }, 'a1');
      expect(res.active).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('cambia la clave si la actual es correcta', async () => {
      qb.getOne.mockResolvedValue({ id: 'u1', passwordHash: await bcrypt.hash('Clave123', 4) });
      await service.changePassword('u1', 'Clave123', 'Nueva1234');
      const newHash = repo.update.mock.calls[0][1].passwordHash;
      expect(await bcrypt.compare('Nueva1234', newHash)).toBe(true);
    });

    it('rechaza si la clave actual es incorrecta', async () => {
      qb.getOne.mockResolvedValue({ id: 'u1', passwordHash: await bcrypt.hash('Clave123', 4) });
      await expect(service.changePassword('u1', 'Otra1234', 'Nueva1234')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('rechaza si la nueva es igual a la actual', async () => {
      qb.getOne.mockResolvedValue({ id: 'u1', passwordHash: await bcrypt.hash('Clave123', 4) });
      await expect(service.changePassword('u1', 'Clave123', 'Clave123')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
