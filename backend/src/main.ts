import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SolanaService } from './solana/solana.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Initialize marketplace on Solana (runs once)
  const solanaService = app.get(SolanaService);
  try {
    await solanaService.initializeMarketplace();
  } catch (error) {
    console.error('Marketplace initialization error:', error);
  }

  await app.listen(3001);
  console.log('Application listening on port 3000');
}
bootstrap();
