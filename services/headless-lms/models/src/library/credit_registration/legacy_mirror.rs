//! Mirroring our successes into the legacy study-registry ledger. The mirror row makes the
//! registry's own `?exclude_already_registered=true` skip the completion, keeps the teacher views'
//! existing `registered` flag working, and gives support the real student number.
//!
//! The row's `study_registry_registrar_id` is null, which is what marks it as ours: we registered the
//! attainment ourselves rather than handing it to a third party holding an API key.

use crate::credit_registrations::{CreditRegistrationState, RegistrationScope};
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
    AND cr.state = ANY($5::credit_registration_state [])
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
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
    )
    .fetch_one(conn)
    .await?;
    Ok(mirrored)
}

/// One ledger row whose standing in the legacy ledger disagrees with ours.
#[derive(Debug, Clone, PartialEq)]
pub struct LegacyLedgerDivergence {
    pub credit_registration_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    /// We registered it and the legacy ledger has no row of ours, so the teacher views and the pull
    /// stream still call the completion unregistered.
    pub mirror_missing: bool,
    /// A registrar took the completion through the pull path while our pipeline had not finished
    /// with it, which is how the same attainment gets submitted twice.
    pub registered_by_a_registrar: bool,
}

/// Ledger rows the legacy ledger contradicts, in either direction.
///
/// Not "every completion the pull path registered": `materialize` skips those on purpose, so
/// listing them would report the coexistence design as a fault. Only rows where one side has moved
/// and the other has not are here.
pub async fn get_legacy_ledger_divergences(
    conn: &mut PgConnection,
    limit: i64,
) -> ModelResult<Vec<LegacyLedgerDivergence>> {
    let res = sqlx::query_as!(
        LegacyLedgerDivergence,
        r#"
SELECT cr.id AS credit_registration_id,
  cr.course_module_completion_id,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  c.name AS course_name,
  cr.course_module_id,
  cr.state,
  cr.state_entered_at,
  d.mirror_missing AS "mirror_missing!",
  d.registered_by_a_registrar AS "registered_by_a_registrar!"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  CROSS JOIN LATERAL (
    SELECT cr.state = ANY($2::credit_registration_state [])
      AND cr.student_number IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM course_module_completion_registered_to_study_registries r
        WHERE r.course_module_completion_id = cr.course_module_completion_id
          AND r.study_registry_registrar_id IS NULL
          AND r.deleted_at IS NULL
      ) AS mirror_missing,
      NOT (cr.state = ANY($2::credit_registration_state []))
      AND EXISTS (
        SELECT 1
        FROM course_module_completion_registered_to_study_registries r
        WHERE r.course_module_completion_id = cr.course_module_completion_id
          AND r.study_registry_registrar_id IS NOT NULL
          AND r.deleted_at IS NULL
      ) AS registered_by_a_registrar
  ) d
WHERE cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND (
    d.mirror_missing
    OR d.registered_by_a_registrar
  )
ORDER BY cr.state_entered_at DESC
LIMIT $1
        "#,
        limit,
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
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
        crate::credit_registrations::transition(conn, id, &Transition::planted(state))
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
