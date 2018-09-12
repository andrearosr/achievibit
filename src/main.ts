import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from '@achievibit/app.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  AppService.printSplash(3000);
}
bootstrap();
