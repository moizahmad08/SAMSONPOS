# Use official light-weight Python image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies required by psycopg2-binary and pip
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies first (better layer caching)
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy project files
COPY . /app/

# Expose backend API port
EXPOSE 8000

# On startup: run migrations with fake-initial to support manual DDL, collect static files, auto-create admin, then run Gunicorn
CMD sh -c "python manage.py migrate --fake-initial --noinput && python manage.py collectstatic --noinput && python create_admin.py && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3"
