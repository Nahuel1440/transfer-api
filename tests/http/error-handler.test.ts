import { describe, it, expect } from 'vitest'
import { buildApp } from '../../src/app'

// PrismaClient construction reads DATABASE_URL; a malformed-body request never
// reaches the DB, so a dummy URL is enough to build the app for this test.
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/db?schema=public'

describe('HTTP error handling', () => {
  it('returns 400 (not 500) when the JSON body is malformed', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/transactions',
        headers: { 'content-type': 'application/json' },
        payload: '{ not valid json',
      })
      expect(res.statusCode).toBe(400)
    } finally {
      await app.close()
    }
  })
})
