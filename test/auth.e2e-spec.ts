// test/auth.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';

/**
 * E2E tests for the Auth module.
 *
 * Prerequisites:
 *  - A running PostgreSQL instance pointing to TEST_DATABASE_URL
 *  - Run: npx prisma migrate dev --schema prisma/schema.prisma before tests
 *
 * The test database is cleaned before each test suite via PrismaService.cleanDatabase().
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.setGlobalPrefix('api');

    await app.init();

    prisma = app.get(PrismaService);
    await prisma.cleanDatabase();
  });

  afterAll(async () => {
    await prisma.cleanDatabase();
    await app.close();
  });

  // ─── Seed a test admin ────────────────────────────────────────────────────
  const testAdmin = {
    email: 'test.admin@e2e.com',
    password: 'TestAdmin@123',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'ADMIN',
  };

  describe('POST /api/v1/auth/login', () => {
    beforeAll(async () => {
      // Create via users endpoint requires admin token, so seed directly
      const bcrypt = await import('bcryptjs');
      await prisma.user.create({
        data: {
          ...testAdmin,
          email: testAdmin.email.toLowerCase(),
          password: await bcrypt.hash(testAdmin.password, 4), // lower rounds for speed
          role: 'ADMIN',
        },
      });
    });

    it('should return 200 and a JWT for valid credentials', async () => {
      const { body, status } = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testAdmin.email, password: testAdmin.password });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.tokenType).toBe('Bearer');
      expect(body.data.user.role).toBe('ADMIN');
      expect(body.data.user).not.toHaveProperty('password');
    });

    it('should return 401 for invalid password', async () => {
      const { body, status } = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testAdmin.email, password: 'WrongPass@1' });

      expect(status).toBe(401);
      expect(body.success).toBeUndefined();
    });

    it('should return 401 for non-existent user', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@e2e.com', password: 'SomePass@1' });

      expect(status).toBe(401);
    });

    it('should return 400 for malformed payload (missing fields)', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email' });

      expect(status).toBe(400);
    });

    it('should return 400 for extra unknown fields (whitelist enforcement)', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testAdmin.email, password: testAdmin.password, role: 'ADMIN' });

      expect(status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    let token: string;

    beforeAll(async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testAdmin.email, password: testAdmin.password });
      token = body.data.accessToken as string;
    });

    it('should return the current user profile with a valid token', async () => {
      const { body, status } = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(status).toBe(200);
      expect(body.data.email).toBe(testAdmin.email.toLowerCase());
      expect(body.data).not.toHaveProperty('password');
    });

    it('should return 401 when no token is provided', async () => {
      const { status } = await request(app.getHttpServer()).get('/api/v1/auth/profile');
      expect(status).toBe(401);
    });

    it('should return 401 for an invalid/tampered token', async () => {
      const { status } = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(status).toBe(401);
    });
  });
});
