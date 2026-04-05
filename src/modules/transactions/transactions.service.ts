// src/modules/transactions/transactions.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, Transaction, User } from '../../../generated/prisma/client';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsRepository } from './transactions.repository';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class TransactionsService {
  constructor(private readonly transactionsRepository: TransactionsRepository) {}

  async create(dto: CreateTransactionDto, currentUser: SafeUser): Promise<Transaction> {
    return this.transactionsRepository.create({
      amount: dto.amount,
      type: dto.type,
      category: dto.category,
      date: new Date(dto.date),
      notes: dto.notes,
      user: { connect: { id: currentUser.id } },
    });
  }

  async findAll(
    query: TransactionQueryDto,
    currentUser: SafeUser,
  ): Promise<PaginatedResult<Transaction>> {
    // Viewers and analysts can only see their own transactions
    // Admins can see all, or filter by userId
    const scopedUserId =
      currentUser.role === Role.ADMIN || currentUser.role === Role.ANALYST
        ? query.userId
        : currentUser.id;

    const { transactions, total } = await this.transactionsRepository.findMany({
      userId: scopedUserId,
      type: query.type,
      category: query.category,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      amountMin: query.amountMin,
      amountMax: query.amountMax,
      skip: query.skip,
      take: query.limit,
    });

    return paginate(transactions, total, query);
  }

  async findOne(id: string, currentUser: SafeUser): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findById(id);
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID '${id}' not found`);
    }

    // Viewers can only access their own transactions
    if (
      currentUser.role === Role.VIEWER &&
      transaction.userId !== currentUser.id
    ) {
      throw new ForbiddenException('You do not have access to this transaction');
    }

    return transaction;
  }

  async update(
    id: string,
    dto: UpdateTransactionDto,
    currentUser: SafeUser,
  ): Promise<Transaction> {
    const transaction = await this.findOne(id, currentUser);

    // Only Admins or the transaction owner can update
    if (
      currentUser.role !== Role.ADMIN &&
      transaction.userId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only update your own transactions');
    }

    return this.transactionsRepository.update(id, {
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.type && { type: dto.type }),
      ...(dto.category && { category: dto.category }),
      ...(dto.date && { date: new Date(dto.date) }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
  }

  async remove(id: string, currentUser: SafeUser): Promise<void> {
    const transaction = await this.findOne(id, currentUser);

    // Only Admins or the owner can delete
    if (
      currentUser.role !== Role.ADMIN &&
      transaction.userId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only delete your own transactions');
    }

    await this.transactionsRepository.softDelete(id);
  }
}
