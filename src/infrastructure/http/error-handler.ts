import type { FastifyError, FastifyInstance } from 'fastify'
import { DomainError } from '../../domain/errors'

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_AMOUNT: 400,
  SAME_ACCOUNT_TRANSFER: 400,
  USER_NOT_FOUND: 404,
  TRANSACTION_NOT_FOUND: 404,
  INSUFFICIENT_FUNDS: 409,
  TRANSACTION_NOT_PENDING: 409,
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof DomainError) {
      const status = STATUS_BY_CODE[error.code] ?? 422
      return reply.status(status).send({ code: error.code, message: error.message })
    }

    if (error.validation) {
      return reply.status(400).send({ code: 'VALIDATION_ERROR', message: error.message })
    }

    // Fastify client errors (malformed JSON, unsupported media type, payload too
    // large, ...) carry their own 4xx statusCode — honor it instead of masking a
    // client mistake as a 500.
    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        code: error.code ?? 'BAD_REQUEST',
        message: error.message,
      })
    }

    app.log.error(error)
    return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Internal server error' })
  })
}
