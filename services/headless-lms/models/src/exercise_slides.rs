use futures::future::BoxFuture;
use url::Url;

use crate::{
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_tasks::{self, CourseMaterialExerciseTask},
    prelude::*,
};

pub struct NewExerciseSlide {
    exercise_id: Uuid,
    order_number: i32,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSlide {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_id: Uuid,
    pub order_number: i32,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialExerciseSlide {
    pub id: Uuid,
    pub exercise_tasks: Vec<CourseMaterialExerciseTask>,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    exercise_id: Uuid,
    order_number: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_slides (id, exercise_id, order_number)
VALUES ($1, $2, $3)
RETURNING id
        ",
        pkey_policy.into_uuid(),
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

pub async fn upsert(
    conn: &mut PgConnection,
    id: Uuid,
    exercise_id: Uuid,
    order_number: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_slides (id, exercise_id, order_number)
VALUES ($1, $2, $3) ON CONFLICT (id) DO
UPDATE
SET exercise_id = $2,
    order_number = $3,
    deleted_at = NULL
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

pub async fn get_exercise_slides_by_exercise_ids(
    conn: &mut PgConnection,
    exercise_ids: &[Uuid],
) -> ModelResult<Vec<ExerciseSlide>> {
    let res = sqlx::query_as!(
        ExerciseSlide,
        "
SELECT *
FROM exercise_slides
WHERE exercise_id = ANY($1)
  AND deleted_at IS NULL;
        ",
        exercise_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_exercise_slide(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExerciseSlide> {
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
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_random_exercise_slide_for_exercise(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<ExerciseSlide> {
    let res = sqlx::query_as!(
        ExerciseSlide,
        "
SELECT *
FROM exercise_slides
WHERE exercise_id = $1
  AND deleted_at IS NULL
ORDER BY random()
LIMIT 1;
        ",
        exercise_id
    )
    .fetch_one(conn)
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

pub async fn get_course_material_exercise_slide_by_id(
    conn: &mut PgConnection,
    id: Uuid,
    user_id: Option<Uuid>,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<CourseMaterialExerciseSlide> {
    let exercise_tasks =
        exercise_tasks::get_course_material_exercise_tasks(conn, id, user_id, fetch_service_info)
            .await?;
    Ok(CourseMaterialExerciseSlide { id, exercise_tasks })
}

pub async fn delete_exercise_slides_by_exercise_ids(
    conn: &mut PgConnection,
    exercise_ids: &[Uuid],
) -> ModelResult<Vec<Uuid>> {
    let deleted_ids = sqlx::query!(
        "
UPDATE exercise_slides
SET deleted_at = now()
WHERE exercise_id = ANY($1)
AND deleted_at IS NULL
RETURNING id;
        ",
        exercise_ids,
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|x| x.id)
    .collect();
    Ok(deleted_ids)
}
