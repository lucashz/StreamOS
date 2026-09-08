FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_REALTIME_URL=http://localhost:3002
ARG INTERNAL_API_URL=http://api:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_REALTIME_URL=$NEXT_PUBLIC_REALTIME_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgresql://streamos:build-only@localhost:5432/streamos \
    pnpm --filter @streamos/database db:generate && pnpm build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && addgroup -S streamos && adduser -S streamos -G streamos
COPY --chown=streamos:streamos --from=build /app /app
ARG STREAMOS_PACKAGE=@streamos/api
ENV STREAMOS_PACKAGE=$STREAMOS_PACKAGE
RUN mkdir -p /app/.runtime/uploads && chown streamos:streamos /app/.runtime/uploads
USER streamos
CMD ["sh", "-c", "exec corepack pnpm --filter \"$STREAMOS_PACKAGE\" start"]
