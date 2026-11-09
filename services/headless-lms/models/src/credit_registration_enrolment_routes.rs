//! What a student said about enrolling, on the new registration page: the route, the questions
//! that steer students who would struggle to enrol towards a certificate, and the certificate
//! choice.
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

/// Whether a student said they need a certificate or credits in the study registry.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "credit_registration_need", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationNeed {
    Certificate,
    Credits,
}

/// How a student without a Finnish personal identity code said they can identify themselves for
/// enrolling.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(
    type_name = "credit_registration_identification",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationIdentification {
    Eidas,
    OtherSuomiFi,
    #[sqlx(rename = "none")]
    #[serde(rename = "none")]
    NoSuomiFi,
}

/// The student's answers to the enrolment questions, written together and replaced as a whole.
///
/// The detour answers are kept whichever way the answers above them point, so a student who
/// changes an earlier answer and changes it back finds their place.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EnrolmentAnswers {
    pub route: CreditRegistrationEnrolmentRoute,
    pub has_finnish_personal_identity_code: Option<bool>,
    pub need: Option<CreditRegistrationNeed>,
    pub identification: Option<CreditRegistrationIdentification>,
    /// What they need when asked again after saying they cannot identify themselves.
    pub need_after_reconsider: Option<CreditRegistrationNeed>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EnrolmentRouteAnswer {
    pub course_module_completion_id: Uuid,
    pub route: CreditRegistrationEnrolmentRoute,
    pub has_finnish_personal_identity_code: Option<bool>,
    pub need: Option<CreditRegistrationNeed>,
    pub identification: Option<CreditRegistrationIdentification>,
    pub need_after_reconsider: Option<CreditRegistrationNeed>,
    /// When the student pressed Done. `None` until they do, and cleared again if they take it back.
    pub enrolment_confirmed_at: Option<DateTime<Utc>>,
    /// When the student took the certificate instead of registering credits. `None` until they
    /// do, and cleared again if they take it back.
    pub certificate_chosen_at: Option<DateTime<Utc>>,
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
  has_finnish_personal_identity_code,
  need AS "need: _",
  identification AS "identification: _",
  need_after_reconsider AS "need_after_reconsider: _",
  enrolment_confirmed_at,
  certificate_chosen_at
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

/// Records the student's answers, replacing any earlier ones.
///
/// Changing the route clears the Done that went with it: the confirmation was about enrolling the
/// way the old route described, and it says nothing about the new one.
pub async fn set_answers(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
    user_id: Uuid,
    answers: &EnrolmentAnswers,
) -> ModelResult<EnrolmentRouteAnswer> {
    let res = sqlx::query_as!(
        EnrolmentRouteAnswer,
        r#"
INSERT INTO credit_registration_enrolment_routes (
    course_module_completion_id,
    user_id,
    route,
    has_finnish_personal_identity_code,
    need,
    identification,
    need_after_reconsider
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (course_module_completion_id, deleted_at) DO
UPDATE
SET route = EXCLUDED.route,
  has_finnish_personal_identity_code = EXCLUDED.has_finnish_personal_identity_code,
  need = EXCLUDED.need,
  identification = EXCLUDED.identification,
  need_after_reconsider = EXCLUDED.need_after_reconsider,
  enrolment_confirmed_at = CASE
    WHEN credit_registration_enrolment_routes.route = EXCLUDED.route THEN credit_registration_enrolment_routes.enrolment_confirmed_at
    ELSE NULL
  END
RETURNING course_module_completion_id,
  route AS "route: _",
  has_finnish_personal_identity_code,
  need AS "need: _",
  identification AS "identification: _",
  need_after_reconsider AS "need_after_reconsider: _",
  enrolment_confirmed_at,
  certificate_chosen_at
        "#,
        course_module_completion_id,
        user_id,
        answers.route as CreditRegistrationEnrolmentRoute,
        answers.has_finnish_personal_identity_code,
        answers.need as Option<CreditRegistrationNeed>,
        answers.identification as Option<CreditRegistrationIdentification>,
        answers.need_after_reconsider as Option<CreditRegistrationNeed>,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Sets or clears the Done the student pressed to say they had enrolled.
///
/// Errors with not-found when the student has not answered yet.
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
  has_finnish_personal_identity_code,
  need AS "need: _",
  identification AS "identification: _",
  need_after_reconsider AS "need_after_reconsider: _",
  enrolment_confirmed_at,
  certificate_chosen_at
        "#,
        course_module_completion_id,
        confirmed,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Sets or clears the student's choice of the certificate over registering credits.
///
/// Errors with not-found when the student has not answered yet.
pub async fn set_certificate_chosen(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
    chosen: bool,
) -> ModelResult<EnrolmentRouteAnswer> {
    let res = sqlx::query_as!(
        EnrolmentRouteAnswer,
        r#"
UPDATE credit_registration_enrolment_routes
SET certificate_chosen_at = CASE
    WHEN $2 THEN COALESCE(certificate_chosen_at, now())
    ELSE NULL
  END
WHERE course_module_completion_id = $1
  AND deleted_at IS NULL
RETURNING course_module_completion_id,
  route AS "route: _",
  has_finnish_personal_identity_code,
  need AS "need: _",
  identification AS "identification: _",
  need_after_reconsider AS "need_after_reconsider: _",
  enrolment_confirmed_at,
  certificate_chosen_at
        "#,
        course_module_completion_id,
        chosen,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Erases every answer the user gave. Called from account deletion, which is why this is a hard
/// delete: the answers are personal circumstances the student told us.
pub async fn delete_all_by_user_id(conn: &mut PgConnection, user_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
DELETE FROM credit_registration_enrolment_routes
WHERE user_id = $1
        ",
        user_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}
