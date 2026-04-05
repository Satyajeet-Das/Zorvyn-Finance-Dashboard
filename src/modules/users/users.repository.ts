// src/modules/users/users.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma, Role, User, UserStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../common/database/prisma.service';

export interface FindUsersOptions {
  role?: Role;
  status?: UserStatus;
  search?: string;
  skip?: number;
  take?: number;
}

type SafeUser = Omit<User, 'password'>;

const userSelect: Prisma.UserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  password: false,
};

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<SafeUser> {
    return this.prisma.user.create({
      data,
      select: userSelect,
    }) as Promise<SafeUser>;
  }

  async findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: userSelect,
    }) as Promise<SafeUser | null>;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  async findMany(options: FindUsersOptions): Promise<{ users: SafeUser[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(options.role && { role: options.role }),
      ...(options.status && { status: options.status }),
      ...(options.search && {
        OR: [
          { email: { contains: options.search, mode: 'insensitive' } },
          { firstName: { contains: options.search, mode: 'insensitive' } },
          { lastName: { contains: options.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        skip: options.skip ?? 0,
        take: options.take ?? 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users: users as SafeUser[], total };
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    }) as Promise<SafeUser>;
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    return !!user;
  }
}
