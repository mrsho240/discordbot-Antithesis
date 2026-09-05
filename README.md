# ModTrack Bot

A Discord bot that creates forum posts and automatically notifies you when tracked mods/modpacks receive updates. Currently supports Modrinth and CurseForge (Minecraft), designed for easy extension to additional platforms like Steam in the future.

## Features

- Create forum posts automatically with project logo, description, and links
- Periodic polling for new versions (configurable interval)
- Auto-post update notifications with download links, changelog, and project icon
- Support for Modrinth and CurseForge platforms
- Extensible adapter pattern for adding new platforms
- View project details and manage tracked items
- Manual update check command

## Requirements

- Node.js 18 or higher
- Discord bot token
- Discord server with Forum channel support
- (Optional) CurseForge API key for CurseForge tracking

## Setup

### 1. Prerequisites

Check your Node.js version:

```bash
node -v
```

If not installed, download from https://nodejs.org (LTS recommended).

### 2. Create Discord Bot

1. Go to https://discord.com/developers/applications and create a New Application
2. Go to Bot section and create a bot user (copy the token, keep it secret)
3. Keep Privileged Gateway Intents disabled (slash commands don't need them)
4. Go to OAuth2 > General and copy the Client ID
5. Go to OAuth2 > URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Permissions: View Channels, Send Messages, Create Public Threads, Send Messages in Threads, Embed Links, Manage Channels
   - Copy the generated URL and open it in a browser to invite the bot to your server

### 3. Install Project

Extract the zip and open terminal in the `modtrack-bot` folder:

```bash
npm install
```

Copy `.env.example` to `.env` and fill in the values:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=optional_guild_id_for_testing
CURSEFORGE_API_KEY=optional_curseforge_api_key
POLL_INTERVAL_MINUTES=10
```

For CurseForge API key, register at https://console.curseforge.com/ (free).

To find your Guild ID: Enable Developer Mode in Discord settings (User Settings > Advanced > Developer Mode), then right-click your server icon and select Copy Server ID.

### 4. Deploy and Run

Register slash commands with Discord:

```bash
npm run deploy-commands
```

Start the bot:

```bash
npm start
```

You should see: "Bot logged in successfully as BotName#0000" in the terminal.

**Note:** The bot only runs while the terminal window is open. For persistent running, use pm2:

```bash
npm install -g pm2
pm2 start src/index.js --name modtrack-bot
pm2 save
```

## Usage

All commands require the user to have Manage Channels permission (except `/track info` which is read-only).

### Create a Forum Channel (if needed)

```
/track create-forum name:modpack-updates
```

### Add Tracking (creates forum post automatically)

```
/track add platform:Modrinth project_id:prominence-2-hasturian-era forum:#modpack-updates
```

Parameters:
- `platform`: Either `Modrinth` or `Curseforge`
- `project_id`: For Modrinth, use the slug from the URL (e.g., `prominence-2-hasturian-era`). For CurseForge, use the mod ID number.
- `forum`: Target forum channel
- `title` (optional): Custom post title instead of using project name
- `description` (optional): Custom description instead of using project description

The initial post will include project logo, full description, and link to the project page. You can edit this post like any Discord message. When updates are found, the bot will post new messages in the same thread with download links, changelog, and project icon.

### View Tracked Projects

```
/track list
```

Shows all projects tracked in the current server.

### View Project Details

```
/track info project_id:prominence-2-hasturian-era
```

Displays logo, description, current version, and links for a tracked project.

### Stop Tracking

```
/track remove project_id:prominence-2-hasturian-era
```

Stops monitoring but does not delete the forum post or thread.

### Manual Update Check

```
/track check-now
```

Immediately check all tracked projects for updates instead of waiting for the next polling cycle.

## Project Structure

```
src/
  index.js           - Bot entry point
  deploy-commands.js - Register slash commands
  db.js              - JSON database (data/db.json)
  poller.js          - Periodically check for updates and post notifications
  commands/track.js  - All /track subcommands
  adapters/
    index.js         - Adapter registry
    modrinth.js      - Modrinth platform adapter
    curseforge.js    - CurseForge platform adapter
```

## Adding New Platforms

To add a new platform (e.g., Steam):

1. Create `src/adapters/steam.js` implementing:
   - `getProjectInfo(id)` - Fetch project metadata
   - `getLatestVersion(id)` - Get latest version/update
   - `getVersionId(version)` - Return unique version identifier
   - `formatVersionMessage(version, projectInfo)` - Format update message

2. Register in `src/adapters/index.js`:
   ```javascript
   import * as steam from './steam.js';
   // Add to adapters object
   ```

The entire system will automatically support the new platform without modifying other files.

## Environment Variables

- `DISCORD_TOKEN` (required): Bot token from Discord Developer Portal
- `CLIENT_ID` (required): Application ID from Discord Developer Portal
- `GUILD_ID` (optional): Guild ID for testing (slash commands appear instantly in this server)
- `CURSEFORGE_API_KEY` (optional): API key for CurseForge support
- `POLL_INTERVAL_MINUTES` (optional): Check interval in minutes (default: 10)

## Database

Tracked projects are stored in `data/db.json` as JSON. Structure:

```json
{
  "tracks": [
    {
      "guildId": "discord_server_id",
      "forumId": "forum_channel_id",
      "threadId": "thread_id",
      "platform": "modrinth",
      "projectId": "project_slug_or_id",
      "lastVersionId": "version_id",
      "name": "project_name"
    }
  ]
}
```

## Hosting

For 24/7 uptime, deploy to:
- **Railway** - Free tier with GitHub integration (recommended for beginners)
- **Oracle Cloud Free Tier** - Always-free VM
- **VPS** - DigitalOcean, Vultr, or similar ($4-6/month)

The same code runs on all platforms without modification.

## License

MIT

## Support

For issues or feature requests, please open an issue on GitHub.
