#!/bin/sh
# stop leftover test servers
for p in $(pgrep -f "tls-proxy.mjs") $(pgrep -f "node dist/server/index.js"); do kill "$p" 2>/dev/null; done
exit 0
