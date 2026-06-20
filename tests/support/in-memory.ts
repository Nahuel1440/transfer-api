import { User } from '../../src/domain/user.entity'
import { Transaction, type TransactionStatus } from '../../src/domain/transaction.entity'
import { LedgerEntry } from '../../src/domain/ledger-entry.entity'

interface UserRow {
  id: string
  name: string
  email: string
  balance: number
}

interface TxRow {
  id: string
  originId: string
  destinationId: string
  amount: number
  status: TransactionStatus
  createdAt: Date
}

interface LedgerRow {
  id: string
  userId: string
  transactionId: string
  amount: number
  balanceAfter: number
  createdAt: Date
}

export class InMemoryStore {
  users = new Map<string, UserRow>()
  transactions = new Map<string, TxRow>()
  ledger: LedgerRow[] = []

  seedUser(row: UserRow): void {
    this.users.set(row.id, { ...row })
  }

  snapshot() {
    return {
      users: new Map([...this.users].map(([k, v]) => [k, { ...v }])),
      transactions: new Map([...this.transactions].map(([k, v]) => [k, { ...v }])),
      ledger: this.ledger.map((row) => ({ ...row })),
    }
  }

  restore(snapshot: ReturnType<InMemoryStore['snapshot']>): void {
    this.users = snapshot.users
    this.transactions = snapshot.transactions
    this.ledger = snapshot.ledger
  }
}

export class InMemoryUserRepository {
  constructor(private readonly store: InMemoryStore) {}

  async searchById(id: string): Promise<User | null> {
    const row = this.store.users.get(id)
    return row ? new User(row.id, row.name, row.email, row.balance) : null
  }

  async searchAndLockById(id: string): Promise<User | null> {
    return this.searchById(id)
  }

  async save(user: User): Promise<void> {
    const row = this.store.users.get(user.id)
    if (!row) throw new Error(`cannot save unknown user ${user.id}`)
    row.name = user.name
    row.email = user.email
    row.balance = user.balance
  }
}

export class InMemoryTransactionRepository {
  constructor(private readonly store: InMemoryStore) {}

  async create(tx: Transaction): Promise<void> {
    this.store.transactions.set(tx.id, this.toRow(tx))
  }

  async searchById(id: string): Promise<Transaction | null> {
    const row = this.store.transactions.get(id)
    return row ? this.toEntity(row) : null
  }

  async save(tx: Transaction): Promise<void> {
    if (!this.store.transactions.has(tx.id)) throw new Error(`cannot save unknown transaction ${tx.id}`)
    this.store.transactions.set(tx.id, this.toRow(tx))
  }

  async listByUser(userId: string): Promise<Transaction[]> {
    return [...this.store.transactions.values()]
      .filter((r) => r.originId === userId || r.destinationId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => this.toEntity(r))
  }

  private toRow(tx: Transaction): TxRow {
    return {
      id: tx.id,
      originId: tx.originId,
      destinationId: tx.destinationId,
      amount: tx.amount,
      status: tx.status,
      createdAt: tx.createdAt,
    }
  }

  private toEntity(row: TxRow): Transaction {
    return Transaction.fromPersistence({ ...row })
  }
}

export class InMemoryLedgerRepository {
  constructor(private readonly store: InMemoryStore) {}

  async create(entry: LedgerEntry): Promise<void> {
    this.store.ledger.push(this.toRow(entry))
  }

  async listByUser(userId: string): Promise<LedgerEntry[]> {
    return this.store.ledger
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => this.toEntity(r))
  }

  private toRow(entry: LedgerEntry): LedgerRow {
    return {
      id: entry.id,
      userId: entry.userId,
      transactionId: entry.transactionId,
      amount: entry.amount,
      balanceAfter: entry.balanceAfter,
      createdAt: entry.createdAt,
    }
  }

  private toEntity(row: LedgerRow): LedgerEntry {
    return LedgerEntry.fromPersistence({ ...row })
  }
}

export class InMemoryUnitOfWork {
  constructor(private readonly store: InMemoryStore) {}

  async execute<T>(
    work: (repos: {
      users: InMemoryUserRepository
      transactions: InMemoryTransactionRepository
      ledger: InMemoryLedgerRepository
    }) => Promise<T>,
  ): Promise<T> {
    const snapshot = this.store.snapshot()
    try {
      return await work({
        users: new InMemoryUserRepository(this.store),
        transactions: new InMemoryTransactionRepository(this.store),
        ledger: new InMemoryLedgerRepository(this.store),
      })
    } catch (error) {
      this.store.restore(snapshot)
      throw error
    }
  }
}

export function makeTransactionRepository(store: InMemoryStore): InMemoryTransactionRepository {
  return new InMemoryTransactionRepository(store)
}

export function makeLedgerRepository(store: InMemoryStore): InMemoryLedgerRepository {
  return new InMemoryLedgerRepository(store)
}
