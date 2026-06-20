import Fastify, { type FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { createPrismaClient } from './infrastructure/persistence/prisma/client'
import { PrismaUnitOfWork } from './infrastructure/persistence/prisma/prisma-unit-of-work'
import { PrismaTransactionRepository } from './infrastructure/persistence/prisma/prisma-transaction.repository'
import { PrismaLedgerRepository } from './infrastructure/persistence/prisma/prisma-ledger.repository'
import { CreateTransaction } from './application/create-transaction.usecase'
import { ApproveTransaction } from './application/approve-transaction.usecase'
import { RejectTransaction } from './application/reject-transaction.usecase'
import { ListUserTransactions } from './application/list-user-transactions.usecase'
import { registerSwagger } from './infrastructure/plugins/swagger'
import { registerErrorHandler } from './infrastructure/http/error-handler'
import { transactionRoutes } from './infrastructure/http/transaction.routes'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>()

  const prisma = createPrismaClient()
  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  const uow = new PrismaUnitOfWork(prisma)
  const reviewThresholdCents = Number(process.env.REVIEW_THRESHOLD ?? 5_000_000)

  const useCases = {
    create: new CreateTransaction(uow, reviewThresholdCents),
    approve: new ApproveTransaction(uow),
    reject: new RejectTransaction(uow),
    list: new ListUserTransactions(
      new PrismaTransactionRepository(prisma),
      new PrismaLedgerRepository(prisma),
    ),
  }

  registerErrorHandler(app)
  await registerSwagger(app)

  app.get('/health', { schema: { tags: ['health'], summary: 'Liveness probe' } }, async () => ({
    status: 'ok',
  }))

  await app.register(transactionRoutes, { useCases })

  return app
}
