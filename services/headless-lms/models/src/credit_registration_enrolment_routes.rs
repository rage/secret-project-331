//! What a student said about enrolling, on the new registration page.
//!
//! Advisory throughout: the pipeline never reads these rows. They decide which enrolment
//! instructions the page shows and how far its step list has come, and the study registry is what
//! actually settles whether an enrolment exists.

use utoipa::ToSchema;

use crate::prelude::*;

/// Which university relationship a student picked, which decides only where they are told to enrol.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(
    type_name = "credit_registration_enrolment_route",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationEnrolmentRoute {
    UniversityOfHelsinki,
    OpenUniversity,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EnrolmentRouteAnswer {
    pub course_module_completion_id: Uuid,
    pub route: CreditRegistrationEnrolmentRoute,
    /// When the student pressed Done. `None` until they do, and cleared again if they take it back.
    pub enrolment_confirmed_at: Option<DateTime<Utc>>,
}

pub async fn get_by_completion_id(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
) -> ModelResult<Option<EnrolmentRouteAnswer>> {
    let res = sqlx::query_as!(
        EnrolmentRouteAnswer,
        r#"
SELECT course_module_completion_id,
  route AS "route: _",
  enrolment_confirmed_at
FROM credit_registration_enrolment_routes
WHERE course_module_completion_id = $1
  AND deleted_at IS NULL
        "#,
        course_module_completion_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Records the student's answer, replacing any earlier one.
///
/// Changing the answer clears the Done that went with it: the confirmation was about enrolling the
/// way the old answer described, and it says nothing about the new one.
pub async fn set_route(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
    user_id: Uuid,
    route: CreditRegistrationEnrolmentRoute,
) -> ModelResult<EnrolmentRouteAnswer> {
    let res = sqlx::query_as!(
        EnrolmentRouteAnswer,
        r#"
INSERT INTO credit_registration_enrolment_routes (
    course_module_completion_id,
    user_id,
    route
  )
VALUES ($1, $2, $3)
ON CONFLICT (course_module_completion_id, deleted_at) DO
UPDATE
SET route = EXCLUDED.route,
  enrolment_confirmed_at = CASE
    WHEN credit_registration_enrolment_routes.route = EXCLUDED.route THEN credit_registration_enrolment_routes.enrolment_confirmed_at
    ELSE NULL
  END
RETURNING course_module_completion_id,
  route AS "route: _",
  enrolment_confirmed_at
        "#,
        course_module_completion_id,
        user_id,
        route as CreditRegistrationEnrolmentRoute,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Sets or clears the Done the student pressed to say they had enrolled.
pub async fn set_enrolment_confirmed(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
    confirmed: bool,
) -> ModelResult<EnrolmentRouteAnswer> {
    let res = sqlx::query_as!(
        EnrolmentRouteAnswer,
        r#"
UPDATE credit_registration_enrolment_routes
SET enrolment_confirmed_at = CASE
    WHEN $2 THEN COALESCE(enrolment_confirmed_at, now())
    ELSE NULL
  END
WHERE course_module_completion_id = $1
  AND deleted_at IS NULL
RETURNING course_module_completion_id,
  route AS "route: _",
  enrolment_confirmed_at
        "#,
        course_module_completion_id,
        confirmed,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
