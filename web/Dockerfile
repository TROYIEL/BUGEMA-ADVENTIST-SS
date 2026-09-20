FROM node:22-alpine
WORKDIR /app

# Dependencies first, so this layer is cached until the lockfile changes.
# Scripts are skipped here on purpose: postinstall runs `prisma generate`,
# which needs the schema and prisma.config.ts that are only copied in below.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# Generate the Prisma client. prisma.config.ts insists on a DATABASE_URL even
# though `generate` never connects; the real one arrives from env_file at
# run time, never from the image.
RUN DATABASE_URL=postgresql://build:build@localhost/build npx prisma generate

EXPOSE 3000
CMD ["npm", "run", "dev"]
