import {
  Controller, Get, Post, Body, Query, Param, Headers,
  RawBodyRequest, Req, HttpCode, HttpStatus,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CREDIT_PACKAGES } from '@ananvi/shared';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('credits')
  async getCredits(@CurrentUser('sub') userId: string) {
    const info = await this.billing.getCreditInfo(userId);
    return { success: true, data: info };
  }

  @Get('transactions')
  async getTransactions(
    @CurrentUser('sub') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('per_page', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
  ) {
    const { transactions, total } = await this.billing.getTransactions(userId, page, perPage);
    return {
      success: true, data: transactions,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) },
    };
  }

  @Get('packages')
  getPackages() {
    return { success: true, data: CREDIT_PACKAGES };
  }

  @Post('checkout')
  async checkout(
    @CurrentUser('sub') userId: string,
    @Body('package_id') packageId: string,
  ) {
    const url = await this.billing.createCheckoutUrl(userId, packageId);
    return { success: true, data: { checkout_url: url } };
  }

  @Public()
  @Post('webhooks/dodo')
  @HttpCode(HttpStatus.OK)
  async handleDodoWebhook(
    @Body() payload: any,
    @Headers('x-dodo-signature') signature: string,
  ) {
    await this.billing.handleWebhook(payload, signature);
    return { received: true };
  }
}
