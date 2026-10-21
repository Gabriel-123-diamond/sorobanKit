import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';

const stellarAddress = z
  .string()
  .min(1, 'Destination address is required')
  .refine((addr) => StrKey.isValidEd25519PublicKey(addr), 'Invalid Stellar address');

export const paymentSchema = z.object({
  destinationAddress: stellarAddress,
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, 'Amount must be a positive number'),
  asset: z.string().min(1, 'Asset is required'),
  memo: z.string().max(28, 'Memo must be 28 characters or fewer').optional(),
});

export default paymentSchema;
