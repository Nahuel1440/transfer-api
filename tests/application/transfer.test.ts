import { describe, it, expect, beforeEach } from 'vitest'
import { CreateTransaction } from '../../src/application/create-transaction.usecase'
import { ApproveTransaction } from '../../src/application/approve-transaction.usecase'
import { RejectTransaction } from '../../src/application/reject-transaction.usecase'
import { ListUserTransactions } from '../../src/application/list-user-transactions.usecase'
import { Transaction } from '../../src/domain/transaction.entity'
import {
  InsufficientFundsError,
  InvalidAmountError,
  SameAccountTransferError,
  TransactionNotFoundError,
  TransactionNotPendingError,
  UserNotFoundError,
} from '../../src/domain/errors'
import {
  InMemoryStore,
  InMemoryUnitOfWork,
  makeLedgerRepository,
  makeTransactionRepository,
} from '../support/in-memory'

const THRESHOLD = 50_000 // cents (unit-agnostic for the use case)

describe('transactional transfer flow (with fund hold)', () => {
  let store: InMemoryStore
  let create: CreateTransaction
  let approve: ApproveTransaction
  let reject: RejectTransaction
  let list: ListUserTransactions

  beforeEach(() => {
    store = new InMemoryStore()
    store.seedUser({ id: 'alice', name: 'Alice', email: 'alice@example.com', balance: 100_000 })
    store.seedUser({ id: 'bob', name: 'Bob', email: 'bob@example.com', balance: 0 })

    const uow = new InMemoryUnitOfWork(store)
    create = new CreateTransaction(uow, THRESHOLD)
    approve = new ApproveTransaction(uow)
    reject = new RejectTransaction(uow)
    list = new ListUserTransactions(makeTransactionRepository(store), makeLedgerRepository(store))
  })

  const balanceOf = (id: string) => store.users.get(id)!.balance

  describe('create — at or below threshold (executed immediately)', () => {
    it('debits origin and credits destination atomically, marks APPROVED', async () => {
      const view = await create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 30_000 })

      expect(view.transaction.status).toBe('APPROVED')
      expect(view.balanceAfter).toBe(70_000)
      expect(balanceOf('alice')).toBe(70_000)
      expect(balanceOf('bob')).toBe(30_000)
    })

    it('rolls back entirely on insufficient funds (no debit, no credit, no record)', async () => {
      await expect(
        create.execute({ originId: 'bob', destinationId: 'alice', amountCents: 1 }),
      ).rejects.toBeInstanceOf(InsufficientFundsError)

      expect(balanceOf('bob')).toBe(0)
      expect(balanceOf('alice')).toBe(100_000)
      expect(await list.execute('bob')).toHaveLength(0)
    })

    it('rejects a non-positive amount', async () => {
      await expect(
        create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 0 }),
      ).rejects.toBeInstanceOf(InvalidAmountError)
    })

    it('rejects a transfer to the same account', async () => {
      await expect(
        create.execute({ originId: 'alice', destinationId: 'alice', amountCents: 10 }),
      ).rejects.toBeInstanceOf(SameAccountTransferError)
      expect(balanceOf('alice')).toBe(100_000)
    })

    it('fails when a participant does not exist', async () => {
      await expect(
        create.execute({ originId: 'alice', destinationId: 'ghost', amountCents: 10 }),
      ).rejects.toBeInstanceOf(UserNotFoundError)
      expect(balanceOf('alice')).toBe(100_000)
    })
  })

  describe('create — above threshold (held for manual review)', () => {
    it('debits (holds) the origin immediately but does NOT credit the destination', async () => {
      const view = await create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 60_000 })

      expect(view.transaction.status).toBe('PENDING')
      expect(view.balanceAfter).toBe(40_000)
      expect(balanceOf('alice')).toBe(40_000) // funds held
      expect(balanceOf('bob')).toBe(0) // not credited yet
    })

    it('requires sufficient funds at creation time (cannot hold what you do not have)', async () => {
      await expect(
        create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 200_000 }),
      ).rejects.toBeInstanceOf(InsufficientFundsError)
      expect(balanceOf('alice')).toBe(100_000)
    })

    it('held funds cannot be double-spent while pending', async () => {
      await create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 60_000 }) // holds 60k -> alice 40k
      await expect(
        create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 50_000 }),
      ).rejects.toBeInstanceOf(InsufficientFundsError)
      expect(balanceOf('alice')).toBe(40_000)
    })
  })

  describe('approve', () => {
    it('delivers the held funds to the destination (origin already debited at creation)', async () => {
      const pending = await create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 60_000 })

      const approved = await approve.execute(pending.transaction.id)

      expect(approved.transaction.status).toBe('APPROVED')
      expect(approved.balanceAfter).toBe(60_000) // destination balance after credit
      expect(balanceOf('alice')).toBe(40_000) // unchanged on approve
      expect(balanceOf('bob')).toBe(60_000) // credited now
    })

    it('is not repeatable: a second approve throws and balances stay put', async () => {
      const pending = await create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 60_000 })
      await approve.execute(pending.transaction.id)

      await expect(approve.execute(pending.transaction.id)).rejects.toBeInstanceOf(TransactionNotPendingError)
      expect(balanceOf('alice')).toBe(40_000)
      expect(balanceOf('bob')).toBe(60_000)
    })

    it('throws when the transaction does not exist', async () => {
      await expect(approve.execute('nope')).rejects.toBeInstanceOf(TransactionNotFoundError)
    })
  })

  describe('reject', () => {
    it('releases the hold back to the origin (refund), destination untouched', async () => {
      const pending = await create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 60_000 })
      expect(balanceOf('alice')).toBe(40_000)

      const rejected = await reject.execute(pending.transaction.id)

      expect(rejected.transaction.status).toBe('REJECTED')
      expect(rejected.balanceAfter).toBe(100_000) // origin balance after refund
      expect(balanceOf('alice')).toBe(100_000) // refunded
      expect(balanceOf('bob')).toBe(0)
    })

    it('cannot reject an already-approved transfer', async () => {
      const small = await create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 10_000 })

      await expect(reject.execute(small.transaction.id)).rejects.toBeInstanceOf(TransactionNotPendingError)
    })

    it('throws when the transaction does not exist', async () => {
      await expect(reject.execute('nope')).rejects.toBeInstanceOf(TransactionNotFoundError)
    })
  })

  describe('list', () => {
    it('returns transfers where the user is origin or destination, newest first', async () => {
      const repo = makeTransactionRepository(store)
      const older = Transaction.autoApproved({
        id: 'older',
        originId: 'alice',
        destinationId: 'bob',
        amount: 10_000,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })
      const newer = Transaction.held({
        id: 'newer',
        originId: 'alice',
        destinationId: 'bob',
        amount: 60_000,
        createdAt: new Date('2026-01-01T00:00:01.000Z'),
      })
      await repo.create(older)
      await repo.create(newer)

      const result = await list.execute('bob')

      expect(result.map((view) => view.transaction.id)).toEqual(['newer', 'older'])
    })

    it("shows each viewer only their own resulting balance (no counterparty leak)", async () => {
      const view = await create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 30_000 })

      const aliceList = await list.execute('alice')
      const bobList = await list.execute('bob')

      const aliceEntry = aliceList.find((v) => v.transaction.id === view.transaction.id)!
      const bobEntry = bobList.find((v) => v.transaction.id === view.transaction.id)!

      expect(aliceEntry.balanceAfter).toBe(70_000) // sender sees her own balance
      expect(bobEntry.balanceAfter).toBe(30_000) // recipient sees his own balance
    })

    it('shows null for the recipient of a still-pending transfer', async () => {
      const pending = await create.execute({ originId: 'alice', destinationId: 'bob', amountCents: 60_000 })

      const bobList = await list.execute('bob')
      const bobEntry = bobList.find((v) => v.transaction.id === pending.transaction.id)!

      expect(bobEntry.balanceAfter).toBeNull() // not credited yet
    })
  })
})
