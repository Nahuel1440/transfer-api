import { InvalidAmountError, SameAccountTransferError, TransactionNotPendingError } from './errors'

export const TransactionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus]

interface TransferProps {
  id: string
  originId: string
  destinationId: string
  amount: number
  createdAt?: Date
}

export class Transaction {
  private constructor(
    public readonly id: string,
    public readonly originId: string,
    public readonly destinationId: string,
    public readonly amount: number,
    public readonly status: TransactionStatus,
    public readonly createdAt: Date,
  ) {}

  static autoApproved(props: TransferProps): Transaction {
    Transaction.assertValid(props)
    return new Transaction(
      props.id,
      props.originId,
      props.destinationId,
      props.amount,
      TransactionStatus.APPROVED,
      props.createdAt ?? new Date(),
    )
  }

  static held(props: TransferProps): Transaction {
    Transaction.assertValid(props)
    return new Transaction(
      props.id,
      props.originId,
      props.destinationId,
      props.amount,
      TransactionStatus.PENDING,
      props.createdAt ?? new Date(),
    )
  }

  static fromPersistence(props: {
    id: string
    originId: string
    destinationId: string
    amount: number
    status: TransactionStatus
    createdAt: Date
  }): Transaction {
    return new Transaction(
      props.id,
      props.originId,
      props.destinationId,
      props.amount,
      props.status,
      props.createdAt,
    )
  }

  approve(): Transaction {
    this.assertPending()
    return new Transaction(
      this.id,
      this.originId,
      this.destinationId,
      this.amount,
      TransactionStatus.APPROVED,
      this.createdAt,
    )
  }

  reject(): Transaction {
    this.assertPending()
    return new Transaction(
      this.id,
      this.originId,
      this.destinationId,
      this.amount,
      TransactionStatus.REJECTED,
      this.createdAt,
    )
  }

  private static assertValid(props: TransferProps): void {
    if (!Number.isInteger(props.amount) || props.amount <= 0) {
      throw new InvalidAmountError(props.amount)
    }
    if (props.originId === props.destinationId) {
      throw new SameAccountTransferError(props.originId)
    }
  }

  private assertPending(): void {
    if (this.status !== TransactionStatus.PENDING) {
      throw new TransactionNotPendingError(this.id, this.status)
    }
  }
}
