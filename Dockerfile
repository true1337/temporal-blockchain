# Используем официальный образ Node.js
FROM node:20-alpine AS base

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
COPY tsconfig.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Этап для разработки
FROM base AS development
RUN npm ci && npm cache clean --force
COPY . .
CMD ["npm", "run", "dev"]

# Этап для сборки
FROM base AS build
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build

# Продакшн этап
FROM node:20-alpine AS production

WORKDIR /app

# Копируем package.json и устанавливаем только production зависимости
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Копируем скомпилированный код из этапа build
COPY --from=build /app/dist ./dist

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["npm", "start"]

