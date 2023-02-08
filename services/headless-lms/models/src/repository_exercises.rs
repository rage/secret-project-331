use crate::prelude::*;
#[cfg(feature = "ts_rs")]
use ts_rs::TS;

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct RepositoryExercise {
    pub id: Uuid,
    pub repository_id: Uuid,
    pub part: String,
    pub name: String,
    pub repository_url: String,
    pub checksum: Vec<u8>,
    pub download_url: String,
}

pub async fn new(
    conn: &mut PgConnection,
    id: Uuid,
    repository_id: Uuid,
    part: &str,
    name: &str,
    checksum: &[u8],
    download_url: &str,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO repository_exercises (
    id,
    repository_id,
    part,
    name,
    checksum,
    download_url
)
VALUES ($1, $2, $3, $4, $5, $6)
",
        id,
        repository_id,
        part,
        name,
        checksum,
        download_url,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_checksum(
    conn: &mut PgConnection,
    exercise: Uuid,
    checksum: &[u8],
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE repository_exercises
SET checksum = $1
WHERE id = $2
",
        checksum,
        exercise
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_part_and_name(
    conn: &mut PgConnection,
    exercise: Uuid,
    part: &str,
    name: &str,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE repository_exercises
SET part = $1,
  name = $2
WHERE id = $3
",
        part,
        name,
        exercise
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete_for_repository(
    conn: &mut PgConnection,
    repository: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
UPDATE repository_exercises
SET deleted_at = now()
WHERE repository_id = $1
AND deleted_at IS NULL
RETURNING id
",
        repository
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|r| r.id)
    .collect();
    Ok(res)
}

pub async fn get_for_repository(
    conn: &mut PgConnection,
    repository: Uuid,
) -> ModelResult<Vec<RepositoryExercise>> {
    let exercises = sqlx::query_as!(
        RepositoryExercise,
        "
SELECT re.id,
  er.id AS repository_id,
  re.part,
  re.name,
  er.url AS repository_url,
  re.checksum,
  re.download_url
FROM repository_exercises AS re
JOIN exercise_repositories AS er ON er.id = re.repository_id
WHERE repository_id = $1
AND re.deleted_at IS NULL
",
        repository
    )
    .fetch_all(conn)
    .await?;
    Ok(exercises)
}

pub async fn get_for_course(
    conn: &mut PgConnection,
    course: Uuid,
) -> ModelResult<Vec<RepositoryExercise>> {
    let exercises = sqlx::query_as!(
        RepositoryExercise,
        "
SELECT re.id,
er.id AS repository_id,
  re.part,
  re.name,
  er.url AS repository_url,
  re.checksum,
  re.download_url
FROM repository_exercises AS re
JOIN exercise_repositories AS er ON er.id = re.repository_id
WHERE er.course_id = $1
AND re.deleted_at IS NULL
and er.deleted_at IS NULL
",
        course
    )
    .fetch_all(conn)
    .await?;
    Ok(exercises)
}

pub async fn delete_from_repository(
    conn: &mut PgConnection,
    repository_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE repository_exercises
SET deleted_at = now()
WHERE repository_id = $1
AND deleted_at IS NULL
",
        repository_id
    )
    .execute(conn)
    .await?;
    Ok(())
}
