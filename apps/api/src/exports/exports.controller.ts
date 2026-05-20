import { Controller, Post, Param, Res, Get } from '@nestjs/common';
import { Response } from 'express';
import { ExportsService } from './exports.service';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../auth/auth.guard';

@ApiBearerAuth()
@ApiTags('exports')
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('dossier/:dossierId/zip')
  @ApiOperation({ summary: 'Generate and download a ZIP export of a dossier' })
  async exportZip(
    @Param('dossierId') dossierId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.exportsService.generateZip(
      dossierId,
      user,
    );

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    stream.pipe(res);
  }

  @Get('dossier/:dossierId')
  @ApiOperation({ summary: 'List exports for a dossier' })
  listByDossier(
    @Param('dossierId') dossierId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exportsService.listByDossier(dossierId, user);
  }
}
