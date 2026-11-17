FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_URL="https://kekhaivtvl.hcmute.edu.vn"
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
ENV ADMIN_SERVER_SECRET="build-time-only-placeholder-secret-not-used-in-runner"
ENV NEXTAUTH_SECRET="build-time-only-placeholder-secret-not-used-in-runner"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npx prisma generate
RUN npm run generate:templates
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3360
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/migrate-postgres.mjs ./scripts/migrate-postgres.mjs
COPY --from=builder /app/deploy/postgres ./deploy/postgres
COPY --from=builder /app/supabase/migrations ./supabase/migrations

RUN mkdir -p .next .data \
  && chown -R nextjs:nodejs .next .data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3360

CMD ["node", "server.js"]

