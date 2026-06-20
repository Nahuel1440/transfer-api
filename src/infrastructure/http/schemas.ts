import { Type } from '@sinclair/typebox'

export const CreateTransactionBody = Type.Object(
  {
    originId: Type.String({ minLength: 1, description: 'Sender user id' }),
    destinationId: Type.String({ minLength: 1, description: 'Recipient user id' }),
    amount: Type.Integer({ exclusiveMinimum: 0, description: 'Amount in cents, e.g. 150050 = $1500.50' }),
  },
  { additionalProperties: false },
)

export const TransactionParams = Type.Object({
  id: Type.String({ minLength: 1 }),
})

export const ListTransactionsQuery = Type.Object({
  userId: Type.String({ minLength: 1, description: 'User id to list transactions for' }),
})

export const TransactionResponse = Type.Object({
  id: Type.String(),
  originId: Type.String(),
  destinationId: Type.String(),
  amount: Type.Integer({ description: 'Amount in cents' }),
  status: Type.Union([Type.Literal('PENDING'), Type.Literal('APPROVED'), Type.Literal('REJECTED')]),
  balanceAfter: Type.Union([Type.Integer(), Type.Null()], {
    description:
      'The responding account balance after this transaction (cents); null when the account has no movement for it yet, e.g. the recipient of a still-pending transfer',
  }),
  createdAt: Type.String({ description: 'ISO-8601 timestamp' }),
})

export const TransactionListResponse = Type.Array(TransactionResponse)

export const ErrorResponse = Type.Object({
  code: Type.String(),
  message: Type.String(),
})
