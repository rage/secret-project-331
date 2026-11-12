//! ssh host keys remembered on the first clone from a git server (trust on first use).

use crate::{error::missing_model_error, prelude::*};

/// A git server's remembered ssh host key.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExerciseRepositorySshHostKey {
    pub id: Uuid,
    /// When the key was first seen.
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    /// Lowercased.
    pub host: String,
    pub port: i32,
    pub sha256_fingerprint: String,
}

/// The key remembered for `host` (compared case-insensitively) and `port`, if any.
pub async fn get(
    conn: &mut PgConnection,
    host: &str,
    port: u16,
) -> ModelResult<Option<ExerciseRepositorySshHostKey>> {
    let res = sqlx::query_as!(
        ExerciseRepositorySshHostKey,
        "
SELECT *
FROM exercise_repository_ssh_host_keys
WHERE host = lower($1)
  AND port = $2
  AND deleted_at IS NULL
",
        host,
        i32::from(port)
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Remembers `sha256_fingerprint` for the server unless a key is already remembered for it, and
/// returns whichever key is remembered afterwards. A caller that sees a different key back lost a
/// race with a clone that saw another key, and must not trust its own.
pub async fn remember(
    conn: &mut PgConnection,
    host: &str,
    port: u16,
    sha256_fingerprint: &str,
) -> ModelResult<ExerciseRepositorySshHostKey> {
    sqlx::query!(
        "
INSERT INTO exercise_repository_ssh_host_keys (host, port, sha256_fingerprint)
VALUES (lower($1), $2, $3)
ON CONFLICT (host, port, deleted_at) DO NOTHING
",
        host,
        i32::from(port),
        sha256_fingerprint
    )
    .execute(&mut *conn)
    .await?;
    get(conn, host, port).await?.ok_or_else(missing_model_error(
        ModelErrorType::RecordNotFound,
        "The remembered ssh host key disappeared",
    ))
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn the_first_remembered_key_wins_and_hosts_are_case_insensitive() {
        insert_data!(:tx);
        let host = format!("Git-{}.Example", Uuid::new_v4());

        assert_eq!(get(tx.as_mut(), &host, 22).await.unwrap(), None);
        let first = remember(tx.as_mut(), &host, 22, "first").await.unwrap();
        assert_eq!(first.sha256_fingerprint, "first");

        let second = remember(tx.as_mut(), &host.to_lowercase(), 22, "second")
            .await
            .unwrap();
        assert_eq!(second.sha256_fingerprint, "first");
        assert_eq!(get(tx.as_mut(), &host, 2222).await.unwrap(), None);
        tx.rollback().await;
    }
}
