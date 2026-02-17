FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json ./package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm install
COPY . .
WORKDIR /app/apps/api
RUN npm run prisma:generate
EXPOSE 4000
CMD ["sh", "-c", "npm run prisma:push && npm run seed && npm run dev"]
