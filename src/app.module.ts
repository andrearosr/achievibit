import { Module } from '@nestjs/common';
import { AppController } from '@achievibit/app.controller';
import { AppService } from '@achievibit/app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
