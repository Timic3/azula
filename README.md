# Azula

> A music bot for Discord, aimed to be the most feature-complete bot in the whole world!

## Requirements

Either Docker, if you want to only run the bot, otherwise I recommend [Volta](https://volta.sh/) as Node version manager.

## Installation

Start the bot with one simple command:

```bash
docker compose run
```

## Development

Currently, follow the steps listed below. Eventually, I plan to use separate Docker Compose config for hot reload and stuff. Feel free to contribute.

1. Install required packages with `npm install`. You will probably need `gcc` due to some native Node packages (like `@discordjs/opus`).
2. Fill `.env.example` with corresponding values. You do not need `YOUTUBE_API_KEY`, if you don't use official YouTube API.
3. Run the bot with `npm run dev`.

## License

License is GPL-3.0 because I think contributions go a long way.
