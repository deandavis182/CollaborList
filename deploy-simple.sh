#!/bin/bash
# CollaborList - Simple Production Deploy with Automatic SSL

set -e

echo "🚀 Deploying CollaborList with automatic SSL..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.production.example .env
    echo "⚠️  Please edit .env with your domain and passwords!"
    echo "   Required: DOMAIN, ACME_EMAIL, DB_PASSWORD, JWT_SECRET"
    exit 1
fi

# Load environment
source .env

# Verify domain is set
if [ -z "$DOMAIN" ]; then
    echo "❌ DOMAIN not set in .env"
    exit 1
fi

echo "📦 Deploying for domain: $DOMAIN"

# Stop existing
docker-compose -f docker-compose.traefik.yml down

# Build and start
docker-compose -f docker-compose.traefik.yml up -d --build

echo "✅ Deployment complete!"
echo "   Your app will be available at https://$DOMAIN"
echo "   SSL certificates will be automatically obtained"
echo ""
echo "📋 Commands:"
echo "   View logs:  docker-compose -f docker-compose.traefik.yml logs -f"
echo "   Stop:       docker-compose -f docker-compose.traefik.yml down"