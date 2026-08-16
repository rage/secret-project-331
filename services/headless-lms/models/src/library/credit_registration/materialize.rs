//! Creating ledger rows for completions that are allowed to be registered. The same statement is
//! the backfill: flipping a module on makes every pre-existing eligible completion match, and they
//! stop at `pending_consent`, because historical completions belong to students nobody ever asked.

use crate::credit_registrations::{
    CreditRegistrationState, NewCreditRegistration, RegistrationScope, Transition, mark_superseded,
    transition,
};
use crate::prelude::*;

use super::grade_mapping::{GradeComparison, GradeSource, compare_grades, map_grade};

/// How many rows one iteration may create. Also the backfill's rate limit.
pub const MATERIALIZE_LIMIT: i64 = 500;

/// How many re-attempts one iteration may start. Bounded apart from [`MATERIALIZE_LIMIT`] because
/// each of these costs a round trip to the study registry for a credit the student already has.
pub const GRADE_IMPROVEMENT_LIMIT: i64 = 200;

/// Creates a `pending_prerequisites` row and its `created` event for every eligible completion that
/// has none; returns the count.
pub async fn ensure_registration_rows_for_eligible_completions(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<i64> {
    // The ids are generated in the CTE so request_item_id stays derivable from the row id in both
    // directions: it is the only handle Suotar's log and ours share on one registration.
    let created = sqlx::query_scalar!(
        r#"
WITH registrable_completion AS (
  SELECT uuid_generate_v4() AS id,
    cmc.id AS course_module_completion_id,
    cmc.user_id,
    cmc.course_id,
    cmc.course_module_id,
    enrolment.course_instance_id
  FROM course_module_completions cmc
    JOIN course_modules cm ON cm.id = cmc.course_module_id
    -- The completion does not name an instance, and the ledger row must. An inner join, so a
    -- completion whose enrolment was removed is skipped rather than guessed at.
    JOIN LATERAL (
      SELECT cie.course_instance_id
      FROM course_instance_enrollments cie
      WHERE cie.user_id = cmc.user_id
        AND cie.course_id = cmc.course_id
        AND cie.deleted_at IS NULL
      ORDER BY cie.created_at DESC
      LIMIT 1
    ) enrolment ON TRUE
  WHERE cm.enable_credit_registration_via_suotar
    AND cm.deleted_at IS NULL
    AND cmc.deleted_at IS NULL
    -- A hard filter, not a precondition: a failed completion is not waiting for anything, and a
    -- row for it would inflate every queue depth with something that can never move. A later
    -- regrade upwards is picked up by the next iteration.
    AND cmc.passed
    AND cmc.eligible_for_ects
    AND NOT EXISTS (
      SELECT 1
      FROM credit_registrations cr
      WHERE cr.course_module_completion_id = cmc.id
        AND cr.deleted_at IS NULL
    )
    -- Already in the registry through the pull path. Materialising these would send a course's
    -- whole history at Suotar to be told so, one import batch at a time.
    AND NOT EXISTS (
      SELECT 1
      FROM course_module_completion_registered_to_study_registries r
      WHERE r.course_module_completion_id = cmc.id
        AND r.deleted_at IS NULL
    )
    AND ($2::uuid IS NULL OR cmc.course_id = $2)
    AND ($3::uuid IS NULL OR cmc.user_id = $3)
  ORDER BY cmc.created_at
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
      request_item_id
    )
  SELECT id,
    course_module_completion_id,
    user_id,
    course_id,
    course_module_id,
    course_instance_id,
    'cr-' || id
  FROM registrable_completion ON CONFLICT DO NOTHING
  RETURNING id
),
events AS (
  INSERT INTO credit_registration_events (credit_registration_id, kind, to_state, message)
  SELECT id,
    'created',
    'pending_prerequisites',
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
    )
    .fetch_one(conn)
    .await?;
    Ok(created)
}

/// A completion that should have a ledger row and has none.
#[derive(Debug, Clone, PartialEq)]
pub struct UnmaterialisedCompletion {
    pub course_module_completion_id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub completion_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    /// No enrolment to hang a ledger row on, which is the one cause `materialize` cannot fix by
    /// running again.
    pub missing_enrolment: bool,
}

/// Completions [`ensure_registration_rows_for_eligible_completions`] should have picked up at least
/// `min_age_secs` ago and did not.
///
/// Deliberately the same predicate as the materialise statement minus its enrolment join, which is
/// reported per row instead: a completion whose enrolment was removed is invisible to materialise
/// and would otherwise look like a lost row forever. Returns one row over the limit where there are
/// more, so a caller can say so without a second count.
pub async fn get_unmaterialised_eligible_completions(
    conn: &mut PgConnection,
    min_age_secs: i64,
    limit: i64,
) -> ModelResult<Vec<UnmaterialisedCompletion>> {
    let res = sqlx::query_as!(
        UnmaterialisedCompletion,
        r#"
SELECT cmc.id AS course_module_completion_id,
  cmc.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cmc.course_id,
  c.name AS course_name,
  cmc.course_module_id,
  cm.name AS course_module_name,
  cmc.completion_date,
  cmc.created_at,
  NOT EXISTS (
    SELECT 1
    FROM course_instance_enrollments cie
    WHERE cie.user_id = cmc.user_id
      AND cie.course_id = cmc.course_id
      AND cie.deleted_at IS NULL
  ) AS "missing_enrolment!"
FROM course_module_completions cmc
  JOIN course_modules cm ON cm.id = cmc.course_module_id
  JOIN courses c ON c.id = cmc.course_id
  LEFT JOIN user_details ud ON ud.user_id = cmc.user_id
WHERE cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
  AND cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects
  AND cmc.created_at < now() - MAKE_INTERVAL(secs => $1::double precision)
  AND NOT EXISTS (
    SELECT 1
    FROM credit_registrations cr
    WHERE cr.course_module_completion_id = cmc.id
      AND cr.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM course_module_completion_registered_to_study_registries r
    WHERE r.course_module_completion_id = cmc.id
      AND r.deleted_at IS NULL
  )
ORDER BY cmc.created_at
LIMIT $2
        "#,
        min_age_secs as f64,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Supersedes accepted attempts whose completion has since been graded higher, and starts the next
/// attempt at `ready_to_submit`; returns how many were started.
///
/// Only a strictly better grade on the same scale qualifies, so a downward correction and a
/// cross-scale change both do nothing at all. Rows in `submission_uncertain` are deliberately not
/// candidates: whether their import landed is unknown, and a successor would risk a second
/// attainment. The new attempt is an ordinary `ready_to_submit` row from here on.
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
  cr.grade_scale_id AS "registered_grade_scale_id!",
  cr.grade_id AS "registered_grade_id!",
  cmc.passed,
  cmc.grade,
  conf.grade_scale_id AS "configured_grade_scale_id?"
FROM credit_registrations cr
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cr.course_module_id
  AND conf.deleted_at IS NULL
WHERE cr.deleted_at IS NULL
  AND cr.superseded_by_id IS NULL
  -- The success set only. A row whose outcome we do not know must not gain a successor, and one
  -- abandoned by a consent withdrawal is in neither set.
  AND cr.state IN ('registered', 'duplicate', 'not_improved')
  AND cr.grade_scale_id IS NOT NULL
  AND cr.grade_id IS NOT NULL
  AND cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects
  AND cmc.prerequisite_modules_completed
  AND NOT cmc.needs_to_be_reviewed
  AND cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
  -- The successor is born claimable, so consent is checked here rather than left to the next
  -- precondition pass: withdrawal stops future submissions, and a registered attempt is the one
  -- case where the student may have withdrawn long after the row went terminal.
  AND EXISTS (
    SELECT 1
    FROM course_credit_registration_consents consent
    WHERE consent.user_id = cr.user_id
      AND consent.course_id = cr.course_id
      AND consent.consent_given
      AND consent.deleted_at IS NULL
  )
  -- A completion untouched since the attempt was created cannot have been regraded after that
  -- attempt froze its grade. Without it every accepted row is re-read on every iteration, and the
  -- limit below would then keep re-reading the same two hundred forever.
  AND cmc.updated_at > cr.created_at
  AND ($2::uuid IS NULL OR cr.course_id = $2)
  AND ($3::uuid IS NULL OR cr.user_id = $3)
ORDER BY cmc.updated_at FOR
UPDATE OF cr SKIP LOCKED
LIMIT $1
        "#,
        limit,
        scope.course_id,
        scope.user_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    let mut started = 0;
    for candidate in candidates {
        let Ok(mapped) = map_grade(GradeSource {
            passed: candidate.passed,
            grade: candidate.grade,
            configured_grade_scale_id: candidate.configured_grade_scale_id.as_deref(),
            // No enrolment has been resolved for the next attempt yet, so the scale is the module's
            // override or the one the completion itself implies.
            enrolment_grade_scale_id: None,
        }) else {
            continue;
        };
        if compare_grades(
            &candidate.registered_grade_scale_id,
            &candidate.registered_grade_id,
            &mapped,
        ) != GradeComparison::Better
        {
            continue;
        }
        // `uq_credit_registrations_completion` allows one live attempt per completion and the
        // foreign key cannot point at a row that does not exist yet: park the old attempt on
        // itself, insert the successor, then repoint.
        mark_superseded(&mut tx, candidate.id, candidate.id).await?;
        let next = crate::credit_registrations::insert(
            &mut tx,
            PKeyPolicy::Generate,
            &NewCreditRegistration {
                course_module_completion_id: candidate.course_module_completion_id,
                user_id: candidate.user_id,
                course_id: candidate.course_id,
                course_module_id: candidate.course_module_id,
                course_instance_id: candidate.course_instance_id,
                attempt_number: candidate.attempt_number + 1,
            },
            Some(&format!(
                "The completion's grade rose from {} to {}, so the registered attempt was \
                 superseded.",
                candidate.registered_grade_id, mapped.grade_id
            )),
        )
        .await?;
        mark_superseded(&mut tx, candidate.id, next).await?;
        // Not `pending_prerequisites`: that chain was cleared before the first attempt was
        // accepted, the query above rechecks consent and eligibility, and a student number
        // unlinked since sends the row back by itself when the submitter finds none.
        transition(
            &mut tx,
            next,
            &Transition::to(CreditRegistrationState::ReadyToSubmit),
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
    use crate::credit_registrations::{CreditRegistrationState, import_request_item_id};
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
        assert_eq!(rows[0].state, CreditRegistrationState::PendingPrerequisites);
        assert_eq!(rows[0].request_item_id, import_request_item_id(rows[0].id));

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
