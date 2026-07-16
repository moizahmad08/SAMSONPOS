# Deploying SanSons POS on a VPS

This repository is optimized for deployment on a Virtual Private Server (VPS). You can deploy using either **Docker Compose (Recommended)** or a **Traditional Nginx + Gunicorn + Systemd** setup.

---

## Prerequisites (Common)
Before deployment, configure your firewall (UFW or security groups) to allow the following ports:
*   `80` (HTTP)
*   `443` (HTTPS)
*   `22` (SSH)

---

## Option 1: Docker Compose Deployment (Recommended)

Docker handles databases, dependencies, servers, and configurations automatically.

### 1. Install Docker & Docker Compose
Log in to your VPS and install Docker:
```bash
# Update package list and install Docker
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git

# Enable Docker to run on boot
sudo systemctl enable --now docker
```

### 2. Clone Repository & Setup Environments
```bash
git clone https://github.com/moizahmad08/SAMSONPOS.git
cd SAMSONPOS

# Create a production .env file
nano .env
```
Inside your `.env` file, configure the production variables:
```env
DEBUG=False
SECRET_KEY=generate-a-strong-random-key-here
ALLOWED_HOSTS=your_vps_ip,your_domain.com
DB_NAME=pos_db
DB_USER=root
DB_PASSWORD=your_strong_mysql_password
```

### 3. Spin up the containers
Build and start all services in the background:
```bash
sudo docker compose up -d --build
```
This builds the React app, prepares Nginx to serve the site on port 80, starts MySQL, and runs Gunicorn for the Django backend.

### 4. Run Migrations & Create Admin User
Initialize the MySQL database and register your Admin superuser:
```bash
# Run database schema migrations
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
sudo apt install -y python3-pip python3-venv nginx mysql-server libmysqlclient-dev nodejs npm git
```

### 2. Configure MySQL Database
Log into MySQL and set up the schema:
```sql
CREATE DATABASE pos_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'root'@'localhost' IDENTIFIED BY 'your_strong_mysql_password';
GRANT ALL PRIVILEGES ON pos_db.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Setup Django Backend
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
# Populate with: DB_NAME, DB_USER, DB_PASSWORD, SECRET_KEY, ALLOWED_HOSTS, etc.

# Run migrations & collect static files
python manage.py migrate
python manage.py collectstatic
python manage.py createsuperuser
```

### 4. Setup Gunicorn Systemd Service
Create a Gunicorn systemd service:
```bash
sudo nano /etc/systemd/system/gunicorn.service
```
Paste the configuration (modify paths as necessary):
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
Enable and start Gunicorn:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn
```

### 5. Build React Frontend
```bash
cd /var/www/SAMSONPOS/frontend

# Install dependencies and build
npm install
npm run build
```
This generates the optimized production build directory inside `/var/www/SAMSONPOS/frontend/dist`.

### 6. Setup Nginx Configuration
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
