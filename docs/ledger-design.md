# Ledger redesign — recording each operation's effect on every balance

Date: 2026-06-20

## Context & problem

A transfer moves **two** balances: it debits the origin and credits the destination.
The current model stores a single `originBalanceAfter` snapshot on the `Transaction`
row. Two problems follow:

1. **Incomplete** — the destination's resulting balance is never recorded.
2. **Leak** — `GET /transactions` returns transactions where the user is origin *or*
   destination, and the response always carries the origin's balance. A destination
   listing a transfer they received therefore sees the sender's private balance.

The brief asks for "a clear record of each operation and its effect on the balance".
A single per-transaction snapshot cannot express that for both parties.

## Decision

Introduce an internal **ledger**: one append-only entry per real account movement.
The `Transaction` stays as the operation record (its `PENDING → APPROVED/REJECTED`
lifecycle); the ledger owns "effect on balance". Each user only ever sees their own
entries, which removes the leak by construction.

Hold representation is **lazy two-leg**: an entry is written only when an account
actually moves, never speculatively. No escrow/system account.

The brief's endpoint is kept as the only read surface (no separate ledger endpoint);
each transaction is enriched with the *viewer's own* resulting balance.

## Domain model

### Transaction (changed)
Remove `originBalanceAfter`. Everything else stays: `id, originId, destinationId,
amount, status, createdAt` plus `autoApproved / held / approve / reject /
fromPersistence`.

### LedgerEntry (new)
An immutable record of one account movement. There is **no separate `Account`
table** — the `User` is the account (balance lives on `User.balance`), so the entry
references `User` directly:

- `id: string`
- `userId: string` — the account (FK to `User`) whose balance moved
- `transactionId: string` — the operation it belongs to
- `amount: number` — signed cents: negative = debit, positive = credit
- `balanceAfter: number` — the account's balance after this movement (cents)
- `createdAt: Date`

`balanceAfter` is not recomputed inside the entry; it records the balance the `User`
entity produced when it was debited/credited, so arithmetic lives in one place
(`User.debit` / `User.credit`).

## Use-case behavior

Each use case returns `{ transaction, balanceAfter }` (list returns an array), where
`balanceAfter` is the resulting balance of the account this response is *about*.

### CreateTransaction
1. Debit origin → entry `(origin, tx, -amount, debitedOrigin.balance)`.
2. If auto-approved: credit destination → entry `(destination, tx, +amount, creditedDestination.balance)`.
3. If held (PENDING): no destination entry yet.
4. Persist users, transaction, and the entries in the same unit of work.
5. Returns origin's `balanceAfter` (the sender's resulting balance).

### ApproveTransaction
1. Credit destination → entry `(destination, tx, +amount, creditedDestination.balance)`.
2. Persist user, approved transaction, entry.
3. Returns destination's `balanceAfter`.

### RejectTransaction
1. Refund origin → entry `(origin, tx, +amount, refundedOrigin.balance)`.
2. Persist user, rejected transaction, entry.
3. Returns origin's `balanceAfter` (post-refund).

Entries are never updated. A rejected transfer leaves two origin entries — the hold
debit and the refund credit — which is the honest record of what happened.

## Ports

- **New `LedgerRepository`**: `create(entry)`, `listByUser(userId): LedgerEntry[]`.
- **`Repositories` / `UnitOfWork`**: add `ledger: LedgerRepository` so the use cases
  write entries transactionally alongside users and transactions.
- `TransactionRepository` unchanged in shape (the balance field just leaves the row).

## List enrichment (no leak)

`ListUserTransactions.execute(userId)`:
1. Load the user's transactions (origin or destination), newest first.
2. Load the user's ledger entries (`listByUser(userId)`).
3. Build a map `transactionId → balanceAfter` keeping the **latest** entry per
   transaction.
4. Return `[{ transaction, balanceAfter | null }]`. `null` means the user has no
   movement for that transaction yet (e.g. destination of a PENDING transfer).

A user only ever reads their own entries, so they can never see a counterparty's
balance.

## API

- `GET /transactions?userId=...` — query param, per the brief (current code uses a
  path param; align it). Returns transactions newest-first, each with the viewer's
  own `balanceAfter` (pesos) or `null`.
- `POST /transactions` → `balanceAfter` = origin's resulting balance (never null).
- `PATCH /transactions/:id/approve` → `balanceAfter` = destination's resulting balance.
- `PATCH /transactions/:id/reject` → `balanceAfter` = origin's resulting balance.

`TransactionResponse` replaces the old balance field with `balanceAfter:
number | null`, described as the responding account's balance after the operation
(pesos), `null` when the account has no movement for it yet.

## Conventions

No comments in code — self-documenting names instead. Strip comments in any region we
touch (the removed Prisma balance field takes its doc comment with it).

## Testing

TDD is skipped at the user's explicit request (overriding the project's strict-TDD
default) to move fast; behavior is validated with smoke tests afterward. The existing
unit suite is updated to the new shape so it stays green, but tests are not written
first.

- **Domain**: `LedgerEntry` records signed amount + balanceAfter; `Transaction`
  validates without the balance field.
- **CreateTransaction**: auto-approved writes two entries (origin debit, destination
  credit) with correct balances; held writes only the origin debit; returned
  `balanceAfter` is the origin's.
- **ApproveTransaction**: writes the destination credit entry; balances correct.
- **RejectTransaction**: writes the origin refund entry; origin ends with two entries
  (debit + refund); returned `balanceAfter` is the refunded value.
- **List enrichment**: origin sees their `balanceAfter`; destination of a PENDING sees
  `null`; destination of an APPROVED sees their credited balance; rejected origin sees
  the refunded balance.
- **No leak**: a destination listing a received transfer never sees the origin's
  balance.

## Out of scope (YAGNI)

- No escrow/system account, no chart of accounts, no double-entry balancing invariant.
- No separate `/ledger` endpoint.
- No running-balance recomputation; `balanceAfter` is stored per entry.
