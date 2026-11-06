FROM $REGISTRY/base-int/node:20.16.0-alpine3.20
WORKDIR /app
COPY dist/ .
EXPOSE 3000
CMD ["node", "server.js"]