use crate::prelude::*;

/// Hides the given course from the user's personal "My courses" list. Idempotent: hiding an
/// already-hidden course does nothing.
pub async fn hide_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO user_hidden_courses (user_id, course_id)
VALUES ($1, $2)
ON CONFLICT (user_id, course_id) WHERE deleted_at IS NULL DO NOTHING
        ",
        user_id,
        course_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Makes a previously hidden course visible again in the user's "My courses" list. Idempotent: a
/// course that is not hidden is left unchanged.
pub async fn unhide_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE user_hidden_courses
SET deleted_at = now()
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
        ",
        user_id,
        course_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Returns the ids of the courses the given user has hidden from their "My courses" list.
pub async fn get_hidden_course_ids(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let ids = sqlx::query!(
        "
SELECT course_id
FROM user_hidden_courses
WHERE user_id = $1
  AND deleted_at IS NULL
        ",
        user_id,
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|row| row.course_id)
    .collect();
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn hide_course_adds_it_to_the_hidden_list() {
        insert_data!(:tx, :user, :org, :course);

        hide_course(tx.as_mut(), user, course).await.unwrap();

        let hidden = get_hidden_course_ids(tx.as_mut(), user).await.unwrap();
        assert_eq!(hidden, vec![course]);
    }

    #[tokio::test]
    async fn hide_course_is_idempotent() {
        insert_data!(:tx, :user, :org, :course);

        hide_course(tx.as_mut(), user, course).await.unwrap();
        // Hiding again must not error (ON CONFLICT) or create a duplicate active row.
        hide_course(tx.as_mut(), user, course).await.unwrap();

        let hidden = get_hidden_course_ids(tx.as_mut(), user).await.unwrap();
        assert_eq!(hidden, vec![course]);
    }

    #[tokio::test]
    async fn unhide_course_removes_it_from_the_hidden_list() {
        insert_data!(:tx, :user, :org, :course);

        hide_course(tx.as_mut(), user, course).await.unwrap();
        unhide_course(tx.as_mut(), user, course).await.unwrap();

        let hidden = get_hidden_course_ids(tx.as_mut(), user).await.unwrap();
        assert!(hidden.is_empty());
    }

    #[tokio::test]
    async fn unhide_course_is_idempotent_when_not_hidden() {
        insert_data!(:tx, :user, :org, :course);

        // Unhiding a course that was never hidden must not error.
        unhide_course(tx.as_mut(), user, course).await.unwrap();

        let hidden = get_hidden_course_ids(tx.as_mut(), user).await.unwrap();
        assert!(hidden.is_empty());
    }

    #[tokio::test]
    async fn a_course_can_be_hidden_again_after_being_unhidden() {
        insert_data!(:tx, :user, :org, :course);

        hide_course(tx.as_mut(), user, course).await.unwrap();
        unhide_course(tx.as_mut(), user, course).await.unwrap();
        hide_course(tx.as_mut(), user, course).await.unwrap();

        let hidden = get_hidden_course_ids(tx.as_mut(), user).await.unwrap();
        assert_eq!(hidden, vec![course]);
    }

    #[tokio::test]
    async fn hidden_courses_are_scoped_to_the_user() {
        insert_data!(:tx, :user, :org, :course);
        let other_user = crate::users::insert(
            tx.as_mut(),
            crate::PKeyPolicy::Generate,
            "other@example.com",
            None,
            None,
        )
        .await
        .unwrap();

        hide_course(tx.as_mut(), user, course).await.unwrap();

        let other_hidden = get_hidden_course_ids(tx.as_mut(), other_user)
            .await
            .unwrap();
        assert!(other_hidden.is_empty());
    }
}
