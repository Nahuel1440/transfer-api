import type { Prisma, PrismaClient } from '@prisma/client'
import { Transaction, type TransactionStatus } from '../../../domain/transaction.entity'
import type { TransactionRepository } from '../../../ports/transaction.repository'

type Db = PrismaClient | Prisma.TransactionClient

type TxRow = {
  id: string
  originId: string
  destinationId: string
  amount: number
  status: TransactionStatus
  createdAt: Date
}

export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly db: Db) {}

  async create(tx: Transaction): Promise<void> {
    await this.db.transaction.create({
      data: {
        id: tx.id,
        originId: tx.originId,
        destinationId: tx.destinationId,
        amount: tx.amount,
        status: tx.status,
        createdAt: tx.createdAt,
      },
    })
  }

  async searchById(id: string): Promise<Transaction | null> {
    const row = await this.db.transaction.findUnique({ where: { id } })
    return row ? this.toEntity(row) : null
  }

  async save(tx: Transaction): Promise<void> {
    await this.db.transaction.update({
      where: { id: tx.id },
      data: { status: tx.status },
    })
  }

  async listByUser(userId: string): Promise<Transaction[]> {
    const rows = await this.db.transaction.findMany({
      where: { OR: [{ originId: userId }, { destinationId: userId }] },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((row) => this.toEntity(row))
  }

  private toEntity(row: TxRow): Transaction {
    return Transaction.fromPersistence(row)
  }
}
