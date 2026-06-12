#!/usr/bin/env python3
"""Apply new supabase/migrations/*.sql via the Supabase Management API.

Tracks applied migrations in public._applied_migrations so each file runs
exactly once. Migrations 001-003 were applied manually before CI existed,
so they are baselined (recorded as applied without running) on first use.

Env: SUPABASE_ACCESS_TOKEN, PROJECT_REF
"""
import json, os, sys, urllib.request, pathlib

REF = os.environ["PROJECT_REF"]
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"].strip()
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"

# Applied by hand in the SQL editor before this pipeline existed:
BASELINE = {
    "001_initial_schema.sql",
    "002_feedback_rounds.sql",
    "003_pool_setup_fields.sql",
}

def run_sql(sql: str):
    """POST one SQL batch; on HTTP error, print the response body before raising."""
    req = urllib.request.Request(
        API,
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            # api.supabase.com sits behind Cloudflare, which 403s the default
            # "Python-urllib" user agent. Identify as a real client.
            "User-Agent": "yourpoolmate-ci/1.0 (+github-actions)",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:1000]
        print(f"::error::Supabase API {e.code} on {API}\n{body}")
        raise

def main():
    run_sql("""create table if not exists public._applied_migrations (
        filename text primary key, applied_at timestamptz not null default now());
        alter table public._applied_migrations enable row level security;
        revoke all on public._applied_migrations from anon, authenticated;""")

    rows = run_sql("select filename from public._applied_migrations;") or []
    applied = {r["filename"] for r in rows}

    migrations = sorted(pathlib.Path("supabase/migrations").glob("*.sql"))
    for path in migrations:
        name = path.name
        if name in applied:
            print(f"skip      {name} (already applied)")
            continue
        if name in BASELINE:
            run_sql(f"insert into public._applied_migrations (filename) values ('{name}') on conflict do nothing;")
            print(f"baseline  {name} (recorded, not run)")
            continue
        print(f"apply     {name} ...", flush=True)
        try:
            run_sql(path.read_text())
            run_sql(f"insert into public._applied_migrations (filename) values ('{name}');")
            print(f"applied   {name}")
        except urllib.error.HTTPError as e:
            print(f"::error::{name} failed: {e.read().decode()[:500]}")
            sys.exit(1)

if __name__ == "__main__":
    main()
