#!/bin/bash
set -e

# Solaris Deployment Script for Abacus.AI
# This makes the app persistent and production-ready in the current environment

echo "🌅 Solaris → Abacus.AI Deployment"
echo "===================================="
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

echo -e "${GREEN}✓ Docker available${NC}"

# Environment setup
echo ""
echo -e "${BLUE}Setting production environment...${NC}"

# Generate secure JWT secret if not exists
if [ ! -f .env.production ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head /dev/urandom | tr -dc A-Za-z0-9 | head -c 64)
    DB_PASSWORD=$(openssl rand -hex 16 2>/dev/null || head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)
    
    cat > .env.production << EOF
# Solaris Production Environment
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
API_URL=https://$(echo $PREVIEW_URL | sed 's|https://||')/api
NODE_ENV=production
EOF
    echo -e "${GREEN}✓ Created .env.production with secure secrets${NC}"
else
    echo -e "${YELLOW}⚠ Using existing .env.production${NC}"
fi

# Stop existing services
echo ""
echo -e "${BLUE}Stopping dev services...${NC}"
pkill -f "node src/server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓ Dev services stopped${NC}"

# Build and start with Docker Compose
echo ""
echo -e "${BLUE}Building Docker containers...${NC}"
docker compose --env-file .env.production build --no-cache

echo ""
echo -e "${BLUE}Starting production services...${NC}"
docker compose --env-file .env.production up -d

# Wait for services
echo ""
echo -e "${BLUE}Waiting for services to be ready...${NC}"
sleep 10

# Health check
echo ""
echo -e "${BLUE}Running health checks...${NC}"

if curl -s http://localhost:5000/health > /dev/null; then
    echo -e "${GREEN}✓ Backend healthy${NC}"
else
    echo -e "${YELLOW}⚠ Backend not responding yet, may need more time${NC}"
fi

if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✓ Frontend healthy${NC}"
else
    echo -e "${YELLOW}⚠ Frontend not responding yet, may need more time${NC}"
fi

# Seed database
echo ""
echo -e "${BLUE}Seeding database...${NC}"
docker compose --env-file .env.production run --rm seed
echo -e "${GREEN}✓ Database seeded${NC}"

# Done
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✨ Solaris deployed successfully!             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Your app is live at:${NC}"
echo "  $PREVIEW_URL"
echo ""
echo -e "${BLUE}Service status:${NC}"
docker compose ps
echo ""
echo -e "${YELLOW}Note: This deployment is tied to the VM lifecycle.${NC}"
echo -e "${YELLOW}For true always-on hosting, upgrade to Abacus.AI SuperComputer.${NC}"
echo ""
echo "Commands:"
echo "  View logs:    docker compose logs -f"
echo "  Stop:         docker compose down"
echo "  Restart:      docker compose restart"
echo "  Update:       git pull && docker compose up -d --build"
echo ""
echo "🌅 Welcome to production Solaris!"
