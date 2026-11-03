import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Credit } from './entities/credit.entity';
import { CreditTransaction } from './entities/credit-transaction.entity';
import { Payment } from './entities/payment.entity';
import {
  CreditTransactionType, PaymentStatus, CREDIT_PACKAGES,
} from '@ananvi/shared';

@Injectable()
export class BillingService {
  private readonly dodoApiKey: string;
  private readonly dodoWebhookSecret: string;

  constructor(
    @InjectRepository(Credit) private readonly creditRepo: Repository<Credit>,
    @InjectRepository(CreditTransaction) private readonly txRepo: Repository<CreditTransaction>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    this.dodoApiKey = this.config.getOrThrow('DODO_API_KEY');
    this.dodoWebhookSecret = this.config.getOrThrow('DODO_WEBHOOK_SECRET');
  }

  async getBalance(userId: string): Promise<number> {
    const credit = await this.creditRepo.findOne({ where: { user_id: userId } });
    return credit?.balance ?? 0;
  }

  async getCreditInfo(userId: string): Promise<Credit> {
    let credit = await this.creditRepo.findOne({ where: { user_id: userId } });
    if (!credit) {
      credit = this.creditRepo.create({ user_id: userId, balance: 0 });
      await this.creditRepo.save(credit);
    }
    return credit;
  }

  async getTransactions(userId: string, page = 1, perPage = 20) {
    const [txs, total] = await this.txRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return { transactions: txs, total };
  }

  // ── Credit Operations (transactional) ────────────────
  async addCredits(userId: string, amount: number, meta: {
    type: CreditTransactionType;
    description: string;
    reference_id?: string;
  }): Promise<number> {
    return this.dataSource.transaction(async manager => {
      let credit = await manager.findOne(Credit, { where: { user_id: userId } });
      if (!credit) {
        credit = manager.create(Credit, { user_id: userId, balance: 0 });
      }

      credit.balance += amount;
      if (meta.type === CreditTransactionType.PURCHASE) {
        credit.lifetime_purchased += amount;
      }
      await manager.save(credit);

      const tx = manager.create(CreditTransaction, {
        user_id: userId,
        type: meta.type,
        amount: amount,
        balance_after: credit.balance,
        description: meta.description,
        reference_id: meta.reference_id || null,
      });
      await manager.save(tx);

      return credit.balance;
    });
  }

  async deductCredits(userId: string, amount: number, meta: {
    type: CreditTransactionType;
    description: string;
    reference_id?: string;
  }): Promise<number> {
    return this.dataSource.transaction(async manager => {
      const credit = await manager.findOne(Credit, {
        where: { user_id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!credit || credit.balance < amount) {
        throw new BadRequestException('Insufficient credits');
      }

      credit.balance -= amount;
      credit.lifetime_used += amount;
      await manager.save(credit);

      const tx = manager.create(CreditTransaction, {
        user_id: userId,
        type: meta.type,
        amount: -amount,
        balance_after: credit.balance,
        description: meta.description,
        reference_id: meta.reference_id || null,
      });
      await manager.save(tx);

      return credit.balance;
    });
  }

  // ── Dodo Payments ────────────────────────────────────
  async createCheckoutUrl(userId: string, packageId: string): Promise<string> {
    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
    if (!pkg) throw new BadRequestException('Invalid package');

    // Call Dodo Payments API to create a checkout session
    const response = await fetch('https://api.dodopayments.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.dodoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: pkg.price_cents,
        currency: 'USD',
        metadata: {
          user_id: userId,
          package_id: pkg.id,
          credits: pkg.credits,
        },
        success_url: `${this.config.get('APP_URL')}/billing?success=true`,
        cancel_url: `${this.config.get('APP_URL')}/billing?cancelled=true`,
      }),
    });

    const data = await response.json() as any;

    // Record pending payment
    await this.paymentRepo.save(this.paymentRepo.create({
      user_id: userId,
      dodo_payment_id: data.id,
      amount_cents: pkg.price_cents,
      credits_granted: pkg.credits,
      status: PaymentStatus.PENDING,
      metadata: { package_id: pkg.id },
    }));

    return data.checkout_url;
  }

  async handleWebhook(payload: any, signature: string): Promise<void> {
    // Verify webhook signature
    const crypto = await import('crypto');
    const expected = crypto
      .createHmac('sha256', this.dodoWebhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expected) {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (payload.event === 'payment.completed') {
      const payment = await this.paymentRepo.findOne({
        where: { dodo_payment_id: payload.data.id },
      });
      if (!payment || payment.status !== PaymentStatus.PENDING) return;

      payment.status = PaymentStatus.COMPLETED;
      await this.paymentRepo.save(payment);

      await this.addCredits(payment.user_id, payment.credits_granted, {
        type: CreditTransactionType.PURCHASE,
        description: `Purchased ${payment.credits_granted} credits`,
        reference_id: payment.id,
      });
    }
  }
}
