FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache bash
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm test && npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=8787
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-server ./dist-server
COPY --chown=node:node scripts/healthcheck.mjs scripts/smoke.mjs ./scripts/
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 CMD ["node", "scripts/healthcheck.mjs"]
CMD ["node", "dist-server/index.cjs"]
