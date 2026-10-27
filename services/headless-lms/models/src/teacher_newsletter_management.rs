use crate::prelude::*;

pub async fn get_users_subscribed_to_teacher_newsletter(
    conn: &mut PgConnection,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query_scalar!(
        "
SELECT user_id
FROM teacher_newsletter_subscriptions
WHERE subscribed = 't';
        ",
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
