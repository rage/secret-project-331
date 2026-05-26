# Headless LMS

## Development environment

See [docs/Development.md](../../docs/Development.md) for full setup instructions. The standard `bin/dev` workflow runs PostgreSQL, Redis, and the Rust server inside a local Kubernetes cluster — no manual database setup needed.

Starting the development environment:

```sh
bin/dev
```

Viewing the Rust documentation:

```sh
cargo doc --open --document-private-items
```

The docs use automatically generated JSON files which can be regenerated with:

```sh
bin/generate-doc-files
```
