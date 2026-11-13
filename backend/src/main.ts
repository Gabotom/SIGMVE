import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DbExceptionFilter } from './common/db-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // Solo los orígenes del frontend (Angular :4200, Ionic :8100) en vez de CORS abierto a cualquiera.
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:4200,http://localhost:8100').split(',').map((o) => o.trim()),
  });
  // forbidNonWhitelisted: un campo no declarado en el DTO (p. ej. "isAdmin": true) responde 400 en vez de ignorarse en silencio.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new DbExceptionFilter());

  const swagger = new DocumentBuilder()
    .setTitle('SIGMVE API')
    .setDescription('Sistema Inteligente de Gestión, Mantención y Disponibilidad de Vehículos de Emergencia')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = +config.get('PORT', 3000);
  await app.listen(port);
  console.log(`SIGMVE API en http://localhost:${port}/api  |  Swagger en http://localhost:${port}/api/docs`);
}
bootstrap();
