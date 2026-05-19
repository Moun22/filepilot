import { Module } from '@nestjs/common';
import { ProcedureTypesController } from './procedure-types.controller';
import { ProcedureTypesService } from './procedure-types.service';

@Module({
  controllers: [ProcedureTypesController],
  providers: [ProcedureTypesService],
})
export class ProcedureTypesModule {}
