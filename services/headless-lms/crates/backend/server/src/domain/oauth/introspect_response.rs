use serde::{Deserialize, Serialize};

/// Response from the OAuth 2.0 token introspection endpoint (RFC 7662).
///
/// This response indicates whether a token is active and includes metadata
/// about the token if it is active.
///
/// **This is a cross-repo wire contract.** tmc-server's
/// `app/services/courses_mooc_fi_token_introspector.rb` reads `active`, `sub`, `scope`,
/// `exp`, `iss`, `token_type`, `upstream_id` and `client_bearer_allowed` by name from this
/// JSON. The handler declares its body as `serde_json::Value`, so the OpenAPI drift gate
/// cannot see a rename here — `tests::golden_serialized_shape` is the only thing that can.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Default)]
pub struct IntrospectResponse {
    /// Whether the token is active (required).
    pub active: bool,

    /// Space-separated list of scopes (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,

    /// Client identifier (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,

    /// Username/subject (optional, only if active and token has user).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,

    /// Expiration timestamp as Unix time (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exp: Option<i64>,

    /// Issued at timestamp as Unix time (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iat: Option<i64>,

    /// Subject identifier (optional, only if active and token has user).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub: Option<String>,

    /// Audience (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aud: Option<Vec<String>>,

    /// Issuer (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iss: Option<String>,

    /// JWT ID (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jti: Option<String>,

    /// Token type: "Bearer" or "DPoP" (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_type: Option<String>,

    /// The token owner's legacy TMC `upstream_id`, when the token has a user and
    /// that user has one. A non-standard claim consumed by tmc-server: it lets
    /// tmc-server resolve a courses.mooc.fi token to a local user by upstream id
    /// while the `courses_mooc_fi_user_id` backfill is still incomplete.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream_id: Option<i32>,

    /// Whether the client the token was **issued to** (the one named by `client_id` in this
    /// same response, not the introspecting caller) may present it as a plain Bearer
    /// credential. Non-standard; it lets a resource server introspecting our tokens apply the
    /// same `bearer_allowed = false` rejection
    /// `domain::exercise_services::token::UserFromOAuthToken` applies here.
    ///
    /// Privileged, gated like `upstream_id`: disclosed only to a confidential caller, and
    /// *omitted* rather than serialized as `false` when withheld, so a `false` is always an
    /// authoritative denial.
    ///
    /// **Consumers must fail closed:** an absent member means "not disclosed" or "server
    /// predates it", never "allowed", so treat it as not permitted and reject the token.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_bearer_allowed: Option<bool>,
}

impl IntrospectResponse {
    /// The RFC 7662 §2.2 minimal negative response: `{"active": false}` and nothing else.
    /// Disclosing any metadata alongside `active: false` would leak token existence.
    pub fn inactive() -> Self {
        Self::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// Golden shape test for the cross-repo wire contract (see the type's doc comment).
    ///
    /// Asserts on the serialized JSON rather than the struct, so a `#[serde(rename)]`, a
    /// retyped member, or a dropped `skip_serializing_if` fails here. Equality is exact:
    /// *adding* a member trips this too, which is deliberate — the tmc-server fixture at
    /// `spec/fixtures/courses_mooc_fi_introspection/` is a hand-mirrored copy of the active
    /// response below and has to be updated in the same change.
    #[test]
    fn golden_serialized_shape() {
        let active = IntrospectResponse {
            active: true,
            scope: Some("exercise-services".to_string()),
            client_id: Some("tmc-server-introspection-dev".to_string()),
            username: Some("11111111-2222-3333-4444-555555555555".to_string()),
            exp: Some(1767225600),
            iat: Some(1767222000),
            sub: Some("11111111-2222-3333-4444-555555555555".to_string()),
            // Every access token this server mints is created with `audience: None`, so `aud`
            // is always absent in practice; tmc-server therefore cannot and does not verify it.
            aud: None,
            iss: Some("https://courses.mooc.fi/api/v0/main-frontend/oauth".to_string()),
            jti: Some("123e4567-e89b-12d3-a456-426614174000".to_string()),
            token_type: Some("Bearer".to_string()),
            upstream_id: Some(42),
            client_bearer_allowed: Some(true),
        };

        assert_eq!(
            serde_json::to_value(&active).unwrap(),
            json!({
                "active": true,
                "scope": "exercise-services",
                "client_id": "tmc-server-introspection-dev",
                "username": "11111111-2222-3333-4444-555555555555",
                "exp": 1767225600,
                "iat": 1767222000,
                "sub": "11111111-2222-3333-4444-555555555555",
                "iss": "https://courses.mooc.fi/api/v0/main-frontend/oauth",
                "jti": "123e4567-e89b-12d3-a456-426614174000",
                "token_type": "Bearer",
                "upstream_id": 42,
                "client_bearer_allowed": true
            })
        );

        assert_eq!(
            serde_json::to_value(IntrospectResponse::inactive()).unwrap(),
            json!({ "active": false })
        );

        // `aud` is a JSON array of strings when populated, not a bare string.
        assert_eq!(
            serde_json::to_value(IntrospectResponse {
                aud: Some(vec!["tmc-server".to_string()]),
                ..IntrospectResponse::inactive()
            })
            .unwrap()["aud"],
            json!(["tmc-server"])
        );
    }

    /// The privileged members are omitted, never serialized as `false`/`null`, when withheld
    /// from a non-confidential caller — tmc-server fails closed on absence, so an emitted
    /// `false` must always be an authoritative denial.
    #[test]
    fn withheld_privileged_members_are_omitted() {
        let withheld = serde_json::to_value(IntrospectResponse {
            active: true,
            upstream_id: None,
            client_bearer_allowed: None,
            ..IntrospectResponse::inactive()
        })
        .unwrap();

        assert!(withheld.get("client_bearer_allowed").is_none());
        assert!(withheld.get("upstream_id").is_none());

        let denied = serde_json::to_value(IntrospectResponse {
            active: true,
            client_bearer_allowed: Some(false),
            ..IntrospectResponse::inactive()
        })
        .unwrap();
        assert_eq!(denied["client_bearer_allowed"], json!(false));
    }
}
