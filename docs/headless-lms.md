# Notes on headless lms

Creating new migration files on with the cluster environment is hard, because it automatically runs migraitons.

## Setup local dev env

1. Rename `.env.example` -> `.env`
2. In `.env` setup `DATABASE_URL=postgres://localhost/headless_lms_dev`
3. `bin/local-dev-db-create-user`
4. `bin/local-dev-db-create`
5. Run `bin/sqlx-migrate-run`
6. If migrations succeed, run `bin/dev`

Creating new SQL queries in headless-lms using Sqlx requires running `bin/sqlx-prepare` so that it builds.
## New migrations

In the headless_lms folder run:

```bash
bin/sqlx-migrate-add migration_name
```

Then write your migration in `migrations/<>.up.sql` and write the reverse migration in `migrations/<>.down.sql`.
Run migrations with `bin/sqlx-migrate-run` or `bin/sqlx-migrate-revert`.

## Sqlx

Passing enum values as parameters to SQL queries: https://docs.rs/sqlx/0.5.5/sqlx/macro.query.html#type-overrides-bind-parameters-postgres-only

### Formatting inline SQL in Visual Studio Code

1. Convert the string to a raw string
2. Move the statement into its own line
3. Select the whole lines that contain the sql statement
4. Use the `SQLTools: Format Selected Query For Any Document` action from `ctrl-shift-p`-menu.


https://user-images.githubusercontent.com/1922896/119937781-0ed77b80-bf94-11eb-8e45-8d7172d86f48.mp4

