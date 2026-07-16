# Deploying SanSons POS on a VPS (Supabase DB)

This repository is optimized for deployment on a Virtual Private Server (VPS), connecting to a remote **Supabase PostgreSQL** database. You can deploy using either **Docker Compose (Recommended)** or a **Traditional Nginx + Gunicorn + Systemd** setup.

---

## Prerequisites (Common)
Configure your firewall (UFW or security groups) on the VPS to allow:
*   `80` (HTTP)
*   `443` (HTTPS)
*   `22` (SSH)

---

## Option 1: Docker Compose Deployment (Recommended)

Docker handles servers, dependencies, and routing configurations automatically.

### 1. Install Docker & Docker Compose
Log in to your VPS and install Docker:
```bash
# Update package list and install Docker
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git

# Enable Docker to run on boot
sudo systemctl enable --now docker
```

### 2. Clone Repository & Setup Environment
```bash
git clone https://github.com/moizahmad08/SAMSONPOS.git
cd SAMSONPOS

# Create a production .env file
nano .env
```
Populate your `.env` file with your production environment variables, including your Supabase credentials:
```env
DEBUG=False
SECRET_KEY=generate-a-strong-random-key-here
ALLOWED_HOSTS=your_vps_ip,your_domain.com

# Supabase Credentials
DB_ENGINE=django.db.backends.postgresql
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_supabase_password_here
DB_HOST=db.gxpphoctlyuwoucoummy.supabase.co
DB_PORT=5432
```

### 3. Spin up the containers
Build and start the web servers in the background:
```bash
sudo docker compose up -d --build
```
This compiles the React app, configures Nginx reverse proxies, starts the backend Gunicorn engine, and hooks into your Supabase database.

### 4. Run Migrations & Create Admin User
Deploy the database schemas and configure your Admin user profile:
```bash
# Run database schema migrations on Supabase
sudo docker compose exec backend python manage.py migrate

# Create the admin login credentials
sudo docker compose exec backend python manage.py createsuperuser
```

Your system is now live at `http://your_vps_ip`!

---

## Option 2: Traditional Setup (Nginx + Gunicorn + Systemd)

If you prefer to run services directly on the host machine.

### 1. Install System Dependencies
```bash
sudo apt update
sudo apt install -y python3-pip python3-venv nginx libpq-dev nodejs npm git
```
*Note: `libpq-dev` is required to build the PostgreSQL database adapter (`psycopg2`).*

### 2. Setup Django Backend
```bash
cd /var/www
sudo git clone https://github.com/moizahmad08/SAMSONPOS.git
cd SAMSONPOS/enterprise-pos/backend

# Create virtualenv and install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure production .env
nano .env
# Populate with: DB_ENGINE, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, SECRET_KEY, ALLOWED_HOSTS, etc.

# Run migrations & collect static files
python manage.py migrate
python manage.py collectstatic
python manage.py createsuperuser
```

### 3. Setup Gunicorn Systemd Service
Create the systemd daemon:
```bash
sudo nano /etc/systemd/system/gunicorn.service
```
Paste the configuration:
```ini
[Unit]
Description=Gunicorn daemon for SanSons POS Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/SAMSONPOS/enterprise-pos/backend
ExecStart=/var/www/SAMSONPOS/enterprise-pos/backend/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 config.wsgi:application

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn
```

### 4. Build React Frontend
```bash
cd /var/www/SAMSONPOS/frontend

# Install dependencies and build
npm install
npm run build
```

### 5. Setup Nginx Configuration
Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/sansons-pos
```
Add the server block:
```nginx
server {
    listen 80;
    server_name your_vps_ip_or_domain;

    # Serve Frontend compiled React files
    location / {
        root /var/www/SAMSONPOS/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy Django API requests
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Proxy Django Admin requests
    location /admin/ {
        proxy_pass http://127.0.0.1:8000/admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Serve static assets (Admin panel css/js)
    location /static/ {
        alias /var/www/SAMSONPOS/enterprise-pos/backend/staticfiles/;
    }
}
```
Link and enable the Nginx site:
```bash
sudo ln -s /etc/nginx/sites-available/sansons-pos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## SSL Configuration (Securing your POS with HTTPS)
To secure login credentials and transactions using Let's Encrypt SSL:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your_domain.com
```
This automatically updates Nginx configuration with SSL certs and configures automatic renewals.
