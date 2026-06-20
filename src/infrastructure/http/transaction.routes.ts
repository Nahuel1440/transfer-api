import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import {
  CreateTransactionBody,
  ErrorResponse,
  ListTransactionsQuery,
  TransactionListResponse,
  TransactionParams,
  TransactionResponse,
} from './schemas'
import { centsToPesos, pesosToCents } from '../../domain/money'
import type { TransactionView } from '../../application/transaction-view'
import type { CreateTransaction } from '../../application/create-transaction.usecase'
import type { ApproveTransaction } from '../../application/approve-transaction.usecase'
import type { RejectTransaction } from '../../application/reject-transaction.usecase'
import type { ListUserTransactions } from '../../application/list-user-transactions.usecase'

export interface TransactionUseCases {
  create: CreateTransaction
  approve: ApproveTransaction
  reject: RejectTransaction
  list: ListUserTransactions
}

function toResponse(view: TransactionView) {
  const { transaction: tx, balanceAfter } = view
  return {
    id: tx.id,
    originId: tx.originId,
    destinationId: tx.destinationId,
    amount: centsToPesos(tx.amount),
    status: tx.status,
    balanceAfter: balanceAfter === null ? null : centsToPesos(balanceAfter),
    createdAt: tx.createdAt.toISOString(),
  }
}

export const transactionRoutes: FastifyPluginAsyncTypebox<{ useCases: TransactionUseCases }> = async (
  app,
  opts,
) => {
  const { create, approve, reject, list } = opts.useCases

  app.post(
    '/transactions',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Create a transfer',
        description:
          'Amounts at or below the review threshold are executed immediately (APPROVED); above it they are created PENDING for manual approval.',
        body: CreateTransactionBody,
        response: {
          201: TransactionResponse,
          400: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { originId, destinationId, amount } = request.body
      const view = await create.execute({
        originId,
        destinationId,
        amountCents: pesosToCents(amount),
      })
      return reply.status(201).send(toResponse(view))
    },
  )

  app.get(
    '/transactions',
    {
      schema: {
        tags: ['transactions'],
        summary: "List a user's transfers (as origin or destination), newest first",
        querystring: ListTransactionsQuery,
        response: { 200: TransactionListResponse },
      },
    },
    async (request) => {
      const views = await list.execute(request.query.userId)
      return views.map(toResponse)
    },
  )

  app.patch(
    '/transactions/:id/approve',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Approve a pending transfer (moves the money)',
        params: TransactionParams,
        response: { 200: TransactionResponse, 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request) => {
      const view = await approve.execute(request.params.id)
      return toResponse(view)
    },
  )

  app.patch(
    '/transactions/:id/reject',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Reject a pending transfer (no money moves)',
        params: TransactionParams,
        response: { 200: TransactionResponse, 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request) => {
      const view = await reject.execute(request.params.id)
      return toResponse(view)
    },
  )
}
