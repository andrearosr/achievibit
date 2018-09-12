import { Module } from '@nestjs/common';
import { KibibitLogger } from './logger.service';

@Module({
  providers: [KibibitLogger]
})
export class SharedModule {}
