import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role, Roles, RolesGuard } from '../common/roles';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './user.dto';

/** Administración de usuarios (solo admin). El alta sigue en POST /auth/register. */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get() findAll() { return this.users.findAll(); }

  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.users.findOne(id); }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.update(id, dto, actor.userId);
  }
}
