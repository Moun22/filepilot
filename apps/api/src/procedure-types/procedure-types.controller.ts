import { Controller, Get } from '@nestjs/common';
import { ProcedureTypesService } from './procedure-types.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('procedure-types')
@Controller('procedure-types')
export class ProcedureTypesController {
  constructor(private readonly procedureTypesService: ProcedureTypesService) {}

  @Get()
  @ApiOperation({ summary: 'List all procedure types grouped by organization' })
  findAll() {
    return this.procedureTypesService.findAll();
  }
}
