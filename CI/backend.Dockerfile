# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN npm install --global npm@12.1.0
COPY Backend/package.json Backend/package-lock.json ./
# Prisma generation is explicit below; never run arbitrary dependency scripts.
RUN npm ci --ignore-scripts

FROM dependencies AS build
COPY Backend/ ./
RUN npm run prisma:generate
RUN npm run build

# One-shot migration image keeps the Prisma CLI out of the runtime image.
FROM build AS migrate
CMD ["npm", "run", "prisma:migrate:deploy"]

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/scripts/storage-smoke.mjs ./scripts/storage-smoke.mjs
RUN mkdir -p /app/.storage && chown node:node /app/.storage
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
