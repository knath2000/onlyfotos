#!/bin/zsh

set -euo pipefail

project_root="${0:A:h}/.."
cd "$project_root"

lan_ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [[ -z "$lan_ip" ]]; then
  lan_ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi

if [[ -z "$lan_ip" ]]; then
  echo "Could not determine the Mac's LAN address. Connect to Wi-Fi or Ethernet and try again." >&2
  exit 1
fi

echo "OnlyFotos Metro is starting."
echo "On the iPhone, choose Enter URL manually and use:"
echo "http://${lan_ip}:8081"
echo

exec npx expo start --dev-client --host lan
