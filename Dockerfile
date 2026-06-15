# Использовать официальный образ Node.js (Debian Bullseye)
FROM node:20-bullseye-slim

# Установка системных зависимостей для Python, компиляции (kerykeion/pyswisseph) и Puppeteer (Chromium)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    libxss1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnss3 \
    libxshmfence1 \
    libasound2 \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем переменные окружения для Puppeteer, чтобы использовать установленный в системе Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Создаем рабочую директорию
WORKDIR /app

# Копируем зависимости Python и создаем виртуальное окружение
COPY requirements.txt ./
RUN python3 -m venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
RUN pip3 install --no-cache-dir -r requirements.txt

# Копируем зависимости бэкенда Node.js
COPY rb-backend/package*.json ./rb-backend/
WORKDIR /app/rb-backend
RUN npm ci --omit=dev

# Возвращаемся в корень и копируем остальные файлы проекта
WORKDIR /app
COPY . .

# Открываем порт Express-сервера
EXPOSE 3000

# Запуск приложения
WORKDIR /app/rb-backend
CMD ["node", "server.js"]
