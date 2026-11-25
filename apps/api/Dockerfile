FROM node:22-bookworm AS base
WORKDIR /app
COPY --chmod=0644 package.json package-lock.json ./
COPY --chmod=0644 apps/api/package.json ./apps/api/package.json
COPY --chmod=0644 apps/web/package.json ./apps/web/package.json

FROM base AS build
RUN npm ci --workspace @im/api
COPY apps/api ./apps/api
RUN npm run prisma:generate -w @im/api && npm run build -w @im/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --chown=node:node apps/api/prisma ./apps/api/prisma
RUN npm ci --omit=dev --workspace @im/api && npm run prisma:generate -w @im/api
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
