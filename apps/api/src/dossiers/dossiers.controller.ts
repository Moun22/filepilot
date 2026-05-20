import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { DossiersService } from './dossiers.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../auth/auth.guard';

class CreateDossierDto {
  procedureTypeId!: string;
  title?: string;
}

class UpdateChecklistDto {
  status!: string;
}

@ApiBearerAuth()
@ApiTags('dossiers')
@Controller('dossiers')
export class DossiersController {
  constructor(private readonly dossiersService: DossiersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new dossier (generates checklist from template)',
  })
  create(@Body() body: CreateDossierDto, @CurrentUser() user: AuthUser) {
    return this.dossiersService.createDossier({
      ownerUserId: user.id,
      procedureTypeId: body.procedureTypeId,
      title: body.title,
    });
  }

  @Get()
  @ApiOperation({ summary: "List current user's dossiers" })
  findAll(@CurrentUser() user: AuthUser) {
    return this.dossiersService.findAllByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dossier details with checklist' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dossiersService.findOne(id, user);
  }

  @Patch(':id/checklist/:key')
  @ApiOperation({ summary: 'Update checklist item status (todo/ok/na)' })
  updateChecklist(
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() body: UpdateChecklistDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dossiersService.updateChecklistItem(id, key, body.status, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a dossier and all its content' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (!id) throw new ForbiddenException();
    return this.dossiersService.deleteDossier(id, user);
  }
}
