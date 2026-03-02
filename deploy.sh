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

if ! command -v pm2 &> /dev/null; then
  echo "pm2 not found, installing..."
  npm install -g pm2
  pm2 startup
  pm2 start npm --name "league-bot" --cwd /LeagueEventBot -- start
  pm2 save
elif ! pm2 describe league-bot &> /dev/null; then
  echo "league-bot process not found, registering..."
  pm2 start npm --name "league-bot" --cwd /LeagueEventBot -- start
  pm2 save
else
echo "Restarting bot..."
  pm2 restart league-bot
fi

echo "Done."
