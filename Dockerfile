
ARG NODE_ENV

# Base

FROM node:18-alpine AS base

WORKDIR /usr/src/app

RUN apk add --no-cache --virtual .build-deps \
  g++ \
  make \
  automake \
  autoconf \
  libtool \
  python3

COPY --chown=node:node package.json .
COPY --chown=node:node package-lock.json .

# Build

FROM base AS build

WORKDIR /usr/src/app

ENV NODE_ENV=development

COPY --chown=node:node tsconfig.base.json tsconfig.base.json
COPY --chown=node:node tsup.config.ts .
COPY --chown=node:node src/ src/

RUN npm install
RUN npm run build

# Bot

FROM base AS bot

WORKDIR /usr/src/app

# ENV NODE_ENV $NODE_ENV
ENV NODE_OPTIONS="--preserve-symlinks --enable-source-maps"

COPY --chown=node:node --from=build /usr/src/app/node_modules node_modules
COPY --chown=node:node --from=build /usr/src/app/dist dist

RUN chown node:node /usr/src/app

USER node

CMD [ "node", "dist/index.js" ]
