import type { Prisma, PrismaClient } from '@prisma/client'
import { LedgerEntry } from '../../../domain/ledger-entry.entity'
import type { LedgerRepository } from '../../../ports/ledger.repository'

type Db = PrismaClient | Prisma.TransactionClient

type LedgerRow = {
  id: string
  userId: string
  transactionId: string
  amount: number
  balanceAfter: number
  createdAt: Date
}

export class PrismaLedgerRepository implements LedgerRepository {
  constructor(private readonly db: Db) {}

  async create(entry: LedgerEntry): Promise<void> {
    await this.db.ledgerEntry.create({
      data: {
        id: entry.id,
        userId: entry.userId,
        transactionId: entry.transactionId,
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
        createdAt: entry.createdAt,
      },
    })
  }

  async listByUser(userId: string): Promise<LedgerEntry[]> {
    const rows = await this.db.ledgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((row) => this.toEntity(row))
  }

  private toEntity(row: LedgerRow): LedgerEntry {
    return LedgerEntry.fromPersistence(row)
  }
}
