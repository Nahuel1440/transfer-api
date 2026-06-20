import type { Transaction } from '../domain/transaction.entity'

export interface TransactionView {
  transaction: Transaction
  balanceAfter: number | null
}
