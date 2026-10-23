#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! docker compose ps --status running --services 2>/dev/null | grep -qx mysql; then
  echo "El servicio mysql no está en ejecución. Inicia el entorno antes de respaldar." >&2
  exit 1
fi

mkdir -p backups
umask 077
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="backups/nexora-${STAMP}.sql.gz"

echo "Creando respaldo en ${OUT}..."
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump -uroot --single-transaction --quick --lock-tables=false "$MARIADB_DATABASE"' \
  | gzip -9 > "$OUT"

if [[ ! -s "$OUT" ]]; then
  rm -f "$OUT"
  echo "El respaldo quedó vacío; se eliminó el archivo incompleto." >&2
  exit 1
fi

gzip -t "$OUT"
chmod 600 "$OUT"
printf 'Respaldo verificado: %s (%s bytes)\n' "$OUT" "$(stat -c %s "$OUT")"
