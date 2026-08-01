//! Creating ledger rows for completions that are allowed to be registered.
//!
//! The same statement is the backfill: flipping a module on makes every one of its pre-existing
//! eligible completions match, so they arrive over a few minutes rather than as one spike. They
//! stop at `pending_consent` — historical completions belong to students nobody ever asked.

use crate::credit_registrations::RegistrationScope;
use crate::prelude::*;

/// How many rows one iteration may create. Also the backfill's rate limit.
pub const MATERIALIZE_LIMIT: i64 = 500;

/// Creates a `pending_prerequisites` row, with its `created` event, for every eligible completion
/// that has none.
///
/// Returns how many rows were created.
pub async fn ensure_registration_rows_for_eligible_completions(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<i64> {
    // The ids are generated in the CTE because request_item_id has to be derivable from the row it
    // sits on in both directions: it is the only handle Suotar's log, our audit log and a per-row
    // fault have on one registration.
    let created = sqlx::query_scalar!(
        r#"
WITH eligible AS (
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
  FROM eligible ON CONFLICT DO NOTHING
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::course_module_completion_registered_to_study_registries::NewCourseModuleCompletionRegisteredToStudyRegistry;
    use crate::course_module_completions::{
        CourseModuleCompletionGranter, NewCourseModuleCompletion,
    };
    use crate::credit_registrations::{CreditRegistrationState, import_request_item_id};
    use crate::test_helper::*;

    async fn enable_suotar(conn: &mut PgConnection, course_module_id: Uuid) {
        sqlx::query(
            "UPDATE course_modules SET enable_credit_registration_via_suotar = TRUE WHERE id = $1",
        )
        .bind(course_module_id)
        .execute(conn)
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
        enable_suotar(tx.as_mut(), course_module.id).await;
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
        enable_suotar(tx.as_mut(), course_module.id).await;
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
        enable_suotar(tx.as_mut(), course_module.id).await;
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

    /// The backfill's most important predicate: these credits are already in the registry, and
    /// asking about them would burn one import batch per twenty-five rows to learn nothing.
    #[tokio::test]
    async fn a_completion_the_pull_path_already_registered_is_skipped() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        enable_suotar(tx.as_mut(), course_module.id).await;
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
        enable_suotar(tx.as_mut(), course_module.id).await;
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
        enable_suotar(tx.as_mut(), course_module.id).await;
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
