use crate::{oauth_shared_types::Digest, prelude::*};
use sqlx::{FromRow, Postgres, Row, postgres::PgArguments, query::Query};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthClient {
    pub id: Uuid,
    pub client_id: String,
    pub client_secret: Digest,
    pub pepper_id: i16,
    pub redirect_uris: Vec<String>,
    pub grant_types: Vec<String>,
    pub scope: Option<String>,
    pub origin: String,
    pub bearer_allowed: bool,
}

/* ------------ internal helper for INSERT ------------ */

#[derive(Debug, Clone)]
pub struct NewClientParams<'a> {
    pub client_id: &'a str,
    pub client_secret: &'a Digest,
    pub pepper_id: i16,
    pub redirect_uris: &'a [String],
    pub grant_types: &'a [String],
    pub scope: Option<&'a str>,
    pub origin: &'a str,
    pub bearer_allowed: bool,
}

fn bind_client<'q>(
    mut q: Query<'q, Postgres, PgArguments>,
    p: &NewClientParams<'q>,
) -> Query<'q, Postgres, PgArguments> {
    q = q
        .bind(p.client_id)
        .bind(p.client_secret.as_bytes())
        .bind(p.pepper_id)
        .bind(p.redirect_uris)
        .bind(p.grant_types)
        .bind(p.scope)
        .bind(p.origin)
        .bind(p.bearer_allowed);
    q
}

/* ------------ impl ------------ */

impl OAuthClient {
    pub async fn find_by_client_id(
        conn: &mut PgConnection,
        client_id: &str,
    ) -> ModelResult<OAuthClient> {
        let mut tx = conn.begin().await?;
        let client = sqlx::query_as!(
            OAuthClient,
            r#"
            SELECT
              id,
              client_id,
              client_secret as "client_secret: _",
              pepper_id,
              redirect_uris,
              grant_types,
              scope,
              origin,
              bearer_allowed
            FROM oauth_clients
            WHERE client_id = $1
            "#,
            client_id
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(client)
    }

    pub async fn insert(conn: &mut PgConnection, params: NewClientParams<'_>) -> ModelResult<Uuid> {
        let sql = r#"
            INSERT INTO oauth_clients (
                client_id,
                client_secret,
                pepper_id,
                redirect_uris,
                grant_types,
                scope,
                origin,
                bearer_allowed
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING id
        "#;

        let mut tx = conn.begin().await?;
        let row = bind_client(sqlx::query(sql), &params)
            .fetch_one(&mut *tx)
            .await?;
        tx.commit().await?;

        // `RETURNING id` is the first (and only) column in the row
        // Use `try_get` if you prefer: `row.try_get::<Uuid, _>(0)?`
        let id: Uuid = row.try_get(0)?;
        Ok(id)
    }
}
