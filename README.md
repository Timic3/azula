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

If playback doesn't work out of the box for you, follow instructions on how to generate Proof of Origin token [here](https://github.com/iv-org/youtube-trusted-session-generator) (using Docker is recommended!). Then set `YOUTUBE_PO_TOKEN` and `YOUTUBE_VISITOR_DATA` inside `.env` appropriately.

## Generating validation tokens

1. Run `docker run quay.io/invidious/youtube-trusted-session-generator` on your local machine.
2. Add `visitor_data` and `po_token` to the `.env`:

```
YOUTUBE_VISITOR_DATA="Cg...iEgJw%3D%3D"
YOUTUBE_PO_TOKEN="Mp...Sw=="
```

## License

License is GPL-3.0 because I think contributions go a long way.
