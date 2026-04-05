// src/modules/users/users.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../../../generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersRepository } from './users.repository';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const exists = await this.usersRepository.existsByEmail(dto.email);
    if (exists) {
      throw new ConflictException(`User with email '${dto.email}' already exists`);
    }

    const rounds = this.configService.get<number>('app.bcryptRounds') ?? 12;
    const hashedPassword = await bcrypt.hash(dto.password, rounds);

    return this.usersRepository.create({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
    });
  }

  async findAll(query: UserQueryDto): Promise<PaginatedResult<SafeUser>> {
    const { users, total } = await this.usersRepository.findMany({
      role: query.role,
      status: query.status,
      search: query.search,
      skip: query.skip,
      take: query.limit,
    });

    return paginate(users, total, query);
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    await this.findOne(id); // ensure exists

    return this.usersRepository.update(id, {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.role && { role: dto.role }),
      ...(dto.status !== undefined && { status: dto.status }),
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // ensure exists
    await this.usersRepository.softDelete(id);
  }
}
