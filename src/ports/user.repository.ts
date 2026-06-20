import type { User } from '../domain/user.entity'

export interface UserRepository {
  searchById(id: string): Promise<User | null>
  searchAndLockById(id: string): Promise<User | null>
  save(user: User): Promise<void>
}
