FROM nginx:alpine@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY web/ /usr/share/nginx/html/
COPY config/ /opt/osint-reader/configs/
COPY assets/ /opt/osint-reader/assets/
COPY docker/20-select-site.sh /docker-entrypoint.d/20-select-site.sh
RUN chmod 0755 /docker-entrypoint.d/20-select-site.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
