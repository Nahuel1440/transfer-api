import 'dotenv/config'
import { buildApp } from './app'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

const app = await buildApp()

try {
  const address = await app.listen({ port, host })
  app.log.info(`Transfers API ready at ${address} — docs at ${address}/docs`)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
