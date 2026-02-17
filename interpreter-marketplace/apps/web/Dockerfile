FROM node:20-alpine

WORKDIR /app

COPY package.json ./package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm install

COPY . .

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

EXPOSE 3000
CMD ["npm","run","start","--","-H","0.0.0.0","-p","3000"]
