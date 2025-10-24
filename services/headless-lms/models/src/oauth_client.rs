use crate::{oauth_shared_types::Digest, prelude::*};
use sqlx::FromRow;
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
        let res = sqlx::query!(
            r#"
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
        "#,
            params.client_id,
            params.client_secret.as_bytes(),
            params.pepper_id,
            params.redirect_uris,
            params.grant_types,
            params.scope,
            params.origin,
            params.bearer_allowed
        )
        .fetch_one(conn)
        .await?;
        Ok(res.id)
    }
}
