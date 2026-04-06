// src/config/redis.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  username: process.env.REDIS_USERNAME ?? '',
  password: process.env.REDIS_PASSWORD ?? '',
  ttl: parseInt(process.env.REDIS_TTL ?? '300', 10),
}));
