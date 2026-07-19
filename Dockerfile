# PacoInvestor — Production Dockerfile
FROM node:22-slim AS builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# --- Production ---
FROM node:22-slim AS runner

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/build ./build
COPY --from=builder /app/static ./static
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV PACO_DB_PATH=/app/data/paco.db
EXPOSE 3000

CMD ["sh", "entrypoint.sh"]
