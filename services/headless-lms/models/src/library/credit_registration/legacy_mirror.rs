//! Mirroring our successes into the legacy study-registry ledger. The mirror row makes the
//! registry's own `?exclude_already_registered=true` skip the completion, keeps the teacher views'
//! existing `registered` flag working, and gives support the real student number.
//!
//! The row's `study_registry_registrar_id` is null, which is what marks it as ours: we registered the
//! attainment ourselves rather than handing it to a third party holding an API key.

use crate::credit_registrations::RegistrationScope;
use crate::prelude::*;

/// How many rows one iteration may mirror.
pub const LEGACY_MIRROR_LIMIT: i64 = 500;

/// Writes a legacy ledger row for every successful registration that has none; returns the count.
pub async fn mirror_successes_to_legacy_ledger(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<i64> {
    let mirrored = sqlx::query_scalar!(
        r#"
WITH unmirrored AS (
  SELECT cr.course_id,
    cr.course_module_completion_id,
    cr.course_module_id,
    cr.user_id,
    cr.student_number
  FROM credit_registrations cr
  WHERE cr.deleted_at IS NULL
    AND cr.state IN ('registered', 'duplicate', 'not_improved')
    AND cr.student_number IS NOT NULL
    -- A regrade keeps the superseded attempt's success state; only the live attempt may still mirror,
    -- or a completion with both gets two ledger rows and the teacher's completions list shows it twice.
    AND cr.superseded_by_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM course_module_completion_registered_to_study_registries r
      WHERE r.course_module_completion_id = cr.course_module_completion_id
        AND r.study_registry_registrar_id IS NULL
        AND r.deleted_at IS NULL
    )
    AND ($2::uuid IS NULL OR cr.course_id = $2)
    AND ($3::uuid IS NULL OR cr.user_id = $3)
    AND (
      cardinality($4::uuid []) = 0
      OR cr.id = ANY($4::uuid [])
    )
  ORDER BY cr.terminal_at
  LIMIT $1
),
inserted AS (
  INSERT INTO course_module_completion_registered_to_study_registries (
      course_id,
      course_module_completion_id,
      course_module_id,
      user_id,
      real_student_number
    )
  SELECT course_id,
    course_module_completion_id,
    course_module_id,
    user_id,
    student_number
  FROM unmirrored
  -- Matches cmc_registered_to_study_registries_completion_registrar_idx, so a concurrent iteration
  -- that mirrored the same row first is not an error.
  ON CONFLICT (course_module_completion_id, study_registry_registrar_id) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id
)
SELECT COUNT(*) AS "mirrored!"
FROM inserted
        "#,
        limit,
        scope.course_id,
        scope.user_id,
        &scope.credit_registration_ids,
    )
    .fetch_one(conn)
    .await?;
    Ok(mirrored)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::course_module_completions::{
        CourseModuleCompletionGranter, NewCourseModuleCompletion,
    };
    use crate::credit_registrations::{
        CreditRegistrationState, NewCreditRegistration, PayloadSnapshot, Transition,
    };
    use crate::test_helper::*;

    async fn registered_row(
        conn: &mut PgConnection,
        user: Uuid,
        course: Uuid,
        instance: Uuid,
        course_module: Uuid,
        state: CreditRegistrationState,
        student_number: &str,
    ) -> Uuid {
        let completion = crate::course_module_completions::insert(
            conn,
            PKeyPolicy::Generate,
            &NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module,
                user_id: user,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en".to_string(),
                eligible_for_ects: true,
                email: "student@example.com".to_string(),
                grade: Some(4),
                passed: true,
            },
            CourseModuleCompletionGranter::Automatic,
        )
        .await
        .unwrap();
        let id = crate::credit_registrations::insert(
            conn,
            PKeyPolicy::Generate,
            &NewCreditRegistration {
                course_module_completion_id: completion.id,
                user_id: user,
                course_id: course,
                course_module_id: course_module,
                course_instance_id: instance,
                attempt_number: 1,
            },
            None,
        )
        .await
        .unwrap();
        crate::credit_registrations::set_payload_snapshot(
            conn,
            id,
            &PayloadSnapshot {
                student_number: student_number.to_string(),
                sisu_person_id: format!("hy-hlo-{student_number}"),
                uh_course_code: "CRS-101".to_string(),
                selected_enrolment_id: Some("otm-900000101-degree".to_string()),
                selected_enrolment_kind: Some("degree".to_string()),
                selected_enrolment_realisation_id: Some("hy-opt-cur-1".to_string()),
                attainment_date: Utc::now().date_naive(),
                attainment_language: "en".to_string(),
                grade_scale_id: "sis-0-5".to_string(),
                grade_id: "4".to_string(),
                credits: 5.0,
            },
        )
        .await
        .unwrap();
        crate::credit_registrations::transition(conn, id, &Transition::to(state))
            .await
            .unwrap();
        id
    }

    #[tokio::test]
    async fn every_success_state_is_mirrored_once() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        for (index, state) in [
            CreditRegistrationState::Registered,
            CreditRegistrationState::Duplicate,
            CreditRegistrationState::NotImproved,
        ]
        .into_iter()
        .enumerate()
        {
            insert_data!(tx: tx; user: student);
            registered_row(
                tx.as_mut(),
                student,
                course,
                instance.id,
                course_module.id,
                state,
                &format!("90000010{index}"),
            )
            .await;
        }

        let scope = RegistrationScope::for_course(course);
        assert_eq!(
            mirror_successes_to_legacy_ledger(tx.as_mut(), &scope, LEGACY_MIRROR_LIMIT)
                .await
                .unwrap(),
            3
        );
        assert_eq!(
            mirror_successes_to_legacy_ledger(tx.as_mut(), &scope, LEGACY_MIRROR_LIMIT)
                .await
                .unwrap(),
            0
        );
    }

    #[tokio::test]
    async fn the_mirror_row_carries_the_real_student_number() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id = registered_row(
            tx.as_mut(),
            user,
            course,
            instance.id,
            course_module.id,
            CreditRegistrationState::Registered,
            "900000101",
        )
        .await;
        let registration = crate::credit_registrations::get_by_id(tx.as_mut(), id)
            .await
            .unwrap();

        mirror_successes_to_legacy_ledger(
            tx.as_mut(),
            &RegistrationScope::for_course(course),
            LEGACY_MIRROR_LIMIT,
        )
        .await
        .unwrap();

        let mirrored = crate::course_module_completion_registered_to_study_registries::get_platform_registered_row_for_completion(
            tx.as_mut(),
            registration.course_module_completion_id,
        )
        .await
        .unwrap()
        .unwrap();
        assert_eq!(mirrored.user_id, user);
        assert_eq!(mirrored.real_student_number, "900000101");
    }

    #[tokio::test]
    async fn a_registration_that_has_not_succeeded_is_not_mirrored() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        registered_row(
            tx.as_mut(),
            user,
            course,
            instance.id,
            course_module.id,
            CreditRegistrationState::FailedPermanent,
            "900000102",
        )
        .await;
        insert_data!(tx: tx; user: abandoned_student);
        registered_row(
            tx.as_mut(),
            abandoned_student,
            course,
            instance.id,
            course_module.id,
            CreditRegistrationState::AbandonedByConsentWithdrawal,
            "900000103",
        )
        .await;

        assert_eq!(
            mirror_successes_to_legacy_ledger(
                tx.as_mut(),
                &RegistrationScope::for_course(course),
                LEGACY_MIRROR_LIMIT
            )
            .await
            .unwrap(),
            0
        );
    }
}
