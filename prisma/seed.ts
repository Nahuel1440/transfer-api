import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Fixed IDs so the README and Swagger examples are reproducible.
// Balances are stored in CENTS (centavos).
const users = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Alice', email: 'alice@example.com', balance: 200_000_00 },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Bob', email: 'bob@example.com', balance: 50_000_00 },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Carol', email: 'carol@example.com', balance: 0 },
]

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name, email: user.email, balance: user.balance },
      create: user,
    })
  }
  console.log(`Seeded ${users.length} users.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
