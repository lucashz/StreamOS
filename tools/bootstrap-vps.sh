#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root: sudo sh tools/bootstrap-vps.sh" >&2
  exit 1
fi

if [ ! -f /etc/os-release ]; then
  echo "Distribuicao Linux nao suportada." >&2
  exit 1
fi

. /etc/os-release
case "${ID:-}" in
  ubuntu|debian) ;;
  *) echo "Use Ubuntu ou Debian na VPS." >&2; exit 1 ;;
esac

deploy_user=${STREAMOS_DEPLOY_USER:-streamos}
deploy_root=${STREAMOS_DEPLOY_ROOT:-/opt/streamos}

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git openssl ufw

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" \
    -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$(dpkg --print-architecture)" "$ID" "$VERSION_CODENAME" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

if ! id "$deploy_user" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$deploy_user"
fi
usermod -aG docker "$deploy_user"
install -d -m 0750 -o "$deploy_user" -g "$deploy_user" "$deploy_root"

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

systemctl enable --now docker
docker compose version
echo "VPS pronta. Diretorio: $deploy_root | usuario: $deploy_user"
