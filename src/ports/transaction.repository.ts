import type { Transaction } from '../domain/transaction.entity'

export interface TransactionRepository {
  create(tx: Transaction): Promise<void>
  searchById(id: string): Promise<Transaction | null>
  save(tx: Transaction): Promise<void>
  listByUser(userId: string): Promise<Transaction[]>
}
