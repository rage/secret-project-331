# Exercise services client API: operations

The TestMyCode editor extension (through `tmc-langs-cli`) uses the client API at
`/api/v0/exercise-services/client`. This page lists what production needs that the code cannot set up
itself.

## The `tmc-vscode` OAuth client

The extension logs in with the device authorization flow as the public OAuth client `tmc-vscode`. The
id is hard-coded in `tmc-langs-rust` and in the extension, so it must not change. The seed creates the
client only in development and CI; production needs this row, inserted by hand:

```sql
INSERT INTO oauth_clients (
    client_id,
    client_name,
    application_type,
    token_endpoint_auth_method,
    client_secret,
    redirect_uris,
    allowed_grant_types,
    scopes,
    require_pkce,
    pkce_methods_allowed,
    bearer_allowed
  )
VALUES (
    'tmc-vscode',
    'TestMyCode for VS Code',
    'native',
    'none',
    NULL,
    ARRAY ['urn:ietf:wg:oauth:2.0:oob'],
    ARRAY ['device_code', 'refresh_token']::grant_type [],
    ARRAY ['exercise-services'],
    TRUE,
    ARRAY ['S256']::pkce_method [],
    TRUE
  );
```

The client name is what students see on the device approval page; changing it is a manual `UPDATE` in
production. When the server starts, it logs a warning for every way the stored client differs from this
shape (`domain::oauth::native_client_check`), so check the headless-lms logs after changing the row.

## Refusing old clients

`EXERCISE_SERVICES_CLIENT_MINIMUM_VERSION` (headless-lms environment) sets the oldest `tmc-langs-cli`
version the client API serves, as sent in the `X-Client-Version` header. Older clients, and clients
that send no version, get `426 Upgrade Required` and the extension asks the student to update. Leave it
unset to serve every version. It is read at startup, so a change takes effect when the headless-lms
pods restart.
