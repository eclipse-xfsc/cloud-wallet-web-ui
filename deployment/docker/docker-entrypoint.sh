#!/bin/sh
set -euo pipefail

PUBLIC_DIR="./public"
ENV_PREFIX="${ENV_PREFIX:-NEXT_PUBLIC_}"
ENV_JS_PATH="${ENV_JS_PATH:-$PUBLIC_DIR/env.js}"
START_CMD="${START_CMD:-node server.js}"

mkdir -p "$PUBLIC_DIR"

# JSON-escape Helper (nur " und \)
json_escape() {
  # shellcheck disable=SC2001
  echo "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

# env.js schreiben
{
  printf 'window.__ENV__ = {\n'

  FIRST=1
  # Alle NEXT_PUBLIC_* Variablen einsammeln (sortiert für deterministische Builds)
  # busybox/ash-kompatibel:
  for VAR in $(env | awk -F= -v pfx="$ENV_PREFIX" '$1 ~ "^"pfx {print $1}' | sort); do
    VAL=$(eval "printf '%s' \"\${$VAR}\"")
    VAL_ESC=$(json_escape "$VAL")

    if [ $FIRST -eq 1 ]; then
      FIRST=0
    else
      printf ',\n'
    fi

    # Key exakt wie in der Env (Prefix bleibt erhalten, damit es eindeutig ist)
    printf '  "%s": "%s"' "$VAR" "$VAL_ESC"
  done

  printf '\n};\n'
} > "$ENV_JS_PATH"

echo "[entrypoint] Wrote $ENV_JS_PATH:"
wc -c "$ENV_JS_PATH" | awk '{print "             size:", $1, "bytes"}'

# Falls jemand keys ohne Prefix bevorzugt, kann man optional eine 2. Map ableiten:
# window.__ENV_NOPREFIX__ = { API_URL: "...", ... }
# -> Einfach oben zusätzlich eine Schleife einbauen, die ${VAR#"$ENV_PREFIX"} nutzt.

echo "[entrypoint] Starting app: $START_CMD"
exec sh -c "$START_CMD"
