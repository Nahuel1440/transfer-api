import type { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Transfers API',
        description: 'Internal P2P payments API for virtual ARS accounts.',
        version: '1.0.0',
      },
      tags: [{ name: 'transactions', description: 'Transfer operations' }],
    },
  })

  await app.register(swaggerUi, { routePrefix: '/docs' })
}
