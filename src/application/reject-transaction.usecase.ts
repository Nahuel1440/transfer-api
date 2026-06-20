import { LedgerEntry } from '../domain/ledger-entry.entity'
import { TransactionNotFoundError, UserNotFoundError } from '../domain/errors'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { TransactionView } from './transaction-view'

export class RejectTransaction {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(transactionId: string): Promise<TransactionView> {
    return this.uow.execute(async ({ users, transactions, ledger }) => {
      const tx = await transactions.searchById(transactionId)
      if (!tx) throw new TransactionNotFoundError(transactionId)

      const origin = await users.searchAndLockById(tx.originId)
      if (!origin) throw new UserNotFoundError(tx.originId)

      const refundedOrigin = origin.credit(tx.amount)
      const rejected = tx.reject()
      const entry = LedgerEntry.record({
        userId: tx.originId,
        transactionId: tx.id,
        amount: tx.amount,
        balanceAfter: refundedOrigin.balance,
      })

      await users.save(refundedOrigin)
      await transactions.save(rejected)
      await ledger.create(entry)
      return { transaction: rejected, balanceAfter: refundedOrigin.balance }
    })
  }
}
