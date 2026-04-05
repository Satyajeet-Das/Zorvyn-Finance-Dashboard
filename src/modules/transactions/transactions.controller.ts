// src/modules/transactions/transactions.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a transaction',
    description: 'ADMIN and ANALYST can create transactions for themselves. VIEWER cannot create.',
  })
  @ApiCreatedResponse({ description: 'Transaction created' })
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
    @CurrentUser() user: Omit<User, 'password'>,
  ) {
    return this.transactionsService.create(createTransactionDto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List transactions',
    description:
      'ADMIN/ANALYST can view all and filter by userId. VIEWER sees only their own.',
  })
  @ApiOkResponse({ description: 'Paginated transactions list' })
  async findAll(
    @Query() query: TransactionQueryDto,
    @CurrentUser() user: Omit<User, 'password'>,
  ) {
    return this.transactionsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'Transaction found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Omit<User, 'password'>,
  ) {
    return this.transactionsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a transaction',
    description: 'ADMIN can update any. ANALYST/VIEWER can only update their own.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'Transaction updated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @CurrentUser() user: Omit<User, 'password'>,
  ) {
    return this.transactionsService.update(id, updateTransactionDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a transaction (soft delete)',
    description: 'ADMIN can delete any. ANALYST/VIEWER can only delete their own.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Transaction deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Omit<User, 'password'>,
  ) {
    return this.transactionsService.remove(id, user);
  }
}
