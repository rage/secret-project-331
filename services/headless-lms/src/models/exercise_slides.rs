use super::ModelResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgConnection};
use ts_rs::TS;
use uuid::Uuid;

pub struct NewExerciseSlide {
    exercise_id: Uuid,
    order_number: i32,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone, TS)]
pub struct ExerciseSlide {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_id: Uuid,
    pub order_number: i32,
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    order_number: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_slides (exercise_id, order_number)
VALUES ($1, $2)
RETURNING id;
    ",
        exercise_id,
        order_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert_with_id(
    conn: &mut PgConnection,
    id: Uuid,
    exercise_id: Uuid,
    order_number: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_slides (id, exercise_id, order_number)
VALUES ($1, $2, $3)
RETURNING id;
",
        id,
        exercise_id,
        order_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert_exercise_slide(
    conn: &mut PgConnection,
    new_slide: NewExerciseSlide,
) -> ModelResult<ExerciseSlide> {
    let res = sqlx::query_as!(
        ExerciseSlide,
        "
INSERT INTO exercise_slides (exercise_id, order_number)
VALUES ($1, $2)
RETURNING *;
    ",
        new_slide.exercise_id,
        new_slide.order_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_exercise_slides(conn: &mut PgConnection) -> ModelResult<Vec<ExerciseSlide>> {
    let res = sqlx::query_as!(
        ExerciseSlide,
        "
SELECT *
FROM exercise_slides
WHERE deleted_at IS NULL;
    "
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_exercise_slide(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Option<ExerciseSlide>> {
    let res = sqlx::query_as!(
        ExerciseSlide,
        "
SELECT *
FROM exercise_slides
WHERE id = $1
  AND deleted_at IS NULL;
    ",
        id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_exercise_slide_by_exercise_task_id(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
) -> ModelResult<Option<ExerciseSlide>> {
    let res = sqlx::query_as!(
        ExerciseSlide,
        "
SELECT s.*
FROM exercise_slides s
  JOIN exercise_tasks t ON (s.id = t.exercise_slide_id)
WHERE t.id = $1
  AND t.deleted_at IS NULL
  AND s.deleted_at IS NULL;
    ",
        exercise_task_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_exercise_slides_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<Vec<ExerciseSlide>> {
    let res = sqlx::query_as!(
        ExerciseSlide,
        "
SELECT *
FROM exercise_slides
WHERE exercise_id = $1
  AND deleted_at IS NULL;
    ",
        exercise_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
