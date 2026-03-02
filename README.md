# LeagueEventBot

A Discord bot for scheduling and managing events with optional rank-based team balancing.

## Features

- **General Event Scheduling**: Create one-off or recurring events with flexible time/date/cron options
- **Three Arenas**: Arena 1, Arena 2, and Arena 3 — each with configurable player caps and emoji reactions
- **Reaction-Based Sign-up**: Players join arenas by clicking emoji reactions on the event embed
- **Optional Team Balancing**: Per-event toggle to automatically generate balanced teams at start time using a greedy rank-point algorithm
- **Player Pings at Start**: Each arena's signed-up players are individually pinged when the event starts
- **Start Messages**: Attach a public message to event start pings, and/or a separate internal message sent to an admin channel
- **Per-Event Emoji Overrides**: Override the default reaction emoji for any arena when creating an event
- **Recurring Events**: Schedule repeating events using cron expressions; all settings carry forward automatically
- **Rank System**: 8 ranks from Bronze to Master with point-based balancing
- **Rank Restrictions**: Arena 2 can be restricted to with a certain rank (with per-player whitelist override)
- **Admin Controls**: Manage players, ranks, whitelist/blocklist, and bot configuration

## Quick Start

### Prerequisites

- Node.js 20+
- A Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/wingitman/leagueeventbot
   cd LeagueEventBot
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
docker build -t leagueeventbot .
docker run -d \
  -e DISCORD_TOKEN=your_token \
  -e DISCORD_CLIENT_ID=your_client_id \
  -e GUILD_ID=your_guild_id \
  -v bot-data:/app/data \
  leagueeventbot
```

## Commands

### Player Commands

| Command        | Description                             |
| -------------- | --------------------------------------- |
| `/rank [user]` | View your rank or another player's rank |

### Admin Commands

#### Event Management

| Command                          | Description                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `/event create <time> [options]` | Create a new event (see options below)                                                |
| `/event delete <id>`             | Permanently delete an event by ID                                                     |
| `/event delete-all <status>`     | Delete all events with a given status (`pending`, `active`, `completed`, `cancelled`) |
| `/event list`                    | List upcoming and recent events                                                       |
| `/event cancel <id>`             | Cancel an event and stop any recurrence                                               |
| `/event kick <id> <user>`        | Remove a player from an event                                                         |
| `/event balance <id> <arena>`    | Manually trigger team balancing for an arena                                          |
| `/event trigger <id>`            | Manually start an event (for testing)                                                 |

##### `/event create` options

| Option             | Type    | Required | Description                                               |
| ------------------ | ------- | -------- | --------------------------------------------------------- |
| `time`             | string  | Yes      | Event time, e.g. `8:00pm` or `20:00`                      |
| `title`            | string  | No       | Event title (defaults to `Game Night`)                    |
| `date`             | string  | No       | Event date, e.g. `2025-12-25` or `tomorrow`               |
| `balance-teams`    | boolean | No       | Automatically balance teams when the event starts         |
| `recurring`        | boolean | No       | Make this a recurring event                               |
| `cron`             | string  | No       | Cron schedule for recurring events, e.g. `0 20 * * 5`     |
| `start-message`    | string  | No       | Message appended to each arena ping when the event starts |
| `internal-message` | string  | No       | Admin-only message sent to a separate channel at start    |
| `internal-channel` | channel | No       | Channel to send the internal start message to             |
| `emoji-arena1`     | string  | No       | Override the reaction emoji for Arena 1                   |
| `emoji-arena2`     | string  | No       | Override the reaction emoji for Arena 2                   |
| `emoji-arena3`     | string  | No       | Override the reaction emoji for Arena 3                   |

#### Player Management

| Command                          | Description                              |
| -------------------------------- | ---------------------------------------- |
| `/player setrank <user> <rank>`  | Set a player's rank                      |
| `/player whitelist <user>`       | Allow a high-rank player to join Arena 2 |
| `/player unwhitelist <user>`     | Remove whitelist privilege               |
| `/player block <user> <arena>`   | Block a player from an arena             |
| `/player unblock <user> <arena>` | Remove a block                           |
| `/player info <user>`            | View detailed player info                |

#### Bot Configuration

| Command                     | Description                                   |
| --------------------------- | --------------------------------------------- |
| `/config channel <channel>` | Set the channel where event embeds are posted |
| `/config pingrole <role>`   | Set the role to ping for new events           |
| `/config adminrole <role>`  | Set the role that can manage the bot          |
| `/config view`              | View current configuration                    |

## Arenas

| Arena   | Default Emoji | Max Players | Notes                                              |
| ------- | ------------- | ----------- | -------------------------------------------------- |
| Arena 1 | ✅            | 4v4         | No rank restriction                                |
| Arena 2 | 🥏            | 5v5         | Gold and below only (whitelist override available) |
| Arena 3 | 🎯            | 2v2         | No rank restriction                                |

Default emojis can be changed globally in `src/utils/constants.ts`, or overridden per event via the `emoji-arena1/2/3` options on `/event create`.

## Rank System

| Rank     | Points | Can Join Arena 2 |
| -------- | ------ | ---------------- |
| Bronze   | 1      | Yes              |
| Silver   | 2      | Yes              |
| Silver+  | 3      | Yes              |
| Gold     | 4      | Yes              |
| Gold+    | 5      | Yes              |
| Diamond  | 6      | No\*             |
| Diamond+ | 7      | No\*             |
| Master   | 8      | No\*             |

\*Unless whitelisted by an admin via `/player whitelist`

## Event Flow

1. **Admin creates event**: `/event create 8:00pm "Friday Game Night"`
2. **Bot posts embed** in the configured event channel with arena options and reaction emojis
3. **Players click reactions** to join arenas (rank restrictions enforced for Arena 2)
4. **At event time**:
   - Each arena with sign-ups sends a ping listing all signed-up players
   - If `start-message` was set, it is appended to each arena ping
   - If `internal-message` and `internal-channel` were set, the internal message is sent there
   - If `balance-teams` was enabled, balanced team suggestions are posted for each arena
   - If no one signed up, a single "no one signed up" message is sent instead
5. **2 hours later**: Event auto-expires; recurring events automatically schedule the next instance

## Recurring Events

Pass `recurring:True` and a `cron` schedule when creating an event:

```
/event create time:8:00pm title:Friday Game Night recurring:True cron:0 20 * * 5
```

When a recurring event expires, the next instance is created automatically with all the same settings (title, balance-teams, messages, emoji overrides, etc.).

### Cron Schedule Examples

| Schedule           | Cron Expression  |
| ------------------ | ---------------- |
| Fridays at 8pm     | `0 20 * * 5`     |
| Mon/Wed/Fri at 7pm | `0 19 * * 1,3,5` |
| Daily at 8:30pm    | `30 20 * * *`    |
| Weekends at 3pm    | `0 15 * * 0,6`   |

Use [crontab.guru](https://crontab.guru) to validate expressions.

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
3. Go to "Bot" and create a bot
4. Copy the token to your `.env` file
5. Enable these intents:
   - Server Members Intent
   - Message Content Intent
6. Go to "OAuth2" > "URL Generator"
7. Select scopes: `bot`, `applications.commands`
8. Select permissions:
    Permission Integer: 275146435648b
   - Send Messages
   - Embed Links
   - Add Reactions
   - Manage Messages
   - Add Roles
   - Read Message History
   - Use External Emojis
   - Use Slash Commands
9. Use the generated URL to invite the bot to your server

## License

MIT
