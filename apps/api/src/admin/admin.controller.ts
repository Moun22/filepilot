import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CurrentUser, AuthUser, Roles } from '../auth/auth.guard';

class UpdateRoleDto {
  role!: string;
}

@ApiBearerAuth()
@ApiTags('admin')
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Global counters for the admin dashboard' })
  stats() {
    return this.adminService.stats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: "Update a user's role (user | admin)" })
  updateRole(
    @Param('id') id: string,
    @Body() body: UpdateRoleDto,
    @CurrentUser() me: AuthUser,
  ) {
    return this.adminService.setUserRole(id, body.role, me.id);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user and all their content' })
  deleteUser(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.adminService.deleteUser(id, me.id);
  }

  @Get('dossiers')
  @ApiOperation({ summary: 'List all dossiers across users' })
  listAllDossiers() {
    return this.adminService.listAllDossiers();
  }
}
