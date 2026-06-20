import type { Prisma, PrismaClient } from '@prisma/client'
import { User } from '../../../domain/user.entity'
import type { UserRepository } from '../../../ports/user.repository'

type Db = PrismaClient | Prisma.TransactionClient

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  async searchById(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } })
    return row ? new User(row.id, row.name, row.email, row.balance) : null
  }

  async searchAndLockById(id: string): Promise<User | null> {
    const rows = await this.db.$queryRaw<
      Array<{ id: string; name: string; email: string; balance: number }>
    >`SELECT id, name, email, balance FROM "User" WHERE id = ${id} FOR UPDATE`

    const row = rows[0]
    return row ? new User(row.id, row.name, row.email, row.balance) : null
  }

  async save(user: User): Promise<void> {
    await this.db.user.update({
      where: { id: user.id },
      data: { balance: user.balance },
    })
  }
}
