// src/modules/transactions/dto/create-transaction.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '../../../../generated/prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ example: 2500.00, description: 'Amount (must be positive)' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amount must be a number with up to 2 decimal places' })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ enum: TransactionType, example: TransactionType.INCOME })
  @IsEnum(TransactionType, { message: `Type must be one of: ${Object.values(TransactionType).join(', ')}` })
  type!: TransactionType;

  @ApiProperty({ example: 'Salary' })
  @IsString()
  @MaxLength(100)
  category!: string;

  @ApiProperty({ example: '2024-01-15', description: 'ISO 8601 date string' })
  @IsDateString({}, { message: 'Date must be a valid ISO 8601 date' })
  date!: string;

  @ApiPropertyOptional({ example: 'Monthly salary payment' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
