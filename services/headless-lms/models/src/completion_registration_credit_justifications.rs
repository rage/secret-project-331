//! Why a student chose credits over a certificate, on the old completion registration page.
//!
//! Advisory throughout: nothing reads these rows to decide anything. They exist so we can tell how
//! often a student without Finnish e-identification still needs the credits.

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CompletionRegistrationCreditJustification {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_module_completion_id: Uuid,
    pub user_id: Uuid,
    pub justification: String,
}

pub async fn get_by_completion_id(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
) -> ModelResult<Option<CompletionRegistrationCreditJustification>> {
    let res = sqlx::query_as!(
        CompletionRegistrationCreditJustification,
        "
SELECT *
FROM completion_registration_credit_justifications
WHERE course_module_completion_id = $1
  AND deleted_at IS NULL
        ",
        course_module_completion_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Records what the student wrote, replacing anything they wrote before.
pub async fn upsert(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
    user_id: Uuid,
    justification: &str,
) -> ModelResult<CompletionRegistrationCreditJustification> {
    let res = sqlx::query_as!(
        CompletionRegistrationCreditJustification,
        "
INSERT INTO completion_registration_credit_justifications (
    course_module_completion_id,
    user_id,
    justification
  )
VALUES ($1, $2, $3)
ON CONFLICT (course_module_completion_id, deleted_at) DO
UPDATE
SET justification = EXCLUDED.justification
RETURNING *
        ",
        course_module_completion_id,
        user_id,
        justification,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Erases everything the user wrote here. Called from account deletion, which is why this is a
/// hard delete: the text is the student's own prose about their own circumstances.
pub async fn delete_all_by_user_id(conn: &mut PgConnection, user_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
DELETE FROM completion_registration_credit_justifications
WHERE user_id = $1
        ",
        user_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        course_module_completions::{
            self, CourseModuleCompletionGranter, NewCourseModuleCompletion,
        },
        test_helper::*,
        users,
    };

    async fn complete(
        conn: &mut PgConnection,
        course_id: Uuid,
        course_module_id: Uuid,
        user_id: Uuid,
    ) -> Uuid {
        course_module_completions::insert(
            conn,
            PKeyPolicy::Generate,
            &NewCourseModuleCompletion {
                course_id,
                course_module_id,
                user_id,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en-US".to_string(),
                eligible_for_ects: true,
                email: "student@example.com".to_string(),
                grade: None,
                passed: true,
            },
            CourseModuleCompletionGranter::Automatic,
        )
        .await
        .unwrap()
        .id
    }

    #[tokio::test]
    async fn replaces_the_earlier_answer_instead_of_keeping_both() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module);
        let completion = complete(tx.as_mut(), course, course_module.id, user).await;

        upsert(tx.as_mut(), completion, user, "First answer.")
            .await
            .unwrap();
        upsert(tx.as_mut(), completion, user, "Second answer.")
            .await
            .unwrap();

        let stored = get_by_completion_id(tx.as_mut(), completion)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(stored.justification, "Second answer.");
    }

    #[tokio::test]
    async fn deleting_the_account_takes_the_answer_with_it() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module);
        let completion = complete(tx.as_mut(), course, course_module.id, user).await;
        upsert(tx.as_mut(), completion, user, "My employer needs them.")
            .await
            .unwrap();

        users::delete_user(tx.as_mut(), user).await.unwrap();

        assert!(
            get_by_completion_id(tx.as_mut(), completion)
                .await
                .unwrap()
                .is_none()
        );
    }
}
