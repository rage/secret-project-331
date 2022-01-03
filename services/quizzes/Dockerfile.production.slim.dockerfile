# This image is used in skaffold.production.yml to create a slim image that is used in production
ARG BUILD_CACHE

FROM $BUILD_CACHE as builder

FROM node:16-bullseye-slim as runtime

COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/.next/static /app/.next/static

USER node

WORKDIR /app

EXPOSE 3004

CMD [ "npm", "run", "start" ]
