import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';

async function bootstrap() {
  const logger = new Logger('Bootstrap', { timestamp: true });

  // 1. Load .env files FIRST
  const stage = process.env.STAGE || 'development';
  loadEnv({ path: `.env.${stage}.local`, override: true });
  loadEnv({ path: '.env' });

  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);

  const configService = app.get(ConfigService);

  // Setup TCP RPC microservice separately
  const port = configService.getOrThrow<number>('PORT');

  return { logger, port };
}
bootstrap()
  .then(({ logger, port }) => {
    logger.log(`HTTP server running on port ${port}`);
  })
  .catch((err) => {
    const logger = new Logger('Bootstrap', { timestamp: true });
    logger.error(err);
  });
