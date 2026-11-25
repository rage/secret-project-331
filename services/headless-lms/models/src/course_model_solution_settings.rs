//! When a course reveals model solutions to students who have not earned them by their own progress.

use crate::prelude::*;
use utoipa::ToSchema;

/// A course's model-solution reveal settings. A course without stored settings uses
/// [`CourseModelSolutionSettings::default`], which reveals nothing beyond the progress rule.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Default, ToSchema)]
pub struct CourseModelSolutionSettings {
    /// Reveal an exercise's model solution to everyone once its deadline (its own, else its
    /// chapter's) has passed.
    pub reveal_after_deadline: bool,
    /// Reveal every model solution to everyone from this moment on.
    pub reveal_at: Option<DateTime<Utc>>,
}

impl CourseModelSolutionSettings {
    /// Whether the settings reveal the model solution of an exercise with the given effective
    /// deadline at `now`, whatever the student's own progress.
    pub fn reveals(&self, effective_deadline: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
        self.reveal_at.is_some_and(|at| at <= now)
            || (self.reveal_after_deadline && effective_deadline.is_some_and(|d| d <= now))
    }
}

pub async fn get(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CourseModelSolutionSettings> {
    let settings = sqlx::query_as!(
        CourseModelSolutionSettings,
        r#"
SELECT reveal_after_deadline,
  reveal_at
FROM course_model_solution_settings
WHERE course_id = $1
"#,
        course_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(settings.unwrap_or_default())
}

pub async fn upsert(
    conn: &mut PgConnection,
    course_id: Uuid,
    settings: &CourseModelSolutionSettings,
) -> ModelResult<CourseModelSolutionSettings> {
    let settings = sqlx::query_as!(
        CourseModelSolutionSettings,
        r#"
INSERT INTO course_model_solution_settings (course_id, reveal_after_deadline, reveal_at)
VALUES ($1, $2, $3) ON CONFLICT (course_id) DO
UPDATE
SET reveal_after_deadline = $2,
  reveal_at = $3
RETURNING reveal_after_deadline,
  reveal_at
"#,
        course_id,
        settings.reveal_after_deadline,
        settings.reveal_at
    )
    .fetch_one(conn)
    .await?;
    Ok(settings)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::test_helper::*;
    use chrono::Duration;

    #[test]
    fn reveals_after_the_deadline_or_from_the_set_moment() {
        let now = Utc::now();
        let past = now - Duration::hours(1);
        let future = now + Duration::hours(1);
        assert!(!CourseModelSolutionSettings::default().reveals(Some(past), now));
        let after_deadline = CourseModelSolutionSettings {
            reveal_after_deadline: true,
            reveal_at: None,
        };
        assert!(after_deadline.reveals(Some(past), now));
        assert!(!after_deadline.reveals(Some(future), now));
        assert!(!after_deadline.reveals(None, now));
        let from_moment = CourseModelSolutionSettings {
            reveal_after_deadline: false,
            reveal_at: Some(past),
        };
        assert!(from_moment.reveals(None, now));
        assert!(
            !CourseModelSolutionSettings {
                reveal_at: Some(future),
                ..from_moment
            }
            .reveals(None, now)
        );
    }

    #[tokio::test]
    async fn a_course_without_settings_reads_as_the_default_and_upsert_replaces() {
        insert_data!(:tx, :user, :org, :course);
        assert_eq!(
            get(tx.as_mut(), course).await.unwrap(),
            CourseModelSolutionSettings::default()
        );
        let settings = CourseModelSolutionSettings {
            reveal_after_deadline: true,
            reveal_at: None,
        };
        upsert(tx.as_mut(), course, &settings).await.unwrap();
        assert_eq!(get(tx.as_mut(), course).await.unwrap(), settings);
        tx.rollback().await;
    }
}
