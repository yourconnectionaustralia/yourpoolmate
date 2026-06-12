#!/usr/bin/env python3
"""Apply new supabase/migrations/*.sql via the Supabase Management API.

Tracks applied migrations in public._applied_migrations so each file runs
exactly once. For the original migrations (001-003) we VERIFY whether their
schema already exists in the database:
  - exists  -> record as applied without running (baseline)
  - missing -> actually run the migration

This makes the pipeline work both on a database that was set up manually
through the SQL editor and on a completely fresh project.

Env: SUPABASE_ACCESS_TOKEN, PROJECT_REF
"""
import json, os, sys, urllib.request, urllib.error, pathlib

REF = os.environ["PROJECT_REF"]
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"].strip()
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"

# filename -> SQL that returns one row {"present": bool} when that
# migration's schema is already in place.
SENTINELS = {
    "001_initial_schema.sql":
        "select exists(select 1 from information_schema.tables "
        "where table_schema='public' and table_name='user_profiles') as present;",
    "002_feedback_rounds.sql":
        "select exists(select 1 from information_schema.tables "
        "where table_schema='public' and table_name='feedback_rounds') as present;",
    "003_pool_setup_fields.sql":
        "select exists(select 1 from information_schema.columns "
        "where table_schema='public' and table_name='pool_profiles' "
        "and column_name='year_built') as present;",
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

def schema_present(name: str) -> bool:
    rows = run_sql(SENTINELS[name]) or []
    return bool(rows and rows[0].get("present"))

def mark_applied(name: str):
    run_sql("insert into public._applied_migrations (filename) "
            f"values ('{name}') on conflict do nothing;")

def main():
    run_sql("""create table if not exists public._applied_migrations (
        filename text primary key, applied_at timestamptz not null default now());
        alter table public._applied_migrations enable row level security;
        revoke all on public._applied_migrations from anon, authenticated;""")

    rows = run_sql("select filename from public._applied_migrations;") or []
    applied = {r["filename"] for r in rows}

    # Self-heal: an earlier pipeline version blindly baselined 001-003.
    # If a sentinel migration is marked applied but its schema is missing,
    # un-mark it so it actually runs this time.
    for name in list(applied):
        if name in SENTINELS and not schema_present(name):
            run_sql(f"delete from public._applied_migrations where filename = '{name}';")
            applied.discard(name)
            print(f"unmark    {name} (was recorded as applied but schema is missing)")

    migrations = sorted(pathlib.Path("supabase/migrations").glob("*.sql"))
    for path in migrations:
        name = path.name
        if name in applied:
            print(f"skip      {name} (already applied)")
            continue
        if name in SENTINELS and schema_present(name):
            mark_applied(name)
            print(f"baseline  {name} (schema already present — recorded, not run)")
            continue
        print(f"apply     {name} ...", flush=True)
        try:
            run_sql(path.read_text())
            mark_applied(name)
            print(f"applied   {name}")
        except urllib.error.HTTPError:
            print(f"::error::{name} failed — see response above")
            sys.exit(1)

if __name__ == "__main__":
    main()
