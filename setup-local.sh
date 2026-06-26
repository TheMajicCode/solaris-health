#!/bin/bash
set -e

echo "🌅 Solaris Local Setup"
echo "====================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install from https://nodejs.org"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL not found. Install from https://postgresql.org"; exit 1; }
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"
echo -e "${GREEN}✓ PostgreSQL installed${NC}"
echo ""

# Database setup
echo -e "${BLUE}Setting up database...${NC}"
DB_USER="luca_user"
DB_PASS="luca_dev_2026"
DB_NAME="luca_passport"
DB_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo -e "${YELLOW}⚠ Database '$DB_NAME' already exists. Skip creation? (y/n)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Exiting. Drop the database manually if needed: psql postgres -c \"DROP DATABASE $DB_NAME;\""
        exit 1
    fi
else
    echo "Creating user and database..."
    psql postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "User might already exist"
    psql postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    echo -e "${GREEN}✓ Database created${NC}"
fi

echo "Applying schema..."
cd backend
psql "$DB_URL" -f schema.sql -q
psql "$DB_URL" -f schema_solaris.sql -q
echo -e "${GREEN}✓ Schema applied${NC}"

echo "Seeding demo data..."
node seed_solaris.js
echo -e "${GREEN}✓ Demo data seeded${NC}"
cd ..

# Backend dependencies
echo ""
echo -e "${BLUE}Installing backend dependencies...${NC}"
cd backend
npm install --silent
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Create .env if missing
if [ ! -f .env ]; then
    echo "Creating backend/.env..."
    cat > .env << EOF
DATABASE_URL=$DB_URL
JWT_SECRET=luca_dev_secret_2026_sovereign_health
PORT=5000
NODE_ENV=development
EOF
    echo -e "${GREEN}✓ .env created${NC}"
fi
cd ..

# Frontend dependencies
echo ""
echo -e "${BLUE}Installing frontend dependencies...${NC}"
npm install --silent
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# Done
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✨ Setup complete!                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo "To start the app:"
echo ""
echo -e "${BLUE}Terminal 1 (Backend):${NC}"
echo "  cd backend && node src/server.js"
echo ""
echo -e "${BLUE}Terminal 2 (Frontend):${NC}"
echo "  npx vite"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo -e "${YELLOW}Demo logins:${NC}"
echo "  Patient:      sarah@solaris.health / demo123"
echo "  Practitioner: elena@solaris.health / demo123"
echo "  Admin:        admin@solaris.health / admin123"
echo ""
echo "🌅 Welcome to Solaris!"
