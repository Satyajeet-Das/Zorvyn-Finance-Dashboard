// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  name: process.env.APP_NAME ?? 'FinanceDashboard',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()),
  throttleTtl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
}));
