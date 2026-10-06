FROM node:22-alpine
WORKDIR /app

# Dependencies first, so this layer is cached until the lockfile changes.
# Scripts are skipped here on purpose: postinstall runs `prisma generate`,
# which needs the schema and prisma.config.ts that are only copied in below.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# Generate the Prisma client and compile the production Next.js output.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
RUN DATABASE_URL=postgresql://build:build@localhost/build \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]