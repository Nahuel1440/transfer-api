import type { TransactionRepository } from '../ports/transaction.repository'
import type { LedgerRepository } from '../ports/ledger.repository'
import type { LedgerEntry } from '../domain/ledger-entry.entity'
import type { TransactionView } from './transaction-view'

export class ListUserTransactions {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly ledger: LedgerRepository,
  ) {}

  async execute(userId: string): Promise<TransactionView[]> {
    const [transactions, entries] = await Promise.all([
      this.transactions.listByUser(userId),
      this.ledger.listByUser(userId),
    ])

    const latestEntryByTransaction = new Map<string, LedgerEntry>()
    for (const entry of entries) {
      const current = latestEntryByTransaction.get(entry.transactionId)
      if (!current || entry.createdAt.getTime() > current.createdAt.getTime()) {
        latestEntryByTransaction.set(entry.transactionId, entry)
      }
    }

    return transactions.map((transaction) => {
      const entry = latestEntryByTransaction.get(transaction.id)
      return { transaction, balanceAfter: entry ? entry.balanceAfter : null }
    })
  }
}
