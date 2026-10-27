FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nexo && useradd --system --uid 1001 --gid nexo nexo
COPY --from=builder --chown=nexo:nexo /app/.next/standalone ./
COPY --from=builder --chown=nexo:nexo /app/.next/static ./.next/static
COPY --from=builder --chown=nexo:nexo /app/public ./public
USER nexo
EXPOSE 3000
CMD ["node", "server.js"]

FROM dependencies AS migrate
COPY . .
RUN pnpm exec prisma generate
CMD ["npm", "run", "db:setup"]
