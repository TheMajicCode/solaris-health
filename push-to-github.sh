#!/bin/bash
set -e

echo "🚀 Solaris → GitHub Push Script"
echo "================================"
echo ""

# Check if in git repo
if [ ! -d .git ]; then
    echo "❌ Not in a git repository. Run this from the luca-passport folder."
    exit 1
fi

# Check if origin exists
if git remote get-url origin > /dev/null 2>&1; then
    echo "✓ Remote 'origin' already configured:"
    git remote get-url origin
else
    echo "Adding remote origin..."
    git remote add origin https://github.com/TheMajicCode/solaris-health.git
    echo "✓ Remote added"
fi

echo ""
echo "📦 Checking what will be pushed..."
git log --oneline -5
echo ""

echo "🚀 Pushing to GitHub..."
git push -u origin master

echo ""
echo "✅ SUCCESS! Solaris is now on GitHub"
echo ""
echo "View your repo: https://github.com/TheMajicCode/solaris-health"
echo ""
echo "Next step: Deploy to SuperComputer"
echo "  1. Clone in SuperComputer: git clone https://github.com/TheMajicCode/solaris-health.git"
echo "  2. Run deployment: cd solaris-health && ./deploy-abacus.sh"
