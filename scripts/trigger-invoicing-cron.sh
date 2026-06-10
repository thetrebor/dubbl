#!/bin/bash
CRON_SECRET="5aa3425938ddaffc22e07db30b3a0c6524e9c54b0154be02"
HOST="https://invoice.robertmaefs.com"

curl -sf "$HOST/api/cron/invoicing" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -o /dev/null

if [ $? -eq 0 ]; then
  echo "[$(date)] Invoicing cron triggered successfully"
else
  echo "[$(date)] Invoicing cron failed" >&2
fi
