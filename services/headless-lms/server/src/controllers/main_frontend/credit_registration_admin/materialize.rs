//! Manually running the two database-only steps that turn eligible completions into ledger rows.

use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registrations;
use headless_lms_models::library::credit_registration::materialize::{
    MATERIALIZE_LIMIT, ensure_registration_rows_for_eligible_completions,
};
use headless_lms_models::library::credit_registration::preconditions::{
    PRECONDITIONS_LIMIT, recompute_preconditions,
};
use utoipa::ToSchema;

use crate::domain::credit_registration_phases::CreditRegistrationPhase;
use crate::prelude::*;

use super::authorize_credit_registration_admin;

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminMaterializePayload {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminMaterializeResult {
    pub created_registration_count: i64,
    pub moved_registration_count: i64,
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/materialize` - Creates ledger rows for eligible
completions and recomputes preconditions, now.

Runs the two database-only steps directly rather than through the phase dispatcher, because the
phase-state row describes the worker loops: an admin pressing a button must not make a dead worker look
alive.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/materialize",
    operation_id = "adminMaterializeCreditRegistrations",
    tag = "credit-registration-admin",
    request_body = AdminMaterializePayload,
    responses(
        (status = 200, description = "How many rows were created and moved", body = AdminMaterializeResult)
    )
)]
pub async fn admin_materialize_credit_registrations(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminMaterializePayload>,
) -> ControllerResult<web::Json<AdminMaterializeResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let mut tx = conn.begin().await?;
    let scope = credit_registrations::RegistrationScope::default();
    let created_registration_count =
        ensure_registration_rows_for_eligible_completions(&mut tx, &scope, MATERIALIZE_LIMIT)
            .await?;
    let moved_registration_count =
        recompute_preconditions(&mut tx, &scope, PRECONDITIONS_LIMIT).await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_phase: Some(CreditRegistrationPhase::Materialize.as_str().to_string()),
            reason: payload.reason.clone(),
            details: Some(serde_json::json!({
                "created_registration_count": created_registration_count,
                "moved_registration_count": moved_registration_count,
            })),
            affected_row_count: Some(
                i32::try_from(created_registration_count + moved_registration_count)
                    .unwrap_or(i32::MAX),
            ),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::RequeueBatch,
                CreditRegistrationAdminActionTarget::Phase,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(AdminMaterializeResult {
        created_registration_count,
        moved_registration_count,
    }))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/materialize",
        web::post().to(admin_materialize_credit_registrations),
    );
}
