//! Listing and unlinking verified student numbers, for spot-checking and support.

use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::library::credit_registration::student_number_change::unlink_verified_student_number;
use headless_lms_models::verified_student_numbers::{
    self, AdminVerifiedStudentNumber, StudentNumberVerificationMethod,
};
use utoipa::ToSchema;

use crate::prelude::*;

use super::{authorize_credit_registration_admin, required_reason};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminVerifiedStudentNumberRow {
    pub id: Uuid,
    pub user_id: Uuid,
    /// In full.
    pub user_email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub student_number: String,
    pub sisu_person_id: String,
    pub verified_at: DateTime<Utc>,
    pub verified_via: StudentNumberVerificationMethod,
    /// The registry-held address the proof rests on, in full. `None` for an admin-established link.
    pub verified_via_email: Option<String>,
    pub linked_by_user_id: Option<Uuid>,
    pub link_reason: Option<String>,
    pub verified_from_course_id: Option<Uuid>,
    pub live_registration_count: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminUnlinkStudentNumberPayload {
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminUnlinkStudentNumberResult {
    /// Registrations that went back to waiting for a number.
    pub affected_registration_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct ListVerifiedStudentNumbersQuery {
    page: Option<u32>,
    limit: Option<u32>,
    verified_via: Option<StudentNumberVerificationMethod>,
    search: Option<String>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/student-numbers` - A page of the live links, for
spot-checking and support.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/student-numbers",
    operation_id = "listVerifiedStudentNumbersForAdmin",
    tag = "credit-registration-admin",
    params(
        ("page" = Option<u32>, Query, description = "Page number, from 1"),
        ("limit" = Option<u32>, Query, description = "Rows per page"),
        ("verified_via" = Option<StudentNumberVerificationMethod>, Query, description = "How the link was established"),
        ("search" = Option<String>, Query, description = "Student number, name or email")
    ),
    responses(
        (status = 200, description = "A page of the live links", body = Page<AdminVerifiedStudentNumberRow>)
    )
)]
pub async fn list_verified_student_numbers_for_admin(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<ListVerifiedStudentNumbersQuery>,
) -> ControllerResult<web::Json<Page<AdminVerifiedStudentNumberRow>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let pagination = parse_pagination(query.page, query.limit, 50)?;
    let (rows, total_count) = verified_student_numbers::get_admin_page(
        &mut conn,
        query.verified_via,
        query.search.as_deref(),
        pagination.limit(),
        pagination.offset(),
    )
    .await?;
    let data = rows.into_iter().map(to_admin_student_number).collect();

    token.authorized_ok(web::Json(Page::new(pagination, data, total_count)))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/student-numbers/{id}/unlink` - Retires one link.

A reason is required, so the request carries a body rather than being a `DELETE`. The row is
soft-deleted: the number a student once held is part of the audit trail.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/student-numbers/{verified_student_number_id}/unlink",
    operation_id = "adminUnlinkStudentNumber",
    tag = "credit-registration-admin",
    params(("verified_student_number_id" = Uuid, Path, description = "Verified student number id")),
    request_body = AdminUnlinkStudentNumberPayload,
    responses(
        (status = 200, description = "How many registrations went back to waiting", body = AdminUnlinkStudentNumberResult),
        (status = 422, description = "No reason given"),
        (status = 404, description = "No such link")
    )
)]
pub async fn admin_unlink_student_number(
    user: AuthUser,
    pool: web::Data<PgPool>,
    verified_student_number_id: web::Path<Uuid>,
    payload: web::Json<AdminUnlinkStudentNumberPayload>,
) -> ControllerResult<web::Json<AdminUnlinkStudentNumberResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;
    let id = *verified_student_number_id;
    let link = verified_student_numbers::get_by_id(&mut conn, id).await?;

    let mut tx = conn.begin().await?;
    let affected_registration_count = unlink_verified_student_number(
        &mut tx,
        id,
        link.user_id,
        Some(user.id),
        CreditRegistrationEventKind::AdminAction,
        "An administrator unlinked this student number.",
    )
    .await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(id),
            reason: Some(reason.to_string()),
            details: Some(serde_json::json!({
                "user_id": link.user_id,
                "student_number": link.student_number,
                "verified_via": link.verified_via,
            })),
            affected_row_count: Some(
                i32::try_from(affected_registration_count).unwrap_or(i32::MAX),
            ),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::UnlinkStudentNumber,
                CreditRegistrationAdminActionTarget::VerifiedStudentNumber,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(AdminUnlinkStudentNumberResult {
        affected_registration_count,
    }))
}

fn to_admin_student_number(row: AdminVerifiedStudentNumber) -> AdminVerifiedStudentNumberRow {
    AdminVerifiedStudentNumberRow {
        id: row.id,
        user_id: row.user_id,
        user_email: row.user_email,
        first_name: row.first_name,
        last_name: row.last_name,
        student_number: row.student_number,
        sisu_person_id: row.sisu_person_id,
        verified_at: row.verified_at,
        verified_via: row.verified_via,
        verified_via_email: row.verified_via_email,
        linked_by_user_id: row.linked_by_user_id,
        link_reason: row.link_reason,
        verified_from_course_id: row.verified_from_course_id,
        live_registration_count: row.live_registration_count,
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/student-numbers",
        web::get().to(list_verified_student_numbers_for_admin),
    )
    .route(
        "/student-numbers/{verified_student_number_id}/unlink",
        web::post().to(admin_unlink_student_number),
    );
}
