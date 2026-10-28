FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@12.15.0

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @loompilot/shared build
RUN pnpm --filter @loompilot/agents-client build
RUN pnpm --filter @loompilot/api build

EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]

