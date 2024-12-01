use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChapterCompletionRequirements {
    pub id: Uuid,
    pub course_instance_id: Uuid,
    pub chapter_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub completion_points_threshold: Option<i32>,
    pub completion_number_of_exercises_attempted_threshold: Option<i32>,
}

pub async fn insert_chapter_completion_requirements(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    chapter_id: Uuid,
    completion_points_threshold: Option<i32>,
    completion_number_of_exercises_attempted_threshold: Option<i32>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO chapter_completion_requirements(
  course_instance_id,
  chapter_id,
  completion_points_threshold,
  completion_number_of_exercises_attempted_threshold
)
VALUES(
  $1,
  $2,
  $3,
  $4
)
RETURNING id
      ",
        course_instance_id,
        chapter_id,
        completion_points_threshold,
        completion_number_of_exercises_attempted_threshold,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_requirements_by_chapter_id(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<ChapterCompletionRequirements> {
    let completion_requirements = sqlx::query_as!(
        ChapterCompletionRequirements,
        "
      SELECT *
      FROM chapter_completion_requirements
      WHERE chapter_id = $1
      AND deleted_at IS NULL;
    ",
        chapter_id
    )
    .fetch_one(conn)
    .await?;
    Ok(completion_requirements)
}

pub async fn delete_chapter_completion_requirements(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
    UPDATE chapter_completion_requirements
    SET deleted_at = now()
    WHERE chapter_id = $1
  ",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}
