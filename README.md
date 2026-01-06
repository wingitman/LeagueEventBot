# Discord League Bot

A Discord bot for managing game lobbies with rank-based restrictions and automatic team balancing. Built for VR gaming communities that need fair matchmaking without a dedicated system.

## Features

- **Three Lobby Types**: Competitive 4v4, Casual 4v4, and Open 5v5
- **Rank System**: 8 ranks from Bronze to Master with point-based balancing
- **Rank Restrictions**: Casual lobbies restricted to Gold+ and below (with whitelist override)
- **Team Balancing**: Automatic balanced team suggestions using greedy algorithm
- **Reaction-Based Signup**: Players join lobbies by clicking emoji reactions
- **Recurring Events**: Schedule automatic game nights with cron expressions
- **Admin Controls**: Manage players, ranks, whitelist/blocklist, and configuration

## Quick Start

### Prerequisites

- Node.js 20+
- A Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd discord-league-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your credentials:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   GUILD_ID=your_server_id_here
   ```

5. Run database migrations:
   ```bash
   npm run db:migrate
   ```

6. Start the bot:
   ```bash
   npm run dev   # Development with hot reload
   npm start     # Production
   ```

### Docker Deployment

1. Create `.env` file with your credentials

2. Build and run:
   ```bash
   docker-compose up -d
   ```

Or build manually:
```bash
docker build -t discord-league-bot .
docker run -d \
  -e DISCORD_TOKEN=your_token \
  -e DISCORD_CLIENT_ID=your_client_id \
  -e GUILD_ID=your_guild_id \
  -v bot-data:/app/data \
  discord-league-bot
```

## Commands

### Player Commands

| Command | Description |
|---------|-------------|
| `/rank [user]` | View your rank or another player's rank |

### Admin Commands

#### Player Management
| Command | Description |
|---------|-------------|
| `/player setrank <user> <rank>` | Set a player's rank |
| `/player whitelist <user>` | Allow high-rank player to join Casual |
| `/player unwhitelist <user>` | Remove whitelist privilege |
| `/player block <user> <lobby>` | Block player from a lobby type |
| `/player unblock <user> <lobby>` | Remove block |
| `/player info <user>` | View detailed player info |

#### Event Management
| Command | Description |
|---------|-------------|
| `/event create <time> [title] [date]` | Create a one-off event |
| `/event recurring <cron> <title>` | Create a recurring event |
| `/event list` | List upcoming events |
| `/event cancel <id>` | Cancel an event |
| `/event kick <id> <user>` | Kick player from event |
| `/event balance <id> <lobby>` | Manually trigger team balance |
| `/event recurring-list` | List recurring events |
| `/event recurring-cancel <id>` | Cancel recurring event |

#### Bot Configuration
| Command | Description |
|---------|-------------|
| `/config channel <channel>` | Set event posting channel |
| `/config pingrole <role>` | Set role to ping for events |
| `/config adminrole <role>` | Set bot admin role |
| `/config view` | View current configuration |

## Rank System

| Rank | Points | Can Join Casual |
|------|--------|-----------------|
| Bronze | 1 | Yes |
| Silver | 2 | Yes |
| Silver+ | 3 | Yes |
| Gold | 4 | Yes |
| Gold+ | 5 | Yes |
| Diamond | 6 | No* |
| Diamond+ | 7 | No* |
| Master | 8 | No* |

*Unless whitelisted by an admin

## Event Flow

1. **Admin creates event**: `/event create 8:00pm "Friday Game Night"`
2. **Bot posts embed** with three lobby options and reaction emojis
3. **Players click reactions** to join lobbies (rank restrictions enforced)
4. **At event time**: Bot automatically posts balanced teams for each lobby
5. **2 hours later**: Event auto-expires

## Cron Schedule Examples

For recurring events:

| Schedule | Cron Expression |
|----------|-----------------|
| Fridays at 8pm | `0 20 * * 5` |
| Mon/Wed/Fri at 7pm | `0 19 * * 1,3,5` |
| Daily at 8:30pm | `30 20 * * *` |
| Weekends at 3pm | `0 15 * * 0,6` |

## Development

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Generate new migration after schema changes
npm run db:generate

# Run migrations
npm run db:migrate

# View database (opens Drizzle Studio)
npm run db:studio

# Lint code
npm run lint

# Format code
npm run format
```

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the token to your `.env` file
5. Enable these intents:
   - Server Members Intent
   - Message Content Intent
6. Go to "OAuth2" > "URL Generator"
7. Select scopes: `bot`, `applications.commands`
8. Select permissions:
   - Send Messages
   - Embed Links
   - Add Reactions
   - Manage Messages
   - Read Message History
   - Use Slash Commands
9. Use generated URL to invite bot to your server

## License

MIT
# LeagueEventBot
