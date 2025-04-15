# Base

FROM node:22-bookworm AS base

ARG ENV="production"

RUN apt-get update -y && apt-get install -y \
  g++ \
  make \
  automake \
  autoconf \
  libtool \
  python3 \
  ffmpeg

WORKDIR /usr/src/app

COPY --chown=node:node package.json .
COPY --chown=node:node package-lock.json .

# Build

FROM base AS build

ENV NODE_ENV=${ENV}

COPY --chown=node:node tsconfig.base.json tsconfig.base.json
COPY --chown=node:node tsup.config.ts .

RUN npm install

COPY --chown=node:node src/ src/

RUN npm run build

# Bot

FROM base AS bot

ENV NODE_ENV=${ENV}
ENV NODE_OPTIONS="--preserve-symlinks --enable-source-maps"

COPY --chown=node:node --from=build /usr/src/app/node_modules node_modules
COPY --chown=node:node --from=build /usr/src/app/dist dist

RUN chown node:node /usr/src/app

USER node

CMD [ "node", "dist/index.js" ]
