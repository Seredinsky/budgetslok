########################  final image  ########################
FROM python-base AS final

# ─── copy backend code ───────────────────────────────────────
WORKDIR /app
COPY backend /app/backend

# ─── copy React build into static/react ──────────────────────
COPY --from=react-build /frontend/dist /app/backend/static/react

# ─── collectstatic ───────────────────────────────────────────
WORKDIR /app/backend
RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "backend.config.wsgi:application", \
     "--workers=3", "--max-requests=500", "--timeout=60"]