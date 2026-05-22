import { Test, TestingModule } from '@nestjs/testing';
import { ProcedureTypesController } from './procedure-types.controller';
import { ProcedureTypesService } from './procedure-types.service';

describe('ProcedureTypesController', () => {
  let controller: ProcedureTypesController;
  let service: { findAll: jest.Mock };

  beforeEach(async () => {
    service = { findAll: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcedureTypesController],
      providers: [{ provide: ProcedureTypesService, useValue: service }],
    }).compile();
    controller = module.get<ProcedureTypesController>(ProcedureTypesController);
  });

  it('findAll delegates to the service', async () => {
    service.findAll.mockResolvedValue([{ id: 'o1', name: 'CAF' }]);
    const out = await controller.findAll();
    expect(service.findAll).toHaveBeenCalled();
    expect(out).toEqual([{ id: 'o1', name: 'CAF' }]);
  });
});
