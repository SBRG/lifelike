ARG ELASTICSEARCH_VERSION=7.16.3
FROM docker.elastic.co/elasticsearch/elasticsearch:${ELASTICSEARCH_VERSION}

# Install ingest-attachment plugin
RUN elasticsearch-plugin install --batch ingest-attachment

# Set default configuration environment variables
ENV http.max_content_length=200mb
