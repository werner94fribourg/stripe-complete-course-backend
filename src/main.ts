import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);

  const configService = app.get(ConfigService);

  // Setup TCP RPC microservice separately
  const port = configService.getOrThrow<number>('PORT');

  return { logger: new Logger('Bootstrap', { timestamp: true }), port };
}
bootstrap()
  .then(({ logger, port }) => {
    logger.log(`HTTP server running on port ${port}`);
  })
  .catch((err) => {
    const logger = new Logger('Bootstrap', { timestamp: true });
    logger.error(err);
  });
