import { TransactionStatus } from '../domain/transaction.entity'
import { LedgerEntry } from '../domain/ledger-entry.entity'
import {
  TransactionNotFoundError,
  TransactionNotPendingError,
  UserNotFoundError,
} from '../domain/errors'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { TransactionView } from './transaction-view'

export class ApproveTransaction {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(transactionId: string): Promise<TransactionView> {
    return this.uow.execute(async ({ users, transactions, ledger }) => {
      const tx = await transactions.searchById(transactionId)
      if (!tx) throw new TransactionNotFoundError(transactionId)
      if (tx.status !== TransactionStatus.PENDING) {
        throw new TransactionNotPendingError(tx.id, tx.status)
      }

      const destination = await users.searchAndLockById(tx.destinationId)
      if (!destination) throw new UserNotFoundError(tx.destinationId)

      const creditedDestination = destination.credit(tx.amount)
      const approved = tx.approve()
      const entry = LedgerEntry.record({
        userId: tx.destinationId,
        transactionId: tx.id,
        amount: tx.amount,
        balanceAfter: creditedDestination.balance,
      })

      await users.save(creditedDestination)
      await transactions.save(approved)
      await ledger.create(entry)
      return { transaction: approved, balanceAfter: creditedDestination.balance }
    })
  }
}
