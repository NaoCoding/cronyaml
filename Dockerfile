FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY dist ./dist
COPY cron.yaml ./cron.yaml
CMD ["cronyaml", "run"]
