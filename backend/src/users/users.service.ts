import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { Role } from '../common/roles';
import { UpdateUserDto } from './user.dto';

export type SafeUser = Omit<User, 'passwordHash'>;
const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(@InjectRepository(User) private repo: Repository<User>, private config: ConfigService) {}

  // Crea el administrador inicial si no existe ningún usuario
  async onModuleInit() {
    if ((await this.repo.count()) === 0) {
      await this.create(
        this.config.get('ADMIN_EMAIL', 'admin@sigmve.cl'),
        this.config.get('ADMIN_PASSWORD', 'Admin1234'),
        'Administrador SIGMVE',
        Role.ADMIN,
      );
    }
  }

  async create(email: string, password: string, fullName: string, role: Role): Promise<SafeUser> {
    email = email.trim().toLowerCase();
    if (await this.repo.findOne({ where: { email } })) throw new ConflictException('El correo ya está registrado');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.repo.save(this.repo.create({ email, passwordHash, fullName: fullName.trim(), role }));
    return this.strip(user);
  }

  /** Solo para autenticación: incluye el hash, que por defecto no se selecciona. */
  findByEmailWithPassword(email: string) {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async findOne(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  /**
   * Actualización hecha por un administrador. Protege contra dejar el sistema sin administradores:
   * un admin no puede desactivarse ni quitarse el rol a sí mismo.
   */
  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.findOne(id);
    if (id === actorId && (dto.active === false || (dto.role && dto.role !== Role.ADMIN))) {
      throw new BadRequestException('No puedes desactivarte ni quitarte el rol de administrador a ti mismo');
    }
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    if (currentPassword === newPassword) throw new BadRequestException('La nueva contraseña debe ser distinta a la actual');
    await this.repo.update(id, { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) });
    return { updated: true };
  }

  async touchLogin(id: string) {
    await this.repo.update(id, { lastLoginAt: new Date() });
  }

  private strip(user: User): SafeUser {
    const { passwordHash: _omit, ...safe } = user;
    return safe;
  }
}
