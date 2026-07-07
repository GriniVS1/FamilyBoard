FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM base AS runner
# Baked at build time (build-image.sh / CI pass --build-arg APP_VERSION=vX.Y.Z);
# synced into Installation.appVersion at app boot for the OTA updater.
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache sudo util-linux

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

RUN printf 'nextjs ALL=(root) NOPASSWD: /usr/bin/nsenter\n' > /etc/sudoers.d/familyboard \
 && chmod 440 /etc/sudoers.d/familyboard

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-migrate.mjs ./scripts/docker-migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/host-sync.sh ./scripts/host-sync.sh
ENV PATH="/app/node_modules/.bin:${PATH}"

# Host payload: everything the Pi HOST needs (OTA updater, systemd units,
# compose override, sudoers). scripts/host-sync.sh streams it onto the host via
# nsenter at container start when versions differ, so host-side files stay
# OTA-updatable without re-flashing the base image.
COPY --from=builder /app/scripts/pi/host-payload/apply.sh \
     /app/scripts/pi/familyboard-updater.sh \
     /app/scripts/pi/familyboard-updater.service \
     /app/scripts/pi/familyboard-updater.timer \
     /app/scripts/pi/familyboard-updater.path \
     /app/scripts/pi/familyboard.service \
     /app/scripts/pi/familyboard-avahi.service \
     /app/scripts/pi/updater.env \
     /app/scripts/pi/sudoers.d/familyboard-network \
     ./host-payload/
COPY --from=builder /app/docker-compose.pi.yml ./host-payload/docker-compose.pi.yml
RUN printf '%s\n' "$APP_VERSION" > ./host-payload/version

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000

# Deterministic, data-preserving schema upgrades (replaces `db push
# --accept-data-loss`, which could drop customer data on schema changes).
# host-sync runs in the background so a slow/failed host apply never delays or
# blocks the app; it self-skips on non-appliance deployments.
CMD ["sh", "-c", "node scripts/docker-migrate.mjs && (sh scripts/host-sync.sh &) && exec node server.js"]
