// src/modules/transactions/transactions.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma, Transaction, TransactionType } from '../../../generated/prisma/client';
import { PrismaService } from '../../common/database/prisma.service';

export interface FindTransactionsOptions {
  userId?: string;
  type?: TransactionType;
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  skip?: number;
  take?: number;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
}

export interface CategoryTotal {
  category: string;
  type: TransactionType;
  total: number;
  count: number;
}

export interface MonthlyTrend {
  year: number;
  month: number;
  income: number;
  expenses: number;
  net: number;
}

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(options: FindTransactionsOptions): Prisma.TransactionWhereInput {
    return {
      deletedAt: null,
      ...(options.userId && { userId: options.userId }),
      ...(options.type && { type: options.type }),
      ...(options.category && { category: { contains: options.category, mode: 'insensitive' } }),
      ...((options.dateFrom || options.dateTo) && {
        date: {
          ...(options.dateFrom && { gte: options.dateFrom }),
          ...(options.dateTo && { lte: options.dateTo }),
        },
      }),
      ...((options.amountMin !== undefined || options.amountMax !== undefined) && {
        amount: {
          ...(options.amountMin !== undefined && { gte: options.amountMin }),
          ...(options.amountMax !== undefined && { lte: options.amountMax }),
        },
      }),
    };
  }

  async create(data: Prisma.TransactionCreateInput): Promise<Transaction> {
    return this.prisma.transaction.create({ data });
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({
      where: { id, deletedAt: null },
    });
  }

  async findMany(
    options: FindTransactionsOptions,
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const where = this.buildWhere(options);

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        skip: options.skip ?? 0,
        take: options.take ?? 20,
        orderBy: { date: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { transactions, total };
  }

  async update(id: string, data: Prisma.TransactionUpdateInput): Promise<Transaction> {
    return this.prisma.transaction.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getSummary(options: Omit<FindTransactionsOptions, 'skip' | 'take'>): Promise<TransactionSummary> {
    const where = this.buildWhere(options);

    const result = await this.prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    let totalIncome = 0;
    let totalExpenses = 0;
    let transactionCount = 0;

    for (const row of result) {
      const amount = Number(row._sum.amount ?? 0);
      transactionCount += row._count.id;
      if (row.type === TransactionType.INCOME) {
        totalIncome = amount;
      } else {
        totalExpenses = amount;
      }
    }

    return {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      transactionCount,
    };
  }

  async getCategoryTotals(
    options: Omit<FindTransactionsOptions, 'skip' | 'take'>,
  ): Promise<CategoryTotal[]> {
    const where = this.buildWhere(options);

    const result = await this.prisma.transaction.groupBy({
      by: ['category', 'type'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    return result.map((row) => ({
      category: row.category,
      type: row.type,
      total: Number(row._sum.amount ?? 0),
      count: row._count.id,
    }));
  }

  async getMonthlyTrends(
    options: Omit<FindTransactionsOptions, 'skip' | 'take'>,
    months = 12,
  ): Promise<MonthlyTrend[]> {
    const dateFrom = new Date();
    dateFrom.setMonth(dateFrom.getMonth() - months + 1);
    dateFrom.setDate(1);
    dateFrom.setHours(0, 0, 0, 0);

    const where = this.buildWhere({ ...options, dateFrom });

    const raw = await this.prisma.$queryRaw<
      Array<{ year: number; month: number; type: TransactionType; total: number }>
    >`
      SELECT
        EXTRACT(YEAR FROM date)::int AS year,
        EXTRACT(MONTH FROM date)::int AS month,
        type,
        SUM(amount)::float AS total
      FROM transactions
      WHERE ${Prisma.raw(
        Object.entries(where)
          .filter(([, v]) => v !== undefined)
          .map(() => 'TRUE')
          .join(' AND '),
      )} deleted_at IS NULL
      GROUP BY year, month, type
      ORDER BY year ASC, month ASC
    `;

    // Build a map for quick lookup
    const map = new Map<string, MonthlyTrend>();
    for (const row of raw) {
      const key = `${row.year}-${row.month}`;
      if (!map.has(key)) {
        map.set(key, { year: row.year, month: row.month, income: 0, expenses: 0, net: 0 });
      }
      const entry = map.get(key)!;
      if (row.type === TransactionType.INCOME) {
        entry.income = row.total;
      } else {
        entry.expenses = row.total;
      }
      entry.net = entry.income - entry.expenses;
    }

    return Array.from(map.values());
  }

  async getRecentTransactions(userId?: string, limit = 10): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { deletedAt: null, ...(userId && { userId }) },
      orderBy: { date: 'desc' },
      take: limit,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }
}
