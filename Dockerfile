# MaiGuard API. The web app is deployed separately (Firebase Hosting).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci -w @maiguard/server --include-workspace-root=false
COPY server server
RUN npm run build -w @maiguard/server && npm prune --omit=dev -w @maiguard/server

FROM node:24-alpine
ENV NODE_ENV=production PORT=8787
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/server/dist server/dist
# Member contacts and accounts are saved here (a volume on the server).
RUN mkdir -p /app/data && chown node:node /app/data
ENV MAIGUARD_DATA_DIR=/app/data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "server/dist/index.js"]
