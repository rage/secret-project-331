//! What has been done by hand to this course's credit registrations, so two teachers do not both
//! click retry.

use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionFilters,
    CreditRegistrationAdminActionTarget,
};
use headless_lms_models::credit_registrations::CreditRegistrationState;
use std::collections::HashMap;
use utoipa::ToSchema;

use crate::prelude::*;

/// Enough history to see what colleagues have been doing today without becoming an audit trail of
/// its own; the global audit view is the admin dashboard's.
const MAX_ACTIONS: i64 = 100;

/// One audited manual action on this course, named rather than keyed: a teacher reads this to find
/// out whether a colleague has already acted.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseCreditRegistrationAction {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub action: CreditRegistrationAdminAction,
    pub target_kind: CreditRegistrationAdminActionTarget,
    pub target_id: Option<Uuid>,
    pub actor_user_id: Uuid,
    /// `global_admin` or `course_teacher`; support acting on the course looks different from a
    /// colleague acting on it.
    pub actor_role: String,
    pub actor_first_name: Option<String>,
    pub actor_last_name: Option<String>,
    pub reason: Option<String>,
    pub before_state: Option<CreditRegistrationState>,
    pub after_state: Option<CreditRegistrationState>,
    pub affected_row_count: Option<i32>,
}

/**
GET `/api/v0/main-frontend/course-credit-registrations/courses/{course_id}/actions` - The manual
actions taken on this course's credit registrations, newest first.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/courses/{course_id}/actions",
    operation_id = "getCourseCreditRegistrationActions",
    tag = "course-credit-registrations",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses(
        (status = 200, description = "The course's manual actions", body = Vec<CourseCreditRegistrationAction>)
    )
)]
pub async fn get_course_credit_registration_actions(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CourseCreditRegistrationAction>>> {
    let mut conn = pool.acquire().await?;
    let token =
        super::authorize_credit_registration_teacher(&mut conn, user.id, *course_id).await?;

    let records = models::credit_registration_admin_actions::get_page(
        &mut conn,
        &CreditRegistrationAdminActionFilters {
            course_id: Some(*course_id),
            ..Default::default()
        },
        MAX_ACTIONS,
        0,
    )
    .await?
    .into_iter()
    .map(|row| row.action)
    .collect::<Vec<_>>();
    let actor_ids: Vec<Uuid> = records.iter().map(|record| record.actor_user_id).collect();
    let actors: HashMap<Uuid, (Option<String>, Option<String>)> =
        models::user_details::get_user_details_by_user_ids(&mut conn, &actor_ids)
            .await?
            .into_iter()
            .map(|details| (details.user_id, (details.first_name, details.last_name)))
            .collect();

    let res = records
        .into_iter()
        .map(|record| {
            let (actor_first_name, actor_last_name) = actors
                .get(&record.actor_user_id)
                .cloned()
                .unwrap_or_default();
            CourseCreditRegistrationAction {
                actor_first_name,
                actor_last_name,
                id: record.id,
                created_at: record.created_at,
                action: record.action,
                target_kind: record.target_kind,
                target_id: record.target_id,
                actor_user_id: record.actor_user_id,
                actor_role: record.actor_role,
                reason: record.reason,
                before_state: record.before_state,
                after_state: record.after_state,
                affected_row_count: record.affected_row_count,
            }
        })
        .collect();

    token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/courses/{course_id}/actions",
        web::get().to(get_course_credit_registration_actions),
    );
}
