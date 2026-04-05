// src/modules/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { Role, User } from '../../../generated/prisma/client';
import {
  CategoryTotal,
  MonthlyTrend,
  TransactionSummary,
  TransactionsRepository,
} from '../transactions/transactions.repository';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

type SafeUser = Omit<User, 'password'>;

export interface DashboardOverview {
  summary: TransactionSummary;
  categoryTotals: CategoryTotal[];
  monthlyTrends: MonthlyTrend[];
  recentTransactions: unknown[];
}

@Injectable()
export class DashboardService {
  constructor(private readonly transactionsRepository: TransactionsRepository) {}

  private resolveScope(query: DashboardQueryDto, currentUser: SafeUser) {
    // Admins & Analysts can query across all users or filter by userId
    // Viewers are always scoped to themselves
    return currentUser.role === Role.VIEWER ? currentUser.id : query.userId;
  }

  async getOverview(query: DashboardQueryDto, currentUser: SafeUser): Promise<DashboardOverview> {
    const userId = this.resolveScope(query, currentUser);
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;

    const [summary, categoryTotals, monthlyTrends, recentTransactions] = await Promise.all([
      this.transactionsRepository.getSummary({ userId, dateFrom, dateTo }),
      this.transactionsRepository.getCategoryTotals({ userId, dateFrom, dateTo }),
      this.transactionsRepository.getMonthlyTrends({ userId }, query.trendMonths),
      this.transactionsRepository.getRecentTransactions(userId, 10),
    ]);

    return { summary, categoryTotals, monthlyTrends, recentTransactions };
  }

  async getSummary(query: DashboardQueryDto, currentUser: SafeUser): Promise<TransactionSummary> {
    const userId = this.resolveScope(query, currentUser);
    return this.transactionsRepository.getSummary({
      userId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });
  }

  async getCategoryBreakdown(
    query: DashboardQueryDto,
    currentUser: SafeUser,
  ): Promise<CategoryTotal[]> {
    const userId = this.resolveScope(query, currentUser);
    return this.transactionsRepository.getCategoryTotals({
      userId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });
  }

  async getMonthlyTrends(
    query: DashboardQueryDto,
    currentUser: SafeUser,
  ): Promise<MonthlyTrend[]> {
    const userId = this.resolveScope(query, currentUser);
    return this.transactionsRepository.getMonthlyTrends({ userId }, query.trendMonths);
  }

  async getRecentActivity(query: DashboardQueryDto, currentUser: SafeUser): Promise<unknown[]> {
    const userId = this.resolveScope(query, currentUser);
    return this.transactionsRepository.getRecentTransactions(userId, 20);
  }
}
