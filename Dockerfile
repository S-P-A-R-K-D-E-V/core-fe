# --------- deps stage ---------
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile


# --------- builder stage ---------
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build


# --------- runner stage ---------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable

COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["pnpm","start"]