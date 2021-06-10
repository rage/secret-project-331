# Notes on headless lms

Creating new SQL queries in headless-lms using Sqlx requires running `bin/sqlx-prepare` so that it builds.

## Sqlx data types

https://docs.rs/sqlx/0.5.5/sqlx/postgres/types/index.html

## New migrations

First, stop `bin/dev` if you have that running and start `bin/dev-only-db`. This is because `bin/dev` automatically runs migrations and you don't want to run your new migration before it's ready.

In the root of the repo run:

```bash
bin/sqlx-migrate-add migration_name
```

Then write your migration in `services/headless-lms/migrations/<>.up.sql` and write the reverse migration in `services/headless-lms/migrations/<>.down.sql`.

Run migrations with `bin/sqlx-migrate-run` or `bin/sqlx-migrate-revert`. Once done with the migration, test the migration by running the migration, then reverting it, and finally running it again.

## Setup development with a local Postgres

Usually you don't need this as you can use the Postgres started by either `bin/dev` or `bin/dev-only-db`.

1. Rename `.env.example` -> `.env`
2. In `.env` setup `DATABASE_URL=postgres://localhost/headless_lms_dev`
3. `bin/local-dev-db-create-user`
4. `bin/local-dev-db-create`
5. Run `bin/sqlx-migrate-run`
6. (Optional) `bin/seed-local`
7. If migrations succeed, run `bin/dev`

## New endpoint

When creating a new endpoint, please bear in mind that it should follow the Separation of Concerns.

Walkthrough how to create an endpoint for LMS.

As an example, let's create an endpoint `/api/v0/bogus/foo/`, where bogus is our microservice, foo is our db model and endpoint.

This said, the endpoint should be used for the `bogus` microservice and endpoints should return `foo`s or take `foo_id` as parameter.

1. Create `foo.rs` in folder `src/models/`, if not present
2. Create `foo.rs` in folder `src/controllers/bogus/`, if not present
3. In `src/controllers/mod.rs` add the new microservice to `configure_controllers` -> `.service(web::scope("/bogus").configure(_add_bogus_routes))`, if not present.
4. Write the new `_add_bogus_routes` function in the `src/controllers/bogus/mod.rs` file and create necessary submodules. (Hint: See existing, example below).
```rust
/*!
Handlers for HTTP requests to `/api/v0/bogus`.

This documents all endpoints. Select a module below for a category.

*/

pub mod foo;

use actix_web::web::{self, ServiceConfig};

use self::{foo::_add_foo_routes};

/// Add controllers from all the submodules.
pub fn add_bogus_routes(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/foo").configure(_add_foo_routes));
}


```
5. In `src/controllers/bogus/foo.rs` add the routes in e.g. `_add_foo_routes`, so if you would like to create a CRUD for `foo`, you would add 4 routes as following:
```rust
pub fn _add_foo_routes(cfg: &mut ServiceConfig) {
  cfg.route("", web::get().to(get_all_foos))
      .route("", web::post().to(post_new_foo))
      .route("/{foo_id}", web::put().to(update_foo))
      .route("/{foo_id}", web::delete().to(delete_foo))
}
```
The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations, because this method preserves the function signatures for documentation.

6. Write the CRUD route methods (get_all_foos, post_new_foo etc.) in the same file.
7. Write the logic of what the endpoint does in `src/models/foo.rs` and if needed, in other models as well if more complex endpoint.
8. If needed, create a seed at `headless-lms/db/seed.sql` and seed your database.
9. Using `headless-lms/request.rest` ensure that your endpoint works and document manually the request/response above the function in `src/controllers/bogus/foo.rs`.
## Sqlx

Passing enum values as parameters to SQL queries: https://docs.rs/sqlx/0.5.5/sqlx/macro.query.html#type-overrides-bind-parameters-postgres-only

### Formatting inline SQL in Visual Studio Code

1. Convert the string to a raw string
2. Move the statement into its own line
3. Select the whole lines that contain the sql statement
4. Use the `SQLTools: Format Selected Query For Any Document` action from `ctrl-shift-p`-menu.


https://user-images.githubusercontent.com/1922896/119937781-0ed77b80-bf94-11eb-8e45-8d7172d86f48.mp4

