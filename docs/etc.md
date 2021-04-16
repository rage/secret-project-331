# etc

## New migrations

In the headless_lms folder run:

```bash
sqlx migrate add -r migration_name
```

Then write your migration in `<>.up.sql` and write the reverse migration in `<>.down.sql`.
