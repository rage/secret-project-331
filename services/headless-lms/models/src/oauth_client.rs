use crate::prelude::*;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OAuthClient {
    pub id: Uuid,
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uris: Vec<String>,
    pub grant_types: Vec<String>,
    pub scope: Option<String>,
    pub origin: String,
}

impl OAuthClient {
    pub async fn find_by_client_id(
        conn: &mut PgConnection,
        client_id: &str,
    ) -> ModelResult<OAuthClient> {
        let mut tx = conn.begin().await?;
        let client = sqlx::query_as!(
            OAuthClient,
            r#"SELECT id, client_id, client_secret, redirect_uris, grant_types, scope, origin
               FROM oauth_clients WHERE client_id = $1"#,
            client_id
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(client)
    }

    pub async fn insert(
        conn: &mut PgConnection,
        client_id: &str,
        client_secret: &str,
        redirect_uris: Vec<String>,
        grant_types: Vec<String>,
        scope: &str,
        origin: &str,
    ) -> ModelResult<Uuid> {
        let mut tx = conn.begin().await?;
        let res = sqlx::query!(
            "
            INSERT INTO oauth_clients (
                client_id,
                client_secret,
                redirect_uris,
                grant_types,
                scope,
                origin
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            ",
            client_id,
            client_secret,
            &redirect_uris,
            &grant_types,
            scope,
            origin
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(res.id)
    }
}
