import { Module } from '@nestjs/common';
import { AppController } from '@achievibit/app.controller';
import { AppService } from '@achievibit/app.service';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
