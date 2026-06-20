import { randomUUID } from 'crypto'
import { Transaction } from '../domain/transaction.entity'
import { LedgerEntry } from '../domain/ledger-entry.entity'
import { UserNotFoundError } from '../domain/errors'
import { requiresManualReview } from '../domain/review-policy'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { TransactionView } from './transaction-view'

export interface CreateTransactionInput {
  originId: string
  destinationId: string
  amountCents: number
}

export class CreateTransaction {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly reviewThresholdCents: number,
  ) {}

  async execute(input: CreateTransactionInput): Promise<TransactionView> {
    return this.uow.execute(async ({ users, transactions, ledger }) => {
      const origin = await users.searchAndLockById(input.originId)
      if (!origin) throw new UserNotFoundError(input.originId)

      const debitedOrigin = origin.debit(input.amountCents)

      const txId = randomUUID()
      const props = {
        id: txId,
        originId: input.originId,
        destinationId: input.destinationId,
        amount: input.amountCents,
        createdAt: new Date(),
      }

      const originEntry = LedgerEntry.record({
        userId: input.originId,
        transactionId: txId,
        amount: -input.amountCents,
        balanceAfter: debitedOrigin.balance,
      })

      if (requiresManualReview(input.amountCents, this.reviewThresholdCents)) {
        const destination = await users.searchById(input.destinationId)
        if (!destination) throw new UserNotFoundError(input.destinationId)

        const held = Transaction.held(props)
        await users.save(debitedOrigin)
        await transactions.create(held)
        await ledger.create(originEntry)
        return { transaction: held, balanceAfter: debitedOrigin.balance }
      }

      const destination = await users.searchAndLockById(input.destinationId)
      if (!destination) throw new UserNotFoundError(input.destinationId)

      const creditedDestination = destination.credit(input.amountCents)
      const tx = Transaction.autoApproved(props)
      const destinationEntry = LedgerEntry.record({
        userId: input.destinationId,
        transactionId: txId,
        amount: input.amountCents,
        balanceAfter: creditedDestination.balance,
      })

      await users.save(debitedOrigin)
      await users.save(creditedDestination)
      await transactions.create(tx)
      await ledger.create(originEntry)
      await ledger.create(destinationEntry)
      return { transaction: tx, balanceAfter: debitedOrigin.balance }
    })
  }
}
