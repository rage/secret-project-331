//! Creating ledger rows for completions that are allowed to be registered. It catches up as well as
//! keeps up: any completion carrying the push-path flag and still missing a row gets one, stopping
//! at `pending`, because historical completions belong to students nobody ever asked. Turning a
//! module on reaches none made before it: `register_credits_via_suotar` is set at creation or by hand.
//! A mooc.fi completion gets its row once its target is enabled.

use crate::credit_registrations::{
    BatchMove, CreditRegistrationState, NewCreditRegistration, NewRegistrationSubject,
    RegistrationScope, Transition, mark_improvement_checked, mark_superseded, transition_batch,
};
use crate::prelude::*;

use super::grade_mapping::{GradeComparison, GradeSource, MappedGrade, compare_grades, map_grade};

/// How many rows one iteration may create, and so the rate at which a catch-up drains.
pub const MATERIALIZE_LIMIT: i64 = 500;

/// How many re-attempts one iteration may start. Bounded apart from [`MATERIALIZE_LIMIT`] because
/// each of these costs a round trip to the study registry for a credit the student already has.
pub const GRADE_IMPROVEMENT_LIMIT: i64 = 200;

/// Creates a `pending` row and its `created` event for every registrable completion that has none;
/// returns the count.
pub async fn ensure_registration_rows_for_eligible_completions(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<i64> {
    let created = sqlx::query_scalar!(
        r#"
WITH registrable_completion AS (
  (
    SELECT uuid_generate_v4() AS id,
      c.course_module_completion_id,
      c.user_id,
      c.course_id,
      c.course_module_id,
      enrolment.course_instance_id,
      NULL::uuid AS external_completion_id,
      NULL::uuid AS external_credit_target_id,
      c.created_at
    FROM credit_registration_registrable_completions c
      -- The completion does not name an instance, and the ledger row must. An inner join, so a
      -- completion whose enrolment was removed is skipped rather than guessed at.
      JOIN LATERAL (
        SELECT cie.course_instance_id
        FROM course_instance_enrollments cie
        WHERE cie.user_id = c.user_id
          AND cie.course_id = c.course_id
          AND cie.deleted_at IS NULL
        ORDER BY cie.created_at DESC
        LIMIT 1
      ) enrolment ON TRUE
    WHERE c.kind = 'course_module'
      AND ($2::uuid IS NULL OR c.course_id = $2)
      AND ($4::uuid IS NULL OR c.external_credit_target_id = $4)
      AND ($3::uuid IS NULL OR c.user_id = $3)
  )
  UNION ALL
  (
    SELECT uuid_generate_v4() AS id,
      NULL::uuid,
      c.user_id,
      NULL::uuid,
      NULL::uuid,
      NULL::uuid,
      c.external_completion_id,
      c.external_credit_target_id,
      c.created_at
    FROM credit_registration_registrable_completions c
      JOIN external_credit_targets t ON t.id = c.external_credit_target_id
      AND t.enabled_at IS NOT NULL
    WHERE c.kind = 'mooc_fi'
      AND ($2::uuid IS NULL OR c.course_id = $2)
      AND ($4::uuid IS NULL OR c.external_credit_target_id = $4)
      AND ($3::uuid IS NULL OR c.user_id = $3)
  )
  ORDER BY created_at
  LIMIT $1
),
inserted AS (
  INSERT INTO credit_registrations (
      id,
      course_module_completion_id,
      user_id,
      course_id,
      course_module_id,
      course_instance_id,
      external_completion_id,
      external_credit_target_id
    )
  SELECT id,
    course_module_completion_id,
    user_id,
    course_id,
    course_module_id,
    course_instance_id,
    external_completion_id,
    external_credit_target_id
  FROM registrable_completion ON CONFLICT DO NOTHING
  RETURNING id
),
events AS (
  INSERT INTO credit_registration_events (credit_registration_id, kind, to_state, message)
  SELECT id,
    'created',
    'pending',
    'Created for an eligible completion.'
  FROM inserted
  RETURNING credit_registration_id
)
SELECT COUNT(*) AS "created!"
FROM events
        "#,
        limit,
        scope.course_id,
        scope.user_id,
        scope.external_credit_target_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(created)
}

/// A completion that should have a ledger row and has none.
#[derive(Debug, Clone, PartialEq)]
pub struct UnmaterialisedCompletion {
    /// The completion, whichever kind it is.
    pub subject_id: Uuid,
    pub course_module_completion_id: Option<Uuid>,
    pub external_completion_id: Option<Uuid>,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    /// `None` for a mooc.fi completion, as are `course_module_id` and `course_module_name`.
    pub course_id: Option<Uuid>,
    /// The course's name, or "mooc.fi: " and the target's name.
    pub course_name: String,
    pub course_module_id: Option<Uuid>,
    pub course_module_name: Option<String>,
    pub external_credit_target_id: Option<Uuid>,
    pub completion_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    /// No enrolment to hang a ledger row on, which is the one cause `materialize` cannot fix by
    /// running again. Never true for a mooc.fi completion, whose row names no instance.
    pub missing_enrolment: bool,
}

/// Completions [`ensure_registration_rows_for_eligible_completions`] should have picked up at least
/// `min_age_secs` ago and did not.
///
/// The materialise statement's own view, minus its enrolment join, which is reported per row
/// instead: a completion whose enrolment was removed is invisible to materialise and would
/// otherwise look like a lost row forever. Returns one row over the limit where there are more, so
/// a caller can say so without a second count.
pub async fn get_unmaterialised_eligible_completions(
    conn: &mut PgConnection,
    min_age_secs: i64,
    limit: i64,
) -> ModelResult<Vec<UnmaterialisedCompletion>> {
    let res = sqlx::query_as!(
        UnmaterialisedCompletion,
        r#"
SELECT rc.subject_id AS "subject_id!",
  rc.course_module_completion_id,
  rc.external_completion_id,
  rc.user_id AS "user_id!",
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  rc.course_id,
  COALESCE(c.name, 'mooc.fi: ' || t.name) AS "course_name!",
  rc.course_module_id,
  cm.name AS "course_module_name?",
  rc.external_credit_target_id,
  rc.completion_date AS "completion_date!",
  rc.created_at AS "created_at!",
  rc.kind = 'course_module'
  AND NOT EXISTS (
    SELECT 1
    FROM course_instance_enrollments cie
    WHERE cie.user_id = rc.user_id
      AND cie.course_id = rc.course_id
      AND cie.deleted_at IS NULL
  ) AS "missing_enrolment!"
FROM credit_registration_registrable_completions rc
  LEFT JOIN course_modules cm ON cm.id = rc.course_module_id
  LEFT JOIN courses c ON c.id = rc.course_id
  LEFT JOIN external_credit_targets t ON t.id = rc.external_credit_target_id
  LEFT JOIN user_details ud ON ud.user_id = rc.user_id
WHERE rc.created_at < now() - MAKE_INTERVAL(secs => $1::double precision)
  AND (
    (
      rc.kind = 'course_module'
      AND cm.deleted_at IS NULL
      AND c.deleted_at IS NULL
    )
    OR (
      rc.kind = 'mooc_fi'
      AND t.enabled_at IS NOT NULL
    )
  )
ORDER BY rc.created_at
LIMIT $2
        "#,
        min_age_secs as f64,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Starts a new attempt at `ready_to_submit` for every accepted attempt whose completion has since
/// been graded higher; returns how many were started.
///
/// Only a strictly better grade on the same scale qualifies, so a downward correction and a
/// cross-scale change both do nothing at all. Rows in `submission_uncertain` are deliberately not
/// candidates: whether their import landed is unknown, and a successor would risk a second
/// attainment.
///
/// The accepted attempt stays the live credit: resolve-enrolments weighs the new one against it
/// through [`crate::credit_registrations::lock_live_successes_for_same_course_code`], exactly as it
/// does a better grade that arrives as a new completion, and marks it for replacement only if the
/// new one goes out.
pub async fn start_re_attempts_for_improved_grades(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<i64> {
    let mut tx = conn.begin().await?;
    let candidates = sqlx::query!(
        r#"
SELECT cr.id,
  cr.attempt_number,
  cr.course_module_completion_id,
  cr.user_id,
  cr.course_id,
  cr.course_module_id,
  cr.course_instance_id,
  cr.external_completion_id,
  cr.external_credit_target_id,
  cr.grade_scale_id AS "registered_grade_scale_id!",
  cr.grade_id AS "registered_grade_id!",
  s.passed AS "passed!",
  s.grade,
  s.revised_at AS "completion_revised_at!"
FROM credit_registrations cr
  JOIN credit_registration_subjects s ON s.subject_id = cr.subject_id
  -- Membership is the whole eligibility check: the view is the unit opt-in and the completion
  -- being live, passed and ECTS-eligible, and fully_eligible the prerequisites and the review.
  JOIN credit_registration_eligible_completions e ON e.subject_id = cr.subject_id
  AND e.fully_eligible
WHERE cr.deleted_at IS NULL
  AND cr.superseded_by_id IS NULL
  AND cr.pending_superseded_by_id IS NULL
  -- The success set only: a row whose outcome we do not know must not gain a successor.
  AND cr.state = ANY($4::credit_registration_state [])
  AND cr.grade_scale_id IS NOT NULL
  AND cr.grade_id IS NOT NULL
  -- Only the latest attempt: a newer one, even one that stopped short, reads the completion's grade
  -- afresh whenever it resolves again.
  AND NOT EXISTS (
    SELECT 1
    FROM credit_registrations later
    WHERE later.subject_id = cr.subject_id
      AND later.attempt_number > cr.attempt_number
      AND later.deleted_at IS NULL
  )
  -- Two halves of one cheap pre-filter. A completion unrevised since the attempt was created cannot
  -- have been regraded after that attempt froze its grade; but one revised for any other reason
  -- passes that test forever, and only the grade comparison below can tell the two apart, which is
  -- why the loop stamps the watermark on every candidate it declines. Without the second half the
  -- limit keeps spending itself on the same rows while a real regrade waits behind them.
  AND s.revised_at > cr.created_at
  AND (
    cr.improvement_checked_completion_updated_at IS NULL
    OR s.revised_at > cr.improvement_checked_completion_updated_at
  )
  AND ($2::uuid IS NULL OR cr.course_id = $2)
  AND ($5::uuid IS NULL OR cr.external_credit_target_id = $5)
  AND ($3::uuid IS NULL OR cr.user_id = $3)
ORDER BY s.revised_at FOR
UPDATE OF cr SKIP LOCKED
LIMIT $1
        "#,
        limit,
        scope.course_id,
        scope.user_id,
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
        scope.external_credit_target_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    let mut starts = Vec::new();
    for candidate in candidates {
        // Stamped rather than merely skipped, in both refusals below: the query's pre-filter cannot
        // tell a regrade from any other touch of the completion, so a candidate left unstamped comes
        // back on every iteration and eventually fills the batch.
        let looked_at = candidate.completion_revised_at;
        let Ok(mapped) = map_grade(GradeSource {
            passed: candidate.passed,
            grade: candidate.grade,
            // No enrolment has been resolved for the next attempt yet, so the scale is the one the
            // completion itself implies.
            enrolment_grade_scale_id: None,
        }) else {
            mark_improvement_checked(&mut tx, candidate.id, looked_at).await?;
            continue;
        };
        let registered = MappedGrade {
            grade_scale_id: candidate.registered_grade_scale_id,
            grade_id: candidate.registered_grade_id,
        };
        if compare_grades(&registered, &mapped) != GradeComparison::Better {
            mark_improvement_checked(&mut tx, candidate.id, looked_at).await?;
            continue;
        }
        let subject = NewRegistrationSubject::from_columns(
            candidate.course_module_completion_id,
            candidate.course_id,
            candidate.course_module_id,
            candidate.course_instance_id,
            candidate.external_completion_id,
            candidate.external_credit_target_id,
        )
        .ok_or_else(|| {
            model_err!(
                Generic,
                "A ledger row names neither exactly a course module completion nor a mooc.fi one."
            )
        })?;
        let next = crate::credit_registrations::insert(
            &mut tx,
            PKeyPolicy::Generate,
            &NewCreditRegistration {
                subject,
                user_id: candidate.user_id,
                attempt_number: candidate.attempt_number + 1,
            },
            Some(&format!(
                "The completion's grade rose from {} to {}. The registered attempt stays the credit \
                 until this one is registered in its place.",
                registered.grade_id, mapped.grade_id
            )),
        )
        .await?;
        // Not `pending`: the preconditions were cleared before the first attempt was accepted, the
        // query above rechecks eligibility, and a student number unlinked since sends the row back
        // by itself when the submitter finds none.
        starts.push(BatchMove {
            id: next,
            transition: Transition::to(CreditRegistrationState::ReadyToSubmit),
        });
    }
    let started = transition_batch(&mut tx, &starts).await?;
    tx.commit().await?;
    Ok(started)
}

/// Starts a new attempt, at `pending`, for every completion registrable again after the pipeline
/// cancelled its latest attempt on withdrawal; returns how many were started. What brings one back
/// is mostly mooc.fi: a completion that reappears there, or whose tier or date is corrected.
///
/// The cancelled attempt is superseded by the new one and keeps its history. An attempt an admin
/// cancelled stays the last word.
pub async fn start_re_attempts_for_restored_completions(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<i64> {
    let mut tx = conn.begin().await?;
    let candidates = sqlx::query!(
        r#"
SELECT cr.id,
  cr.attempt_number,
  cr.course_module_completion_id,
  cr.user_id,
  cr.course_id,
  cr.course_module_id,
  cr.course_instance_id,
  cr.external_completion_id,
  cr.external_credit_target_id
FROM credit_registrations cr
  JOIN credit_registration_eligible_completions e ON e.subject_id = cr.subject_id
  LEFT JOIN external_credit_targets t ON t.id = cr.external_credit_target_id
WHERE cr.deleted_at IS NULL
  AND cr.superseded_by_id IS NULL
  AND cr.state = 'cancelled'
  AND (
    cr.external_credit_target_id IS NULL
    OR t.enabled_at IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM credit_registrations later
    WHERE later.subject_id = cr.subject_id
      AND later.attempt_number > cr.attempt_number
      AND later.deleted_at IS NULL
  )
  -- Only withdrawal cancels without an actor; a hand cancellation names the admin.
  AND (
    SELECT ev.actor_user_id IS NULL
    FROM credit_registration_events ev
    WHERE ev.credit_registration_id = cr.id
      AND ev.to_state = 'cancelled'
      AND ev.deleted_at IS NULL
    ORDER BY ev.created_at DESC
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1
    FROM course_module_completion_registered_to_study_registries r
    WHERE r.course_module_completion_id = cr.course_module_completion_id
      AND r.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM external_completions ec
    WHERE ec.id = cr.external_completion_id
      AND ec.reported_at IS NOT NULL
  )
  AND ($2::uuid IS NULL OR cr.course_id = $2)
  AND ($4::uuid IS NULL OR cr.external_credit_target_id = $4)
  AND ($3::uuid IS NULL OR cr.user_id = $3)
ORDER BY cr.state_entered_at FOR
UPDATE OF cr SKIP LOCKED
LIMIT $1
        "#,
        limit,
        scope.course_id,
        scope.user_id,
        scope.external_credit_target_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    let mut started = 0;
    for candidate in candidates {
        let subject = NewRegistrationSubject::from_columns(
            candidate.course_module_completion_id,
            candidate.course_id,
            candidate.course_module_id,
            candidate.course_instance_id,
            candidate.external_completion_id,
            candidate.external_credit_target_id,
        )
        .ok_or_else(|| {
            model_err!(
                Generic,
                "A ledger row names neither exactly a course module completion nor a mooc.fi one."
            )
        })?;
        let next = Uuid::new_v4();
        // Before the insert: the cancelled row holds the completion's slot in
        // uq_credit_registrations_completion until it is superseded.
        mark_superseded(&mut tx, candidate.id, next).await?;
        crate::credit_registrations::insert(
            &mut tx,
            PKeyPolicy::Fixed(next),
            &NewCreditRegistration {
                subject,
                user_id: candidate.user_id,
                attempt_number: candidate.attempt_number + 1,
            },
            Some("The completion is registrable again after its previous attempt was withdrawn."),
        )
        .await?;
        started += 1;
    }
    tx.commit().await?;
    Ok(started)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::course_module_completion_registered_to_study_registries::NewCourseModuleCompletionRegisteredToStudyRegistry;
    use crate::course_module_completions::{
        CourseModuleCompletionGranter, NewCourseModuleCompletion,
    };
    use crate::credit_registrations::CreditRegistrationState;
    use crate::test_helper::*;

    async fn enable_suotar(
        conn: &mut PgConnection,
        course_module: &crate::course_modules::CourseModule,
    ) {
        crate::course_modules::update(
            conn,
            course_module.id,
            &crate::course_modules::NewCourseModule::new(
                course_module.course_id,
                course_module.name.clone(),
                course_module.order_number,
            )
            .set_enable_credit_registration_via_suotar(true),
        )
        .await
        .unwrap();
        crate::course_modules::set_register_eligible_new_completions_via_suotar(
            conn,
            course_module.id,
            true,
        )
        .await
        .unwrap();
    }

    async fn add_completion(
        conn: &mut PgConnection,
        course: Uuid,
        course_module: Uuid,
        course_instance: Uuid,
        user: Uuid,
        passed: bool,
        eligible_for_ects: bool,
    ) -> Uuid {
        crate::course_instance_enrollments::insert(conn, user, course, course_instance)
            .await
            .unwrap();
        // Eligibility for the push path at creation.
        if crate::verified_student_numbers::get_by_user_id(conn, user)
            .await
            .unwrap()
            .is_none()
        {
            let student_number = format!("{:09}", user.as_u128() % 1_000_000_000);
            crate::verified_student_numbers::insert(
                conn,
                PKeyPolicy::Generate,
                &crate::verified_student_numbers::NewVerifiedStudentNumber {
                    user_id: user,
                    sisu_person_id: DbSecret::new(format!("hy-hlo-{student_number}")),
                    student_number: DbSecret::new(student_number),
                    first_names: None,
                    last_name: None,
                    verified_via:
                        crate::verified_student_numbers::StudentNumberVerificationMethod::EmailedLink,
                    verified_via_email: Some(DbSecret::new("student@example.com")),
                    linked_by_user_id: None,
                    link_reason: None,
                    verified_from_course_id: None,
                },
            )
            .await
            .unwrap();
        }
        crate::course_module_completions::insert(
            conn,
            PKeyPolicy::Generate,
            &NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module,
                user_id: user,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en".to_string(),
                eligible_for_ects,
                email: "student@example.com".to_string(),
                grade: Some(4),
                passed,
            },
            CourseModuleCompletionGranter::Automatic,
        )
        .await
        .unwrap()
        .id
    }

    #[tokio::test]
    async fn a_completion_on_an_enabled_module_gets_a_row_addressed_by_its_own_id() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        enable_suotar(tx.as_mut(), &course_module).await;
        add_completion(
            tx.as_mut(),
            course,
            course_module.id,
            instance.id,
            user,
            true,
            true,
        )
        .await;

        let created = ensure_registration_rows_for_eligible_completions(
            tx.as_mut(),
            &RegistrationScope::default(),
            MATERIALIZE_LIMIT,
        )
        .await
        .unwrap();
        assert_eq!(created, 1);

        let rows = crate::credit_registrations::get_by_course_id(tx.as_mut(), course)
            .await
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].state, CreditRegistrationState::Pending);

        let events =
            crate::credit_registration_events::get_by_registration_id(tx.as_mut(), rows[0].id)
                .await
                .unwrap();
        assert_eq!(events.len(), 1);
    }

    #[tokio::test]
    async fn running_twice_creates_nothing_the_second_time() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        enable_suotar(tx.as_mut(), &course_module).await;
        add_completion(
            tx.as_mut(),
            course,
            course_module.id,
            instance.id,
            user,
            true,
            true,
        )
        .await;

        let scope = RegistrationScope::default();
        assert_eq!(
            ensure_registration_rows_for_eligible_completions(
                tx.as_mut(),
                &scope,
                MATERIALIZE_LIMIT
            )
            .await
            .unwrap(),
            1
        );
        assert_eq!(
            ensure_registration_rows_for_eligible_completions(
                tx.as_mut(),
                &scope,
                MATERIALIZE_LIMIT
            )
            .await
            .unwrap(),
            0
        );
    }

    #[tokio::test]
    async fn a_module_that_was_never_opted_in_materialises_nothing() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        add_completion(
            tx.as_mut(),
            course,
            course_module.id,
            instance.id,
            user,
            true,
            true,
        )
        .await;
        assert_eq!(
            ensure_registration_rows_for_eligible_completions(
                tx.as_mut(),
                &RegistrationScope::default(),
                MATERIALIZE_LIMIT
            )
            .await
            .unwrap(),
            0
        );
    }

    #[tokio::test]
    async fn a_failed_or_ects_ineligible_completion_never_gets_a_row() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        enable_suotar(tx.as_mut(), &course_module).await;
        add_completion(
            tx.as_mut(),
            course,
            course_module.id,
            instance.id,
            user,
            false,
            true,
        )
        .await;

        insert_data!(tx: tx; user: other_user);
        add_completion(
            tx.as_mut(),
            course,
            course_module.id,
            instance.id,
            other_user,
            true,
            false,
        )
        .await;

        assert_eq!(
            ensure_registration_rows_for_eligible_completions(
                tx.as_mut(),
                &RegistrationScope::default(),
                MATERIALIZE_LIMIT
            )
            .await
            .unwrap(),
            0
        );
    }

    #[tokio::test]
    async fn a_completion_the_pull_path_already_registered_is_skipped() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        enable_suotar(tx.as_mut(), &course_module).await;
        let completion = add_completion(
            tx.as_mut(),
            course,
            course_module.id,
            instance.id,
            user,
            true,
            true,
        )
        .await;
        let registrar = crate::study_registry_registrars::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "Test registrar",
            "test-registrar-secret-key",
        )
        .await
        .unwrap();
        crate::course_module_completion_registered_to_study_registries::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: course,
                course_module_completion_id: completion,
                course_module_id: course_module.id,
                study_registry_registrar_id: registrar,
                user_id: user,
                real_student_number: "012345678".to_string(),
            },
        )
        .await
        .unwrap();

        assert_eq!(
            ensure_registration_rows_for_eligible_completions(
                tx.as_mut(),
                &RegistrationScope::default(),
                MATERIALIZE_LIMIT
            )
            .await
            .unwrap(),
            0
        );
    }

    #[tokio::test]
    async fn a_scoped_run_leaves_another_courses_completions_alone() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        enable_suotar(tx.as_mut(), &course_module).await;
        add_completion(
            tx.as_mut(),
            course,
            course_module.id,
            instance.id,
            user,
            true,
            true,
        )
        .await;

        let elsewhere = Uuid::new_v4();
        assert_eq!(
            ensure_registration_rows_for_eligible_completions(
                tx.as_mut(),
                &RegistrationScope::for_course(elsewhere),
                MATERIALIZE_LIMIT
            )
            .await
            .unwrap(),
            0
        );
        assert_eq!(
            ensure_registration_rows_for_eligible_completions(
                tx.as_mut(),
                &RegistrationScope::for_course(course),
                MATERIALIZE_LIMIT
            )
            .await
            .unwrap(),
            1
        );
    }

    #[tokio::test]
    async fn the_limit_bounds_one_iteration() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        enable_suotar(tx.as_mut(), &course_module).await;
        add_completion(
            tx.as_mut(),
            course,
            course_module.id,
            instance.id,
            user,
            true,
            true,
        )
        .await;
        insert_data!(tx: tx; user: second_user);
        add_completion(
            tx.as_mut(),
            course,
            course_module.id,
            instance.id,
            second_user,
            true,
            true,
        )
        .await;

        let scope = RegistrationScope::default();
        assert_eq!(
            ensure_registration_rows_for_eligible_completions(tx.as_mut(), &scope, 1)
                .await
                .unwrap(),
            1
        );
        assert_eq!(
            ensure_registration_rows_for_eligible_completions(tx.as_mut(), &scope, 1)
                .await
                .unwrap(),
            1
        );
    }
}
