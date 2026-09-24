//! A teacher asking the pipeline to look for a student's enrolment again.

use headless_lms_models::credit_registration_admin_actions::{
    COURSE_TEACHER_ROLE, CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registrations::CreditRegistrationState;

use crate::controllers::main_frontend::credit_registrations::{
    RequestCreditRegistrationEnrolmentRecheckResult, looked_for_enrolment_recently,
    start_enrolment_recheck,
};
use crate::prelude::*;

/**
POST
`/api/v0/main-frontend/course-credit-registrations/registrations/{credit_registration_id}/recheck-enrolment`
- Asks the pipeline to look for an enrolment again, for a row parked because the study registry had
none.

Shares the student's button's allowance, so between them they cannot ask the registry more than once
an hour. Authorized on the row's own course, like the retry.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/registrations/{credit_registration_id}/recheck-enrolment",
    operation_id = "recheckCreditRegistrationEnrolment",
    tag = "course-credit-registrations",
    params(("credit_registration_id" = Uuid, Path, description = "Credit registration id")),
    responses(
        (status = 200, description = "Whether a recheck was started", body = RequestCreditRegistrationEnrolmentRecheckResult),
        (status = 400, description = "The registration is not waiting for an enrolment"),
        (status = 404, description = "No such registration")
    )
)]
pub async fn recheck_credit_registration_enrolment(
    user: AuthUser,
    pool: web::Data<PgPool>,
    credit_registration_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<RequestCreditRegistrationEnrolmentRecheckResult>> {
    let mut conn = pool.acquire().await?;
    let id = *credit_registration_id;
    let row = models::credit_registrations::get_teacher_facing_by_id(&mut conn, id)
        .await?
        .ok_or_else(|| controller_err!(NotFound, "Not found.".to_string()))?;
    let token =
        super::authorize_credit_registration_teacher(&mut conn, user.id, row.course_id).await?;

    if row.state != CreditRegistrationState::NoUsableEnrolment {
        return Err(controller_err!(
            BadRequest,
            "This registration is not waiting for an enrolment.".to_string()
        ));
    }
    if looked_for_enrolment_recently(row.enrolment_checked_at) {
        return token.authorized_ok(web::Json(RequestCreditRegistrationEnrolmentRecheckResult {
            recheck_started: false,
        }));
    }

    let mut tx = conn.begin().await?;
    start_enrolment_recheck(
        &mut tx,
        user.id,
        id,
        CreditRegistrationEventKind::AdminAction,
        "A teacher of the course asked us to check for an enrolment again.",
    )
    .await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(id),
            actor_course_id: Some(row.course_id),
            before_state: Some(row.state),
            affected_row_count: Some(1),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::ForceRecheck,
                CreditRegistrationAdminActionTarget::CreditRegistration,
                user.id,
                COURSE_TEACHER_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(RequestCreditRegistrationEnrolmentRecheckResult {
        recheck_started: true,
    }))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/registrations/{credit_registration_id}/recheck-enrolment",
        web::post().to(recheck_credit_registration_enrolment),
    );
}
