import { InsufficientFundsError, InvalidAmountError } from './errors'

export class User {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly balance: number,
  ) {}

  debit(amount: number): User {
    this.assertPositiveAmount(amount)
    if (this.balance < amount) {
      throw new InsufficientFundsError(this.id, this.balance, amount)
    }
    return new User(this.id, this.name, this.email, this.balance - amount)
  }

  credit(amount: number): User {
    this.assertPositiveAmount(amount)
    return new User(this.id, this.name, this.email, this.balance + amount)
  }

  private assertPositiveAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new InvalidAmountError(amount)
    }
  }
}

