import * as pkginfo from 'pkginfo';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppService } from '@achievibit/app.service';

pkginfo(module);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useStaticAssets(join(__dirname, './frontend/public'));
  app.setBaseViewsDir(join(__dirname, './frontend/views'));
  app.setViewEngine('hbs');

  const options = new DocumentBuilder()
    .setTitle(module.exports.name)
    .setDescription('achievibit API endpoints')
    .setVersion(module.exports.version)
    .setContactEmail(module.exports.author)
    // .setHost('https://achievibit.kibibit.io')
    .setLicense(module.exports.license, '')
    .build();
  const document = SwaggerModule.createDocument(app, options);

  SwaggerModule.setup('api', app, document, {
    customSiteTitle: `kibibit - achievibit API documentation`,
    customCss: readFileSync(join(__dirname, './frontend/public/styles/swagger.css'), 'utf8'),
    customJs: '../scripts/swagger.js',
    customfavIcon: '../assets/favicons/favicon-32.png',
  });

  await app.listen(3000);
  AppService.printSplash(3000);
}
bootstrap();
