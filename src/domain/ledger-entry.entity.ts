import { randomUUID } from 'crypto'

interface RecordProps {
  userId: string
  transactionId: string
  amount: number
  balanceAfter: number
  createdAt?: Date
}

interface PersistenceProps {
  id: string
  userId: string
  transactionId: string
  amount: number
  balanceAfter: number
  createdAt: Date
}

export class LedgerEntry {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly transactionId: string,
    public readonly amount: number,
    public readonly balanceAfter: number,
    public readonly createdAt: Date,
  ) {}

  static record(props: RecordProps): LedgerEntry {
    return new LedgerEntry(
      randomUUID(),
      props.userId,
      props.transactionId,
      props.amount,
      props.balanceAfter,
      props.createdAt ?? new Date(),
    )
  }

  static fromPersistence(props: PersistenceProps): LedgerEntry {
    return new LedgerEntry(
      props.id,
      props.userId,
      props.transactionId,
      props.amount,
      props.balanceAfter,
      props.createdAt,
    )
  }
}
