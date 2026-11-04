import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreditTransactionType } from '@ananvi/shared';

describe('AdminService.adjustCredits', () => {
  let service: AdminService;
  let mockEm: any;
  let mockDs: any;

  beforeEach(() => {
    mockEm = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((_, data) => ({ ...data })),
    };

    mockDs = {
      transaction: jest.fn((cb: (em: any) => Promise<void>) => cb(mockEm)),
    };

    service = new AdminService(
      {} as any, // users
      mockDs,
      {} as any, // jobRepo
      {} as any, // paymentRepo
      {} as any, // auditRepo
      {} as any, // settingRepo
      {} as any, // userRepo
      {} as any, // creditRepo
      {} as any, // txRepo
    );
  });

  it('applies a positive adjustment without clamping', async () => {
    const credit = { user_id: 'u1', balance: 100, lifetime_purchased: 0, lifetime_used: 0 };
    mockEm.findOne.mockResolvedValue(credit);

    await service.adjustCredits('u1', 50);

    expect(credit.balance).toBe(150);
    expect(credit.lifetime_purchased).toBe(50);
    expect(credit.lifetime_used).toBe(0);
    expect(mockEm.save).toHaveBeenCalledWith(expect.anything(), credit);

    const txArg = mockEm.create.mock.calls[0][1];
    expect(txArg.amount).toBe(50);
    expect(txArg.type).toBe(CreditTransactionType.ADMIN);
    expect(txArg.description).not.toContain('clamped');
  });

  it('clamps a negative adjustment at zero and records applied delta', async () => {
    const credit = { user_id: 'u1', balance: 100, lifetime_purchased: 500, lifetime_used: 0 };
    mockEm.findOne.mockResolvedValue(credit);

    await service.adjustCredits('u1', -200);

    expect(credit.balance).toBe(0);
    expect(credit.lifetime_used).toBe(100);

    const txArg = mockEm.create.mock.calls[0][1];
    expect(txArg.amount).toBe(-100);
    expect(txArg.description).toContain('clamped');
    expect(txArg.description).toContain('-200');
  });

  it('throws NotFoundException when credit account does not exist', async () => {
    mockEm.findOne.mockResolvedValue(null);

    await expect(service.adjustCredits('missing-user', 10)).rejects.toThrow(
      new NotFoundException('User credit account not found'),
    );
    expect(mockEm.save).not.toHaveBeenCalled();
  });
});
