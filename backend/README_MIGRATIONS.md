# Database Migrations

AI Family OS uses Alembic to keep database schema changes versioned and repeatable.

## First-time setup on an existing database

Run from `backend/`:

```bash
alembic upgrade head
```

The first migration is a baseline. It enables `pgvector`, creates any missing current tables, and records the database revision without dropping existing data.

## After changing models

1. Generate a migration:

```bash
alembic revision --autogenerate -m "describe change"
```

2. Review the generated file in `alembic/versions/`.

3. Apply it:

```bash
alembic upgrade head
```

## Before production deploys

1. Back up the database.
2. Pull the target Git commit.
3. Run:

```bash
cd backend
alembic upgrade head
```

4. Restart the backend/frontend services.
5. Run a smoke test: login, admin page, courses, experts, assessment, AI chat.

## Check current database revision

```bash
cd backend
alembic current
```
