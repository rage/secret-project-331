use actix_web::HttpRequest;
use async_trait::async_trait;
use dpop_verifier::{
    DpopError, VerifyOptions,
    actix_helpers::{dpop_header_str, expected_htu_from_actix},
    replay::{ReplayContext, ReplayStore},
    verify_proof,
};
use headless_lms_models::oauth_dpop_proofs::OAuthDpopProof;
use headless_lms_models::oauth_shared_types::Digest as TokenDigest;
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
            /* client_id */ None,          // No client in ReplayContext; store None
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

    let opts = VerifyOptions {
        max_age_secs: 300,
        future_skew_secs: 10,
        ..Default::default()
    };
    let mut store = SqlxReplayStore { conn };
    let out = verify_proof(&mut store, hdr, &htu, method, access_token, opts).await?;

    Ok(out.jkt)
}
