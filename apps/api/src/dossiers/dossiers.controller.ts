import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { DossiersService } from './dossiers.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

class CreateDossierDto {
  ownerUserId!: string;
  procedureTypeId!: string;
  title?: string;
}

class UpdateChecklistDto {
  status!: string; // todo | ok | na
}

@ApiTags('dossiers')
@Controller('dossiers')
export class DossiersController {
  constructor(private readonly dossiersService: DossiersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new dossier (generates checklist from template)',
  })
  create(@Body() body: CreateDossierDto) {
    return this.dossiersService.createDossier({
      ownerUserId: body.ownerUserId,
      procedureTypeId: body.procedureTypeId,
      title: body.title,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List dossiers for a user' })
  findAll(@Query('userId') userId: string) {
    return this.dossiersService.findAllByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dossier details with checklist' })
  findOne(@Param('id') id: string) {
    return this.dossiersService.findOne(id);
  }

  @Patch(':id/checklist/:key')
  @ApiOperation({ summary: 'Update checklist item status (todo/ok/na)' })
  updateChecklist(
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() body: UpdateChecklistDto,
  ) {
    return this.dossiersService.updateChecklistItem(id, key, body.status);
  }
}
