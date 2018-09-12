import { Test, TestingModule } from '@nestjs/testing';
import { KibibitLogger } from './logger.service';

describe('LoggerService', () => {
  let service: KibibitLogger;
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KibibitLogger],
    }).compile();
    service = module.get<KibibitLogger>(KibibitLogger);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have the "log", "error", "warn", and "info" methods', () => {
    expect(service.log).toBeDefined();
    expect(service.error).toBeDefined();
    expect(service.warn).toBeDefined();
    expect(service.info).toBeDefined();
  });
});
