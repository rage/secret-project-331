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

## Using postgres enums in SQLx queries

SQLx isn't able to automatically use postgres enums in its queries; it needs a type hint. For example, given the following postgres enum
```postgres
CREATE TYPE user_role AS ENUM ('admin', 'assistant', 'teacher', 'reviewer');
```
and corresponding Rust enum
```rust
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
pub enum UserRole {
    Admin,
    Assistant,
    Teacher,
    Reviewer,
}
```
you could use `sqlx::query!` like this
```rust
let role: UserRole = sqlx::query!(r#"SELECT role AS "role: UserRole" FROM roles"#)
    .fetch_one(&mut connection) //               ^^^^^^^^^^^^^^^^^^^
    .await?
    .role;
```
The same syntax can be used with `sqlx::query_as!`
```rust
    let roles = sqlx::query_as!(
        Role,
        r#"SELECT organization_id, course_id, role AS "role: UserRole" FROM roles WHERE user_id = $1"#, user_id
        //                                         ^^^^^^^^^^^^^^^^^^^
    )
    .fetch_all(&mut connection)
    .await?;
```

Here, `Role` is a struct with various fields, including a `role: UserRole` field.
### Adding new tables

Use the following as a template for new tables. It includes common fields that most tables should have, a trigger for automatically updating the updated\_at field, and a comment for explaining what the table is for.

```sql
CREATE TABLE table_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON table_templates FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE table_templates IS 'An example';
```

When you come up with the table name, make sure to make it plural. If you want to look at other examples, you can observe the create statements for other tables by running `bin/database-dump-schema`.

## Setup development with a local Postgres

Usually you don't need this as you can use the Postgres started by either `bin/dev` or `bin/dev-only-db`.

1. Rename `.env.example` -> `.env`
2. In `.env` setup `DATABASE_URL=postgres://localhost/headless_lms_dev`
3. `bin/local-dev-db-create-user`
4. `bin/local-dev-db-create`
5. Run `bin/sqlx-migrate-run`
6. (Optional) `bin/seed-local`
7. If migrations succeed, run `bin/dev`

## New struct/enum

When creating a new struct or enum, it's common to derive a set of often used traits to make the struct easier to work with, even if the traits aren't strictly needed right now.

```rust
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
struct MyNewStruct {
    some_field: u32,
}
```

Not all of the traits can be derived for every struct. In those cases, it's fine to simply leave those out.

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

### Requiring authentication

Authentication is handled by the `domain::authorization::AuthUser` extractor type. If you want an endpoint to only be accessible by authenticated users, simply add a parameter of the type `AuthUser` to that endpoint. The user's ID and other information can then be accessed through the parameter. If an unauthenticated user attempts to access the endpoint, they will receive an authorization error.

```rust
use crate::domain::authorization::AuthUser;

pub async fn private_endpoint(user: AuthUser) -> String {
    format!("Hello, {}!", user.id)
}
```

If you're making an endpoint where you want to do different things depending on whether the user is logged in or not, you can add an `Option<AuthUser>` parameter. The endpoint can still be accessed by everyone, but the argument will contain the user's details if they are authenticated.

```rust
use crate::domain::authorization::AuthUser;

pub async fn some_endpoint(user: Option<AuthUser>) -> String {
    if let Some(user) = user {
        format!("Hello, {}!", user.id)
    } else {
        "Hello, guest!".to_string()
    }
}
```

## Sqlx

Passing enum values as parameters to SQL queries: https://docs.rs/sqlx/0.5.5/sqlx/macro.query.html#type-overrides-bind-parameters-postgres-only

### Formatting inline SQL in Visual Studio Code

1. Convert the string to a raw string
2. Move the statement into its own line
3. Select the whole lines that contain the sql statement
4. Use the `SQLTools: Format Selected Query For Any Document` action from `ctrl-shift-p`-menu.


https://user-images.githubusercontent.com/1922896/119937781-0ed77b80-bf94-11eb-8e45-8d7172d86f48.mp4

