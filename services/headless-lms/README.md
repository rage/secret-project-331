# Headless LMS

## Development environment

Requirements:

- PostgreSQL
- Rust (https://www.rust-lang.org/tools/install)

Setup:

1. Create a .env file on based on the .env.example file
2. Run `cargo install sqlx-cli`
3. Run `bin/local-dev-db-create-user`
4. Run `bin/local-dev-db-create`
5. Run `bin/sqlx-migrate-run`
6. (Optional) Run `bin/seed-local`
7. Run `cargo install cargo-watch`
8. Run `cargo install systemfd`

Starting the development environment:

```sh
bin/dev
```

Viewing the documentation:

```sh
cargo doc --open --document-private-items
```

The docs use automatically generated JSON files which can be regenerated with

```sh
cargo run --bin doc-file-generator
```
