# Railway / Docker production image
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

COPY tsconfig.json ./
COPY scripts ./scripts/
COPY src ./src/
RUN npm run build && npx prisma generate

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

COPY --from=build /app/dist ./dist
COPY scripts/check-deploy-env.js scripts/start-production.sh ./scripts/
RUN chmod +x ./scripts/start-production.sh

EXPOSE 4000
CMD ["./scripts/start-production.sh"]
