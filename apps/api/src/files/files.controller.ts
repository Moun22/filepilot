import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Response } from 'express';
import { FilesService } from './files.service';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../auth/auth.guard';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const uploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

@ApiBearerAuth()
@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiOperation({
    summary:
      'Upload a file (optionally attached to a checklist item via checklistItemId)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(uploadInterceptor)
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('dossierId') dossierId: string,
    @Body('checklistItemId') checklistItemId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!dossierId) throw new BadRequestException('dossierId is required');
    return this.filesService.createDocument(
      {
        dossierId,
        checklistItemId: checklistItemId || null,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: file.path,
      },
      user,
    );
  }

  @Put(':id/replace')
  @ApiOperation({
    summary: 'Replace the physical file of an existing document',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(uploadInterceptor)
  replace(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.filesService.replaceDocument(
      id,
      {
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: file.path,
      },
      user,
    );
  }

  @Get('dossier/:dossierId')
  @ApiOperation({ summary: 'List files for a dossier' })
  listByDossier(
    @Param('dossierId') dossierId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.filesService.listByDossier(dossierId, user);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a file' })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const doc = await this.filesService.findOne(id, user);
    res.download(doc.storagePath, doc.filename);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file' })
  deleteFile(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.filesService.deleteDocument(id, user);
  }
}
