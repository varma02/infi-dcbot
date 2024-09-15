FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache curl bash
RUN curl -fsSL https://bun.sh/install | bash

COPY package.json .
RUN bun install

COPY . .

CMD ["bun", "run", "src/index.ts"]