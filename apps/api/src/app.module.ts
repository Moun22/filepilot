import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProcedureTypesModule } from './procedure-types/procedure-types.module';
import { DossiersModule } from './dossiers/dossiers.module';
import { FilesModule } from './files/files.module';
import { ExportsModule } from './exports/exports.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProcedureTypesModule,
    DossiersModule,
    FilesModule,
    ExportsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
