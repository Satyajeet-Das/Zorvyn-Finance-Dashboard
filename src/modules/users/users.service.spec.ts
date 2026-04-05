// src/modules/users/users.service.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, UserStatus } from '../../../generated/prisma/client';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const mockUser = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: Role.VIEWER,
  status: UserStatus.ACTIVE,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

const mockUsersRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  existsByEmail: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue(12),
};

describe('UsersService', () => {
  let service: UsersService;
  let repository: typeof mockUsersRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(UsersRepository);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      email: 'john.doe@example.com',
      password: 'SecurePass@123',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should create a user when email does not exist', async () => {
      repository.existsByEmail.mockResolvedValue(false);
      repository.create.mockResolvedValue(mockUser);

      const result = await service.create(createDto);

      expect(repository.existsByEmail).toHaveBeenCalledWith(createDto.email);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: createDto.email.toLowerCase(),
          firstName: createDto.firstName,
          lastName: createDto.lastName,
        }),
      );
      // Password should be hashed, not plain text
      expect(repository.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ password: createDto.password }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw ConflictException when email already exists', async () => {
      repository.existsByEmail.mockResolvedValue(true);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = [mockUser];
      repository.findMany.mockResolvedValue({ users, total: 1 });

      const query = { page: 1, limit: 20, skip: 0 } as any;
      const result = await service.findAll(query);

      expect(result.data).toEqual(users);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should pass filters to the repository', async () => {
      repository.findMany.mockResolvedValue({ users: [], total: 0 });

      const query = {
        page: 1,
        limit: 10,
        skip: 0,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        search: 'john',
      } as any;

      await service.findAll(query);

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
          search: 'john',
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a user when found', async () => {
      repository.findById.mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id);

      expect(repository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      const updatedUser = { ...mockUser, firstName: 'Jane' };
      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue(updatedUser);

      const result = await service.update(mockUser.id, { firstName: 'Jane' });

      expect(repository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ firstName: 'Jane' }),
      );
      expect(result.firstName).toBe('Jane');
    });

    it('should throw NotFoundException when updating non-existent user', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('bad-id', { firstName: 'Jane' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a user', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove(mockUser.id);

      expect(repository.softDelete).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw NotFoundException when deleting non-existent user', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});
