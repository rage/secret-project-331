//! `Authorization: Bearer` access tokens presented to this server's own resource APIs.

use secrecy::SecretString;

use crate::{
    library::oauth::token_digest_sha256, oauth_access_token::TokenType, prelude::*, users::User,
};

/// A still-valid Bearer token of an active user, issued to a client that may use Bearer tokens.
#[derive(Debug, Clone)]
pub struct BearerToken {
    pub user: User,
    /// The token's scopes that its grant still allows: a grant narrowed by a later consent caps
    /// the tokens issued before it.
    pub scopes: Vec<String>,
    /// The RFC 8707 resources the token is bound to; see [`super::is_bound_to`].
    pub audience: Option<Vec<String>>,
    pub expires_at: DateTime<Utc>,
    /// `oauth_clients.id`.
    pub client_id: Uuid,
    pub client_name: String,
    pub is_metadata_document_client: bool,
    pub grant: BearerGrant,
}

/// The user's grant to the client a [`BearerToken`] was issued to.
#[derive(Debug, Clone)]
pub struct BearerGrant {
    /// `oauth_user_client_scopes.id`.
    pub id: Uuid,
    /// `oauth_user_client_scopes.last_used_at`.
    pub last_used_at: Option<DateTime<Utc>>,
}

/// Who a request authenticated with an access token acts for. Token-authenticating middlewares put
/// it in the request extensions, where per-user and per-grant rate limits read it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TokenSubject {
    pub user_id: Uuid,
    /// `oauth_user_client_scopes.id`.
    pub grant_id: Uuid,
}

/// Why a Bearer token wasn't accepted.
#[derive(Debug)]
pub enum BearerTokenError {
    /// Answer 401. The message is safe to show to the client.
    Invalid(&'static str),
    /// Not the token's fault, so never a 401: clients drop their credentials on a 401.
    Database(ModelError),
}

/// The scheme and credentials of an `Authorization` header value. Schemes are case-insensitive
/// (RFC 9110 §11.1), so compare them with `eq_ignore_ascii_case`.
pub fn split_authorization(header_value: &str) -> Option<(&str, &str)> {
    let (scheme, credentials) = header_value.split_once(' ')?;
    let credentials = credentials.trim_start();
    (!credentials.is_empty()).then_some((scheme, credentials))
}

/// The token of an `Authorization: Bearer <token>` header value, for [`resolve_bearer_token`].
pub fn bearer_token(header_value: &str) -> Option<&str> {
    split_authorization(header_value)
        .and_then(|(scheme, token)| scheme.eq_ignore_ascii_case("bearer").then_some(token))
}

/// Resolves a token presented as `Authorization: Bearer`. A sender-constrained (DPoP) token is
/// rejected, since these APIs verify no proof of possession. Callers check scopes and audience.
pub async fn resolve_bearer_token(
    conn: &mut PgConnection,
    token: &str,
    token_hmac_key: &SecretString,
) -> Result<BearerToken, BearerTokenError> {
    let digest = token_digest_sha256(token, token_hmac_key);
    let row = sqlx::query!(
        r#"
SELECT t.token_type,
  t.scopes,
  t.audience,
  t.expires_at,
  t.user_id,
  c.id AS client_id,
  c.client_name,
  c.bearer_allowed,
  c.metadata_document_fetched_at IS NOT NULL AS "is_metadata_document_client!",
  u.id AS "active_user_id?",
  u.created_at AS "user_created_at?",
  u.updated_at AS "user_updated_at?",
  u.upstream_id AS "user_upstream_id?",
  u.email_domain AS "user_email_domain?",
  g.id AS "grant_id?",
  g.scopes AS "grant_scopes?",
  g.last_used_at AS "grant_last_used_at?"
FROM oauth_access_tokens t
  JOIN oauth_clients c ON c.id = t.client_id
  AND c.deleted_at IS NULL
  LEFT JOIN users u ON u.id = t.user_id
  AND u.deleted_at IS NULL
  LEFT JOIN oauth_user_client_scopes g ON g.user_id = t.user_id
  AND g.client_id = t.client_id
WHERE t.digest = $1
  AND t.expires_at > now()
        "#,
        digest.as_bytes()
    )
    .fetch_optional(conn)
    .await
    .map_err(|err| BearerTokenError::Database(err.into()))?;
    let Some(row) = row else {
        return Err(BearerTokenError::Invalid(
            "The access token is missing, invalid, or expired.",
        ));
    };
    if row.token_type != TokenType::Bearer {
        return Err(BearerTokenError::Invalid(
            "This API accepts only Bearer tokens; the presented token is sender-constrained.",
        ));
    }
    if !row.bearer_allowed {
        return Err(BearerTokenError::Invalid(
            "The access token's client is not permitted to use Bearer tokens.",
        ));
    }
    if row.user_id.is_none() {
        return Err(BearerTokenError::Invalid(
            "The access token is not associated with a user.",
        ));
    }
    let (Some(id), Some(created_at), Some(updated_at)) =
        (row.active_user_id, row.user_created_at, row.user_updated_at)
    else {
        return Err(BearerTokenError::Invalid(
            "The access token's user could not be found.",
        ));
    };
    let (Some(grant_id), Some(grant_scopes)) = (row.grant_id, row.grant_scopes) else {
        return Err(BearerTokenError::Invalid(
            "The access token's grant has been revoked.",
        ));
    };
    let scopes = row
        .scopes
        .into_iter()
        .filter(|scope| grant_scopes.contains(scope))
        .collect();
    Ok(BearerToken {
        user: User {
            id,
            created_at,
            updated_at,
            deleted_at: None,
            upstream_id: row.user_upstream_id,
            email_domain: row.user_email_domain,
        },
        scopes,
        audience: row.audience,
        expires_at: row.expires_at,
        client_id: row.client_id,
        client_name: row.client_name,
        is_metadata_document_client: row.is_metadata_document_client,
        grant: BearerGrant {
            id: grant_id,
            last_used_at: row.grant_last_used_at,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::bearer_token;

    #[test]
    fn the_bearer_scheme_is_case_insensitive() {
        assert_eq!(bearer_token("Bearer abc"), Some("abc"));
        assert_eq!(bearer_token("bearer abc"), Some("abc"));
        assert_eq!(bearer_token("BEARER  abc"), Some("abc"));
        assert_eq!(bearer_token("Basic abc"), None);
        assert_eq!(bearer_token("Bearer"), None);
        assert_eq!(bearer_token("Bearer "), None);
    }
}
