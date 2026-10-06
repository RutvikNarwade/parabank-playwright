import { z } from 'zod';

/**
 * Response contracts for the ParaBank REST API (JSON representation).
 * Objects are intentionally non-strict: additive fields are a compatible change and must not
 * break consumers, while missing or re-typed fields are breaking changes and fail validation.
 */

export const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
});

export const CustomerSchema = z.object({
  id: z.number().int().positive(),
  firstName: z.string(),
  lastName: z.string(),
  address: AddressSchema,
  phoneNumber: z.string(),
  ssn: z.string(),
});

export const AccountTypeSchema = z.enum(['CHECKING', 'SAVINGS', 'LOAN']);

export const AccountSchema = z.object({
  id: z.number().int().positive(),
  customerId: z.number().int().positive(),
  type: AccountTypeSchema,
  balance: z.number(),
});
export const AccountListSchema = z.array(AccountSchema);

export const TransactionSchema = z.object({
  id: z.number().int().positive(),
  accountId: z.number().int().positive(),
  type: z.enum(['Credit', 'Debit']),
  date: z.number().int(), // epoch millis
  amount: z.number(),
  description: z.string(),
});
export const TransactionListSchema = z.array(TransactionSchema);

export const LoanResponseSchema = z.object({
  responseDate: z.number().int(),
  loanProviderName: z.string(),
  approved: z.boolean(),
  message: z.string().nullish(),
  accountId: z.number().int().nullish(),
});

export const BillPayResultSchema = z.object({
  payeeName: z.string(),
  amount: z.number(),
  accountId: z.number().int(),
});

export type Customer = z.infer<typeof CustomerSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type AccountType = z.infer<typeof AccountTypeSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type LoanResponse = z.infer<typeof LoanResponseSchema>;
