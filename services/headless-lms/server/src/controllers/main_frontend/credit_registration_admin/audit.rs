//! The Audit tab: every hand action on the pipeline, whoever took it.
//!
//! Two actor kinds share this log. Teachers may retry and resend on their own course, so filtering
//! by `actor_role` is what makes "which teachers are retrying, and on what" answerable at all — an
//! admin acting while looking at a course is otherwise indistinguishable from the course's teacher.

use headless_lms_models::credit_registration_admin_actions::{
    self, CreditRegistrationAdminAction, CreditRegistrationAdminActionFilters,
    CreditRegistrationAdminActionListRow, CreditRegistrationAdminActionTarget,
};
use headless_lms_models::credit_registrations::CreditRegistrationState;
use utoipa::ToSchema;

use crate::prelude::*;

use super::authorize_credit_registration_admin;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAdminActionRow {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub action: CreditRegistrationAdminAction,
    pub target_kind: CreditRegistrationAdminActionTarget,
    /// `None` for a phase target, which is named by `target_phase`, and for a bulk action over a
    /// selection, whose ids are in `details`.
    pub target_id: Option<Uuid>,
    pub target_phase: Option<String>,
    pub actor_user_id: Uuid,
    pub actor_first_name: Option<String>,
    pub actor_last_name: Option<String>,
    pub actor_email: Option<String>,
    /// `global_admin` or `course_teacher`.
    pub actor_role: String,
    /// The course whose edit permission authorised a teacher action.
    pub actor_course_id: Option<Uuid>,
    pub course_name: Option<String>,
    pub reason: Option<String>,
    pub before_state: Option<CreditRegistrationState>,
    pub after_state: Option<CreditRegistrationState>,
    pub details: Option<serde_json::Value>,
    pub affected_row_count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAdminActionsPage {
    pub data: Vec<CreditRegistrationAdminActionRow>,
    pub total_count: i64,
    pub total_pages: u32,
}

/// `serde_urlencoded` reads a single occurrence of a key as a scalar, not a one-element sequence,
/// so a `Vec` field otherwise refuses a query string that repeats the parameter zero or one times.
fn one_or_many<'de, D, T>(deserializer: D) -> Result<Option<Vec<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum OneOrMany<T> {
        One(T),
        Many(Vec<T>),
    }
    Ok(
        Option::<OneOrMany<T>>::deserialize(deserializer)?.map(|repr| match repr {
            OneOrMany::One(value) => vec![value],
            OneOrMany::Many(values) => values,
        }),
    )
}

#[derive(Debug, Deserialize)]
pub struct ListAdminActionsQuery {
    page: Option<u32>,
    limit: Option<u32>,
    #[serde(default, deserialize_with = "one_or_many")]
    action: Option<Vec<CreditRegistrationAdminAction>>,
    actor_user_id: Option<Uuid>,
    actor_role: Option<String>,
    target_kind: Option<CreditRegistrationAdminActionTarget>,
    target_id: Option<Uuid>,
    target_phase: Option<String>,
    course_id: Option<Uuid>,
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/audit` - A page of the global action log,
newest first.

Covers admin and course-teacher actors alike, and every target kind: a registration, a course
module, a course, a phase, a student-number link or its token.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/audit",
    operation_id = "listCreditRegistrationAdminActions",
    tag = "credit-registration-admin",
    params(
        ("page" = Option<u32>, Query, description = "Page number, from 1"),
        ("limit" = Option<u32>, Query, description = "Rows per page"),
        ("action" = Option<Vec<CreditRegistrationAdminAction>>, Query, description = "Action kinds; repeat the parameter for several"),
        ("actor_user_id" = Option<Uuid>, Query, description = "Who acted"),
        ("actor_role" = Option<String>, Query, description = "global_admin or course_teacher"),
        ("target_kind" = Option<CreditRegistrationAdminActionTarget>, Query, description = "What was acted on"),
        ("target_id" = Option<Uuid>, Query, description = "One target row"),
        ("target_phase" = Option<String>, Query, description = "One pipeline phase"),
        ("course_id" = Option<Uuid>, Query, description = "Actions on this course, and actions its teachers took"),
        ("from" = Option<DateTime<Utc>>, Query, description = "Taken at or after"),
        ("to" = Option<DateTime<Utc>>, Query, description = "Taken at or before")
    ),
    responses(
        (status = 200, description = "A page of the action log", body = CreditRegistrationAdminActionsPage)
    )
)]
pub async fn list_credit_registration_admin_actions(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<ListAdminActionsQuery>,
) -> ControllerResult<web::Json<CreditRegistrationAdminActionsPage>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let pagination = Pagination::new(query.page.unwrap_or(1), query.limit.unwrap_or(50))
        .map_err(|e| controller_err!(BadRequest, e.to_string()))?;
    let actor_role = query
        .actor_role
        .as_deref()
        .map(str::trim)
        .filter(|role| !role.is_empty());
    let target_phase = query
        .target_phase
        .as_deref()
        .map(str::trim)
        .filter(|phase| !phase.is_empty());
    let filters = CreditRegistrationAdminActionFilters {
        actions: query.action.as_deref(),
        actor_user_id: query.actor_user_id,
        actor_role,
        target_kind: query.target_kind,
        target_id: query.target_id,
        target_phase,
        course_id: query.course_id,
        from: query.from,
        to: query.to,
    };
    let rows = credit_registration_admin_actions::get_page(
        &mut conn,
        &filters,
        pagination.limit(),
        pagination.offset(),
    )
    .await?;
    let total_count = rows.first().map_or(0, |row| row.total_count);

    token.authorized_ok(web::Json(CreditRegistrationAdminActionsPage {
        data: rows.into_iter().map(to_action_row).collect(),
        total_count,
        total_pages: pagination.total_pages(u32::try_from(total_count).unwrap_or(u32::MAX)),
    }))
}

fn to_action_row(row: CreditRegistrationAdminActionListRow) -> CreditRegistrationAdminActionRow {
    CreditRegistrationAdminActionRow {
        actor_first_name: row.actor_first_name,
        actor_last_name: row.actor_last_name,
        actor_email: row.actor_email,
        course_name: row.course_name,
        id: row.action.id,
        created_at: row.action.created_at,
        action: row.action.action,
        target_kind: row.action.target_kind,
        target_id: row.action.target_id,
        target_phase: row.action.target_phase,
        actor_user_id: row.action.actor_user_id,
        actor_role: row.action.actor_role,
        actor_course_id: row.action.actor_course_id,
        reason: row.action.reason,
        before_state: row.action.before_state,
        after_state: row.action.after_state,
        details: row.action.details,
        affected_row_count: row.action.affected_row_count,
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/audit",
        web::get().to(list_credit_registration_admin_actions),
    );
}
