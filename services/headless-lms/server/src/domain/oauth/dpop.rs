use actix_web::HttpRequest;
use async_trait::async_trait;
use dpop_verifier::{
    DpopError, DpopVerifier,
    actix_helpers::{dpop_header_str, expected_htu_from_actix},
    replay::{ReplayContext, ReplayStore},
};
use headless_lms_models::library::oauth::Digest as TokenDigest;
use headless_lms_models::oauth_dpop_proofs::OAuthDpopProof;
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

pub async fn verify_dpop_from_actix(
    conn: &mut PgConnection,
    req: &HttpRequest,
    method: &str,               // "POST", "GET", ...
    access_token: Option<&str>, // Some(at) at resource endpoints; None at /token
) -> Result<String, DpopError> {
    let hdr = dpop_header_str(req)?;

    let htu = expected_htu_from_actix(req, true);

    let mut store = SqlxReplayStore { conn };
    let verifier = DpopVerifier::new()
        .with_max_age_seconds(300)
        .with_future_skew_seconds(5)
        .with_nonce_mode(dpop_verifier::NonceMode::Hmac(
            dpop_verifier::HmacConfig::new(b"change-this-lol...", 300, true, true, true),
        ));
    let verified = verifier
        .verify(&mut store, hdr, &htu, method, access_token)
        .await?;

    Ok(verified.jkt)
}
