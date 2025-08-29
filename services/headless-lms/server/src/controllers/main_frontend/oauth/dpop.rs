use crate::prelude::*;
use actix_web::HttpRequest;
use async_trait::async_trait;
use dpop_verifier::{
    DpopError, VerifyOptions,
    actix_helpers::canonicalize_request_url,
    replay::{ReplayContext, ReplayStore},
    verify_proof,
};
use headless_lms_models::oauth_dpop_proofs::OAuthDpopProof;
use headless_lms_models::oauth_shared_types::Digest as TokenDigest;
use sqlx::PgConnection;

// ---- Replay store backed by SQLx ----

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
            /* client_id */ None,          // No client in ReplayContext; store None
            ctx.jkt,       // jkt: Option<&str>
            ctx.htm,       // htm: Option<&str>
            ctx.htu,       // htu: Option<&str>
            Some(ctx.iat), // iat: Option<i64>
        )
        .await
        .map_err(|e| DpopError::Store(e.into()))?; // crate expects Box<dyn Error + Send + Sync>

        Ok(first_time)
    }
}

// ---------- Error mapping to your OAuth errors ----------
pub fn oauth_invalid_dpop(e: DpopError) -> domain::error::ControllerError {
    use domain::error::{ControllerError, ControllerErrorType, OAuthErrorData};
    ControllerError::new(
        ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
            error: "invalid_dpop_proof".into(),
            error_description: e.to_string(),
            redirect_uri: None,
            state: None,
        })),
        "invalid DPoP proof",
        None::<anyhow::Error>,
    )
}

// ---------- Actix-friendly verifier usable in /token, /userinfo, etc. ----------
pub async fn verify_dpop_from_actix(
    conn: &mut PgConnection,
    req: &HttpRequest,
    method: &str,               // "POST", "GET", ...
    access_token: Option<&str>, // Some(at) at resource endpoints; None at /token
) -> Result<String, DpopError> {
    // Header (let missing header be your OAuth error elsewhere if you prefer)
    let hdr = req
        .headers()
        .get("DPoP")
        .and_then(|v| v.to_str().ok())
        .ok_or(DpopError::MalformedJws)?; // reuse MalformedJws for "no/garbled header"

    // Canonical HTU (scheme://host[:port?]/path), no query/fragment
    let htu = canonicalize_request_url(req);

    // Verify signature + claims (IMPORTANT: params order = store, jws, expected_htu, expected_htm, ...)
    let opts = VerifyOptions {
        max_age_secs: 300,
        future_skew_secs: 120,
        ..Default::default()
    };
    let mut store = SqlxReplayStore { conn };
    let out = verify_proof(&mut store, hdr, &htu, method, access_token, opts).await?;

    // We already stored the replay marker in the call above; return JKT to caller
    Ok(out.jkt)
}
