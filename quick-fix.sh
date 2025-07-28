#!/bin/bash
# Quick Fix Script for ChainSensors QC Issues
# Run this to address immediate code quality problems

echo "🔧 ChainSensors Quick Fix Script"
echo "================================"

# Navigate to project root
cd /home/oussama/chainsensorWork/ChainSensors-V1

echo "📦 1. Fixing package.json names..."
# Fix frontend package name
sed -i 's/"my-v0-project"/"chainsensors-frontend"/' frontend/package.json

echo "🧹 2. Cleaning up deprecated scripts..."
# Remove deprecated metadata scripts
rm -f backend/src/scripts/register-metadata-simple.ts
rm -f backend/src/scripts/quick-update.ts  
rm -f backend/src/scripts/working-update.ts

echo "🔍 3. Fixing critical ESLint errors..."
cd backend

# Fix unused imports in app.module.ts
echo "Fixing app.module.ts..."
cat > src/app.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './configuration';

// Import all modules
import { AuthModule } from './auth/auth.module';
import { BrokerModule } from './broker/broker.module';
import { DpsModule } from './dps/dps.module';
import { IngestModule } from './ingest/ingest.module';
import { ListingModule } from './listing/listing.module';
import { RatingModule } from './rating/rating.module';
import { ReadingModule } from './reading/reading.module';
import { RegistryModule } from './registry/registry.module';
import { RewardsModule } from './rewards/rewards.module';
import { SolanaModule } from './solana/solana.module';
import { UsersModule } from './users/users.module';
import { WalrusModule } from './walrus/walrus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        if (!uri) {
          throw new Error('MONGODB_URI environment variable is required');
        }
        console.log(
          `📦 Connecting to MongoDB: ${uri.replace(/\/\/.*@/, '//***@')}`,
        );
        return { uri };
      },
    }),
    AuthModule,
    BrokerModule,
    DpsModule,
    IngestModule,
    ListingModule,
    RatingModule,
    ReadingModule,
    RegistryModule,
    RewardsModule,
    SolanaModule,
    UsersModule,
    WalrusModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
EOF

echo "🧪 4. Creating basic test file..."
cat > src/app.controller.spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
EOF

echo "📝 5. Creating .eslintrc.js with proper configuration..."
cat > .eslintrc.js << 'EOF'
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    '@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
EOF

echo "✅ Quick fixes completed!"
echo ""
echo "📋 Next steps:"
echo "1. Run 'npm run lint' to check remaining issues"
echo "2. Run 'npm test' to verify basic functionality"
echo "3. Review the QC_REPORT.md for detailed analysis"
echo ""
echo "🎯 Critical fixes applied:"
echo "   ✅ Fixed package.json naming"
echo "   ✅ Removed deprecated scripts"
echo "   ✅ Fixed app.module.ts imports"
echo "   ✅ Added basic test file"
echo "   ✅ Improved ESLint configuration"
