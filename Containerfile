# Backend-only image for the Vercel `backend` service (vercel.json).
#
# Same build as the root Dockerfile minus nginx and the Next.js frontend: on
# Vercel the frontend is its own service and public routing (/api → backend,
# prefix stripped by a request.path transform) replaces nginx.
#
# Named `Containerfile` because Vercel's container entrypoint must be a file
# called Dockerfile or Containerfile, and the root `Dockerfile` is the
# all-in-one production image. (Note: a bare `podman build .` prefers this
# file over Dockerfile — pass `-f Dockerfile` for the all-in-one image.)
#
# This file lives at the repo root on purpose: Vercel uses the Dockerfile's own
# directory as the build context, and the backend build needs the whole
# workspace (pnpm-lock.yaml, libraries/*). From apps/backend the install failed
# with ERR_PNPM_NO_LOCKFILE. The root .dockerignore applies.

# ---------- builder ----------
FROM node:24.19.0-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    make \
    python3-pip \
    bash \
    ca-certificates \
&& rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=1
RUN npm --no-update-notifier --no-fund --global install pnpm@10.34.4

WORKDIR /app
COPY . /app

# One RUN on purpose, so only the final (pruned) tree becomes a layer: a
# full-workspace install committed as its own layer (173 projects incl. the
# Next.js frontend, ~5 GB) ran Vercel's build machine out of disk
# ("no space left on device").
#  1. install only the root (prisma generate runs in its postinstall) and the
#     backend with its workspace dependencies — no frontend/extension/docs;
#  2. build the backend;
#  3. re-run the same filtered install with --prod to drop devDependencies
#     (scripts skipped: the generated Prisma client is already in place);
#  4. delete the package store — node_modules are hard links into it.
RUN pnpm install --frozen-lockfile --store-dir /tmp/pnpm-store \
      --filter "{.}" --filter "{./apps/backend}..." \
 && NODE_OPTIONS="--max-old-space-size=4096" pnpm run build:backend \
 && CI=true pnpm install --frozen-lockfile --prod --offline --ignore-scripts \
      --store-dir /tmp/pnpm-store --filter "{.}" --filter "{./apps/backend}..." \
 && rm -rf /tmp/pnpm-store /root/.cache /root/.local/share/pnpm

# ---------- runtime ----------
FROM node:24.19.0-bookworm-slim AS runtime

# chromium + ffmpeg: the in-process video renderer; the rest are native libs
# canvas links against. Same set as the root Dockerfile, without nginx.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-liberation \
    fonts-dejavu-core \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    ca-certificates \
&& rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV TZ=UTC
# Vercel routes container traffic to $PORT (default 80). An unprivileged user
# cannot bind 80, so the project must set PORT=3000 (Project → Environment
# Variables); this default keeps the image and that setting in agreement.
ENV PORT=3000

RUN addgroup --system app \
 && adduser --system --ingroup app --home /app --shell /usr/sbin/nologin app

WORKDIR /app
COPY --from=builder --chown=app:app /app /app
USER app

EXPOSE 3000
CMD ["node", "--experimental-require-module", "/app/apps/backend/dist/apps/backend/src/main.js"]
