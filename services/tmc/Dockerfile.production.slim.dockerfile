# This image is used in skaffold.production.yaml to create a slim image that is used in production
ARG BUILD_CACHE

FROM $BUILD_CACHE as builder

FROM eu.gcr.io/moocfi-public/project-331-node-base:latest as runtime

COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/.next/static /app/.next/static

USER node

WORKDIR /app

EXPOSE 3005

CMD [ "npm", "run", "start" ]
