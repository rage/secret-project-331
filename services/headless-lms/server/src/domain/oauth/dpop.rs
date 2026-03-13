use actix_web::HttpRequest;
use async_trait::async_trait;
use dpop_verifier::{
    DpopError, DpopVerifier,
    actix_helpers::{dpop_header_str, expected_htu_from_actix},
    replay::{ReplayContext, ReplayStore},
};
use headless_lms_models::library::oauth::Digest as TokenDigest;
use headless_lms_models::oauth_dpop_proofs::OAuthDpopProof;
use secrecy::{ExposeSecret, SecretBox};
use sqlx::PgConnection;

pub struct SqlxReplayStore<'c> {
    pub conn: &'c mut PgConnection,
}

#[async_trait]
impl<'c> ReplayStore for SqlxReplayStore<'c> {
    async fn insert_once(
        &mut self,
        jti_hash: [u8; 32],
        ctx: ReplayContext<'_>,
    ) -> Result<bool, DpopError> {
        let digest = TokenDigest::from(jti_hash);
        let first_time = OAuthDpopProof::insert_once(
            self.conn,
            digest,
            ctx.client_id,
            ctx.jkt,       // jkt: Option<&str>
            ctx.htm,       // htm: Option<&str>
            ctx.htu,       // htu: Option<&str>
            Some(ctx.iat), // iat: Option<i64>
        )
        .await
        .map_err(|e| DpopError::Store(e.into()))?;

        Ok(first_time)
    }
}

/// Buffered replay context for deferred persistence (token endpoint only).
struct BufferedReplayEntry {
    jti_hash: [u8; 32],
    client_id: Option<String>,
    jkt: Option<String>,
    htm: Option<String>,
    htu: Option<String>,
    iat: Option<i64>,
}

/// Replay store that defers persisting the proof until flush is called.
/// Used at the token endpoint so that when we return UseDpopNonce we do not
/// record the JTI, allowing the client to retry with the nonce without hitting replay.
pub struct DeferredReplayStore {
    buffer: Option<BufferedReplayEntry>,
}

impl DeferredReplayStore {
    pub fn new() -> Self {
        Self { buffer: None }
    }

    /// Persist any buffered proof into the database. Call only after verification succeeded.
    pub async fn flush(&mut self, conn: &mut PgConnection) -> Result<(), DpopError> {
        if let Some(entry) = self.buffer.take() {
            let digest = TokenDigest::from(entry.jti_hash);
            OAuthDpopProof::insert_once(
                conn,
                digest,
                entry.client_id.as_deref(),
                entry.jkt.as_deref(),
                entry.htm.as_deref(),
                entry.htu.as_deref(),
                entry.iat,
            )
            .await
            .map_err(|e| DpopError::Store(e.into()))?;
        }
        Ok(())
    }
}

#[async_trait]
impl ReplayStore for DeferredReplayStore {
    async fn insert_once(
        &mut self,
        jti_hash: [u8; 32],
        ctx: ReplayContext<'_>,
    ) -> Result<bool, DpopError> {
        self.buffer = Some(BufferedReplayEntry {
            jti_hash,
            client_id: ctx.client_id.map(String::from),
            jkt: ctx.jkt.map(String::from),
            htm: ctx.htm.map(String::from),
            htu: ctx.htu.map(String::from),
            iat: Some(ctx.iat),
        });
        // Report first-time so the verifier continues; we persist only on flush (after Ok).
        Ok(true)
    }
}

pub async fn verify_dpop_from_actix(
    conn: &mut PgConnection,
    req: &HttpRequest,
    method: &str, // "POST", "GET", ...
    dpop_nonce_key: &SecretBox<String>,
    access_token: Option<&str>, // Some(at) at resource endpoints; None at /token
) -> Result<String, DpopError> {
    let hdr = dpop_header_str(req)?;

    let htu = expected_htu_from_actix(req, true);

    let mut store = SqlxReplayStore { conn };
    let verifier = DpopVerifier::new()
        .with_max_age_seconds(300)
        .with_future_skew_seconds(5)
        .with_nonce_mode(dpop_verifier::NonceMode::Hmac(
            dpop_verifier::HmacConfig::new(
                dpop_nonce_key.expose_secret().as_bytes(),
                300,
                true,
                true,
                true,
            ),
        ));
    let verified = verifier
        .verify(&mut store, hdr, &htu, method, access_token)
        .await?;

    Ok(verified.jkt)
}

/// DPoP verification for the token endpoint only. Uses a deferred replay store so that
/// when the server returns UseDpopNonce the proof is not persisted; the client can retry
/// with the nonce without the auth code being effectively revoked (replay rejection).
pub async fn verify_dpop_from_actix_for_token(
    conn: &mut PgConnection,
    req: &HttpRequest,
    dpop_nonce_key: &SecretBox<String>,
) -> Result<String, DpopError> {
    let hdr = dpop_header_str(req)?;
    let htu = expected_htu_from_actix(req, true);

    let mut store = DeferredReplayStore::new();
    let verifier = DpopVerifier::new()
        .with_max_age_seconds(300)
        .with_future_skew_seconds(5)
        .with_nonce_mode(dpop_verifier::NonceMode::Hmac(
            dpop_verifier::HmacConfig::new(
                dpop_nonce_key.expose_secret().as_bytes(),
                300,
                true,
                true,
                true,
            ),
        ));
    let result = verifier
        .verify(&mut store, hdr, &htu, "POST", None::<&str>)
        .await;

    match result {
        Ok(verified) => {
            store.flush(conn).await?;
            Ok(verified.jkt)
        }
        Err(e) => Err(e),
    }
}
