export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class InvalidAmountError extends DomainError {
  constructor(amount: number) {
    super('INVALID_AMOUNT', `Amount must be a positive integer of cents, received ${amount}`)
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(userId: string, balance: number, amount: number) {
    super(
      'INSUFFICIENT_FUNDS',
      `User ${userId} has insufficient funds (balance ${balance}, required ${amount})`,
    )
  }
}

export class SameAccountTransferError extends DomainError {
  constructor(userId: string) {
    super('SAME_ACCOUNT_TRANSFER', `Origin and destination must differ (both were ${userId})`)
  }
}

export class TransactionNotPendingError extends DomainError {
  constructor(id: string, status: string) {
    super(
      'TRANSACTION_NOT_PENDING',
      `Transaction ${id} is ${status}; only PENDING transactions can be approved or rejected`,
    )
  }
}

export class UserNotFoundError extends DomainError {
  constructor(id: string) {
    super('USER_NOT_FOUND', `User ${id} not found`)
  }
}

export class TransactionNotFoundError extends DomainError {
  constructor(id: string) {
    super('TRANSACTION_NOT_FOUND', `Transaction ${id} not found`)
  }
}
