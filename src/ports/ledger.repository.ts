import type { LedgerEntry } from '../domain/ledger-entry.entity'

export interface LedgerRepository {
  create(entry: LedgerEntry): Promise<void>
  listByUser(userId: string): Promise<LedgerEntry[]>
}
