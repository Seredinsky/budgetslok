########################  base python  ########################
FROM python:3.11-slim AS python-base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir whitenoise

########################  build react  ########################
FROM node:20-alpine AS react-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build          # → /frontend/dist

########################  final image  ########################
FROM python-base AS final

WORKDIR /app

# 1. Копируем содержимое backend (а не папку целиком)
COPY backend/ /app/

# 2. Копируем React-билд
COPY --from=react-build /frontend/dist /app/static/react

# 3. Собираем статику
RUN python manage.py collectstatic --noinput


EXPOSE 8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "config.wsgi:application", \
     "--workers=5", "--max-requests=1000", "--timeout=60"]