#!/bin/bash
set -e

echo "=== ActiveThread — HackerNews Edition Deploy ==="
echo ""

if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo ""
    echo "Docker installed. Please run these two commands:"
    echo "  1. Log out and back in:  exit"
    echo "  2. Re-run this script:   cd hn-activethread && bash scripts/deploy.sh"
    exit 0
fi

if [ ! -f .env ]; then
    echo "Setting up environment..."
    echo ""
    read -p "Do you have a domain? (y/n): " HAS_DOMAIN

    if [ "$HAS_DOMAIN" = "y" ]; then
        read -p "Your domain (e.g. activethread.example.com): " DOMAIN
    else
        DOMAIN=":80"
        echo "No domain — dashboard will be at http://<your-server-ip>"
    fi

    read -p "Set a Postgres password: " DB_PASS

    cat > .env <<EOF
DOMAIN=$DOMAIN
POSTGRES_USER=activethread
POSTGRES_PASSWORD=$DB_PASS
POSTGRES_DB=activethread_db
EOF

    echo ".env created."
    echo ""
fi

echo "Starting all services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo ""
echo "=== Deploy complete ==="
source .env
if [ "$DOMAIN" = ":80" ]; then
    IP=$(curl -s ifconfig.me)
    echo "Your site is live at http://$IP"
else
    echo "Your site will be live at https://$DOMAIN"
    echo "It may take a minute for the SSL certificate to be issued."
fi
echo ""
echo "Useful commands:"
echo "  docker compose logs -f          # watch all logs"
echo "  docker compose ps               # check status"
echo "  docker compose down             # stop everything"
