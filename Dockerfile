FROM node:22-slim

WORKDIR /app

# OpenSSL is required by the Prisma query engine.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Generate the Prisma client (no DB connection needed).
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3000

# On boot: apply migrations, seed sample users, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx tsx src/server.ts"]
