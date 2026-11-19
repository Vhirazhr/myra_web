#!/usr/bin/env bash
set -euo pipefail
project_ref=splifnxylqaicneodkaj
command -v supabase >/dev/null || { echo "Install the Supabase CLI first." >&2; exit 1; }
: "${SUPABASE_ACCESS_TOKEN:?Set a deployment access token in this shell or the CI secret manager}"
: "${SUPABASE_DB_PASSWORD:?Set the database password in the secret manager}"
supabase link --project-ref "$project_ref"
supabase db push --linked --dry-run
supabase db push --linked
supabase functions deploy myra --project-ref "$project_ref"
supabase functions deploy worker --project-ref "$project_ref"
