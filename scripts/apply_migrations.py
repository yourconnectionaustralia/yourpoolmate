#!/usr/bin/env python3
"""Apply new supabase/migrations/*.sql via the Supabase Management API.

Tracks applied migrations in public._applied_migrations so each file runs
exactly once.

Env: SUPABASE_ACCESS_TOKEN, PROJECT_REF

─────────────────────────────────────────────────────────────────────────────
Aug 2026 — THE SELF-HEAL LOOP IS GONE. DO NOT REINTRODUCE IT.

A previous version, on finding a migration marked applied whose schema looked
missing, deleted the record so the migration would run again. This caused an
incident against production — see the migration pipeline investigation
(Aug 2026) for the full account and the parts of it that were never fully
explained.

Migrations are ordered, not idempotent against each other. An earlier
migration re-applied after a later one is a ROLLBACK, not a repair. This
script runs each file at most once, ever, and never deletes a tracking row.

If the live schema has drifted, the fix is a NEW reconcile migration — see
008 (equipment) and 013 (water_tests). Never a re-run. `create table if not
exists` is a no-op against a pre-existing table of the wrong shape, so
re-running the original would not fix the drift anyway; it would only revert
whatever came after it.

preflight() below is the safety net: READ-ONLY, runs after every migration,
and fails the build if any column the app writes is missing. That turns a
silent runtime failure into a red build without touching anything.

Sentinels remain, but can now only cause a migration to be SKIPPED, never
re-run.
─────────────────────────────────────────────────────────────────────────────
"""
import json, os, sys, urllib.request, urllib.error, pathlib

REF = os.environ["PROJECT_REF"]
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"].strip()
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"


def column_exists(table: str, column: str) -> str:
    """SQL returning one row {"present": bool} for a specific column."""
    return (
        "select exists(select 1 from information_schema.columns "
        f"where table_schema='public' and table_name='{table}' "
        f"and column_name='{column}') as present;"
    )


# filename -> SQL returning {"present": bool} when that migration's schema is
# already in place. Used ONLY to baseline a migration that has never been
# recorded — i.e. on a database built by hand before this pipeline existed.
#
# Each probes a COLUMN, not a table name: a table existing tells you nothing
# about its shape.
#
# A sentinel can only cause a migration to be SKIPPED, never re-run.
SENTINELS = {
    "001_initial_schema.sql":
        column_exists("water_tests", "free_chlorine"),
    "002_feedback_rounds.sql":
        column_exists("feedback_rounds", "round_label"),
    "003_pool_setup_fields.sql":
        column_exists("pool_profiles", "year_built"),
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


def preflight():
    """READ-ONLY. Fail the build if the live schema can't accept what the app writes.

    The pipeline reporting success while every insert fails at runtime is the
    failure this exists to prevent. These are the columns src/lib/db.js writes
    on every save.

    This function must never modify anything. Its whole value is that it is
    safe to run on production on every push.
    """
    required = {
        "water_tests": ["ph", "free_chlorine", "total_chlorine", "alkalinity",
                        "cyanuric_acid", "calcium", "salt", "health_score",
                        "pool_id", "tested_at", "source"],
        "pool_profiles": ["user_id", "pool_shape", "volume_litres",
                          "sanitiser_type", "filter_type", "has_heater", "has_spa"],
        "equipment": ["user_id", "type", "brand", "model"],
        "pool_events": ["user_id", "event_type", "title", "occurred_at"],
        "user_profiles": ["id", "is_premium", "trial_ends_at"],
        # Written by the lifecycle edge function (migration 016), not the PWA.
        "email_sends": ["user_id", "template_key", "status", "to_email"],
    }

    missing = []
    for table, columns in required.items():
        cols = "','".join(columns)
        rows = run_sql(
            "select column_name from information_schema.columns "
            f"where table_schema='public' and table_name='{table}' "
            f"and column_name in ('{cols}');"
        ) or []
        found = {r["column_name"] for r in rows}
        for col in columns:
            if col not in found:
                missing.append(f"{table}.{col}")

    if missing:
        print("::error::Live schema is missing columns the app writes to. "
              "Inserts will fail at runtime:")
        for m in missing:
            print(f"::error::  missing {m}")
        print("::error::Fix with a NEW reconcile migration. Do not re-run an "
              "earlier migration — that reverts everything after it.")
        sys.exit(1)

    print("preflight ok — every column the app writes exists")


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

        # Recorded = done. No exceptions, no re-runs, no deletions.
        if name in applied:
            print(f"skip      {name} (already applied)")
            continue

        # Never recorded. If its schema is already present, this is a database
        # that predates the pipeline — record it without running.
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

    preflight()


if __name__ == "__main__":
    main()
