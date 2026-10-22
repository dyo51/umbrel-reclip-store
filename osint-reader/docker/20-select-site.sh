#!/bin/sh
set -eu

case "${SITE:-}" in
  legendary|awesome) ;;
  *) echo "SITE must be legendary or awesome" >&2; exit 1 ;;
esac

cp "/opt/osint-reader/configs/${SITE}.json" /usr/share/nginx/html/config.json
cp "/opt/osint-reader/assets/${SITE}-osint.png" /usr/share/nginx/html/icon.png
cp "/opt/osint-reader/nginx-sites/${SITE}.conf" /etc/nginx/snippets/osint-source.conf
