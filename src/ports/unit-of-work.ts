import type { UserRepository } from './user.repository'
import type { TransactionRepository } from './transaction.repository'
import type { LedgerRepository } from './ledger.repository'

export interface Repositories {
  users: UserRepository
  transactions: TransactionRepository
  ledger: LedgerRepository
}

export interface UnitOfWork {
  execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T>
}
