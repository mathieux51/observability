FROM oven/bun:1.0-slim

WORKDIR /app

# Copy built application (build locally, then copy)
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
COPY package.json ./

EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]
