FROM node:20-alpine AS base

WORKDIR /app

# Install OpenSSL for Prisma compatibility
RUN apk add --no-cache openssl openssl-dev

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl

# Copy built files
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/prisma ./prisma

# Regenerate Prisma client for this environment
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.js"]
