ARG NODE_IMAGE_TAG=node:14

# ==================================================================
# Angular app dependencies by default used for local development
# ==================================================================
FROM $NODE_IMAGE_TAG as angular-deps
WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
ARG YARN_INSTALL_OPTS
RUN yarn install ${YARN_INSTALL_OPTS}

ENV ENVIRONMENT_CONFIG development


# ========================================
# Angular app bundle build
# ========================================
FROM angular-deps as angular-build

# Copy the code and build the app bundle
COPY src ./src
COPY tslint ./tslint
COPY e2e ./e2e
COPY *.json browserslist ./

ARG ANGULAR_CONFIG=production
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN yarn build --configuration=$ANGULAR_CONFIG --output-path=dist

# When targeting this image stage, run angulat dev server
EXPOSE 4200
HEALTHCHECK --interval=5m --timeout=10s \
  CMD curl -f localhost:4200 || exit 1
CMD yarn dev-start


# ========================================
# Runtime stage - NGINX
# ========================================
FROM nginx:1.21
LABEL org.opencontainers.image.source https://github.com/SBRG/lifelike

WORKDIR /usr/share/nginx/html

# Copy built assets
COPY --from=angular-build /app/dist ./

# Copy nginx configuraiton template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# appserver URL to proxy /api requests
ENV APPSERVER_URL http://appserver:5000

# List of space delimited list of non-stantdard MIME types
# which are known to benefit from gzip compression (text based content)
ENV GZIP_EXTRA_TYPES text/tsv vnd.lifelike.document/bioc vnd.lifelike.document/enrichment-table vnd.lifelike.document/graph vnd.lifelike.document/map

# Runtime environment configuration preset
ENV ENVIRONMENT_CONFIG production

# Listen port
ENV PORT 80
EXPOSE $PORT
