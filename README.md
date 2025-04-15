# Azula

> A music bot for Discord, aimed to be the most feature-complete bot in the whole world!

## Requirements

- Docker
- Fill `.env` variables with your Discord token, template is inside `.env.example`

## Development

You can develop using Docker Compose, but you can also opt for native development. It's ultimately your choice.

```bash
docker compose up
```

## Installing new packages

To install new packages, the following command will create an ephemeral container, run `npm install` and delete itself automatically. This will also update your `package-lock.json`, which is totally normal. You must restart and/or rebuild running Compose projects.

```bash
docker run --rm -it -v $(pwd):/usr/src/app -w /usr/src/app node:22-bookworm npm install
```

## Deployment

You can deploy to Kubernetes, this is how we do it. But you can also run it simply within Docker and not worry about deployment stuff.

```bash
docker build -t azula:latest .
docker run -e .env azula:latest
```

## License

License is GPL-3.0 because I think contributions go a long way.
