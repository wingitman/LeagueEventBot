#!/bin/bash
set -e

echo "Pulling latest changes..."
git pull

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Running database migrations..."
npm run db:migrate

echo "Restarting bot..."
pm2 restart league-bot

echo "Done."
