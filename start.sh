#!/usr/bin/env bash
set -euo pipefail

# Start backend
if [[ -x "backend/.venv/bin/uvicorn" ]]; then
  backend_cmd=("backend/.venv/bin/uvicorn" app.main:app --reload --app-dir backend --host 0.0.0.0 --port 8001)
else
  backend_cmd=(uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0 --port 8001)
fi

# Start frontend (Expo)
# Clear Expo's cached environment so API URL changes reach physical devices.
frontend_cmd=(npm --prefix frontend run start -- --clear)

"${backend_cmd[@]}" &
backend_pid=$!

cleanup() {
  kill "$backend_pid" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Keep Expo in the foreground so keyboard shortcuts such as i, a, and w work.
"${frontend_cmd[@]}"
