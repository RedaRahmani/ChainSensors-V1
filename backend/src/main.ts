import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SolanaService } from './solana/solana.service';

function splitEnvList(v?: string) {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Allowed origins: localhost (dev), your Vercel URL, plus anything in CORS_ORIGIN
  const defaultOrigins = [
    'http://localhost:3000',
    'https://chain-sensors-v1.vercel.app',
  ];
  const extraOrigins = splitEnvList(process.env.CORS_ORIGIN);
  const origins = Array.from(new Set([...defaultOrigins, ...extraOrigins]));

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  const solanaService = app.get(SolanaService);
  try {
    await solanaService.initializeMarketplace();
  } catch (error) {
    console.error('Marketplace initialization error:', error);
  }

  const port = Number(process.env.PORT) || 3003;
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on ${port}. CORS: ${origins.join(', ')}`);
}
bootstrap();
