use crate::{oauth_shared_types::Digest, prelude::*};
use chrono::{DateTime, Utc};
use sqlx::{FromRow, Postgres, postgres::PgArguments, query::Query};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthRefreshTokens {
    pub digest: Digest,
    pub pepper_id: i16,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub scope: String,
    pub audience: Option<String>,
    pub jti: Uuid,
    pub dpop_jkt: String,
    pub metadata: serde_json::Value,
    pub revoked: bool,
    pub rotated_from: Option<Digest>,
}

/* ------------ internal helper for INSERT ------------ */

#[derive(Debug, Clone)]
pub struct NewRefreshTokenParams<'a> {
    pub digest: &'a Digest,
    pub pepper_id: i16,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub scope: &'a str,
    pub audience: Option<&'a str>,
    pub expires_at: DateTime<Utc>,
    pub rotated_from: Option<&'a Digest>,
    pub metadata: serde_json::Map<String, serde_json::Value>,
    pub dpop_jkt: &'a str,
}

fn bind_refresh<'q>(
    mut q: Query<'q, Postgres, PgArguments>,
    p: NewRefreshTokenParams<'q>,
) -> Query<'q, Postgres, PgArguments> {
    q = q
        .bind(p.digest.as_bytes())
        .bind(p.user_id)
        .bind(p.client_id)
        .bind(p.scope)
        .bind(p.audience)
        .bind(p.pepper_id)
        .bind(serde_json::Value::Object(p.metadata))
        .bind(p.dpop_jkt)
        .bind(p.expires_at)
        .bind(if let Some(rf) = p.rotated_from {
            Some(rf.as_bytes())
        } else {
            None
        });
    q
}

/* ------------ impl ------------ */

impl OAuthRefreshTokens {
    pub async fn insert(
        conn: &mut PgConnection,
        params: NewRefreshTokenParams<'_>,
    ) -> ModelResult<()> {
        let sql = r#"
            INSERT INTO oauth_refresh_tokens
              (digest, user_id, client_id, scope, audience, pepper_id, metadata, dpop_jkt, expires_at, rotated_from)
            VALUES ($1,     $2,      $3,        $4,   $5,       $6,        $7,       $8,       $9,        $10)
        "#;

        let mut tx = conn.begin().await?;
        bind_refresh(sqlx::query(sql), params)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn find_valid(
        conn: &mut PgConnection,
        digest: Digest,
    ) -> ModelResult<OAuthRefreshTokens> {
        let mut tx = conn.begin().await?;
        let token = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"
            SELECT
              digest as "digest: _",
              user_id,
              client_id,
              scope,
              expires_at,
              jti,
              dpop_jkt,
              metadata,
              pepper_id,
              audience,
              revoked,
              rotated_from as "rotated_from: _"
            FROM oauth_refresh_tokens
            WHERE digest = $1
              AND expires_at > now()
              AND revoked = false
            "#,
            digest.as_bytes()
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(token)
    }

    pub async fn revoke_by_digest(conn: &mut PgConnection, digest: Digest) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"
            UPDATE oauth_refresh_tokens
            SET revoked = true
            WHERE digest = $1
            "#,
            digest.as_bytes()
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn revoke_all_by_user_client(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"
            UPDATE oauth_refresh_tokens
            SET revoked = true
            WHERE user_id = $1 AND client_id = $2
            "#,
            user_id,
            client_id
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn consume(
        conn: &mut PgConnection,
        digest: Digest,
    ) -> ModelResult<OAuthRefreshTokens> {
        let mut tx = conn.begin().await?;
        let refresh_token = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"
            SELECT
              digest as "digest: _",
              user_id,
              client_id,
              scope,
              expires_at,
              jti,
              dpop_jkt,
              metadata,
              pepper_id,
              audience,
              revoked,
              rotated_from as "rotated_from: _"
            FROM oauth_refresh_tokens
            WHERE digest = $1
              AND revoked = false
              AND expires_at > now()
            "#,
            digest.as_bytes()
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            r#"UPDATE oauth_refresh_tokens SET revoked = true WHERE digest = $1"#,
            digest.as_bytes()
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(refresh_token)
    }
}
