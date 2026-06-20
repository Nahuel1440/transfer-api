import type { PrismaClient } from '@prisma/client'
import type { Repositories, UnitOfWork } from '../../../ports/unit-of-work'
import { PrismaUserRepository } from './prisma-user.repository'
import { PrismaTransactionRepository } from './prisma-transaction.repository'
import { PrismaLedgerRepository } from './prisma-ledger.repository'

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) =>
      work({
        users: new PrismaUserRepository(tx),
        transactions: new PrismaTransactionRepository(tx),
        ledger: new PrismaLedgerRepository(tx),
      }),
    )
  }
}
