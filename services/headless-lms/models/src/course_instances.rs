use std::collections::HashMap;

use crate::{
    chapters,
    chapters::DatabaseChapter,
    exercises,
    prelude::*,
    users::{self, User},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseInstance {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub teacher_in_charge_name: String,
    pub teacher_in_charge_email: String,
    pub support_email: Option<String>,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseInstanceForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub teacher_in_charge_name: String,
    pub teacher_in_charge_email: String,
    pub support_email: Option<String>,
    pub opening_time: Option<DateTime<Utc>>,
    pub closing_time: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy)]
pub struct NewCourseInstance<'a> {
    pub course_id: Uuid,
    pub name: Option<&'a str>,
    pub description: Option<&'a str>,
    pub teacher_in_charge_name: &'a str,
    pub teacher_in_charge_email: &'a str,
    pub support_email: Option<&'a str>,
    pub opening_time: Option<DateTime<Utc>>,
    pub closing_time: Option<DateTime<Utc>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new_course_instance: NewCourseInstance<'_>,
) -> ModelResult<CourseInstance> {
    let course_instance = sqlx::query_as!(
        CourseInstance,
        r#"
INSERT INTO course_instances (
    id,
    course_id,
    name,
    description,
    teacher_in_charge_name,
    teacher_in_charge_email,
    support_email
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  starts_at,
  ends_at,
  name,
  description,
  teacher_in_charge_name,
  teacher_in_charge_email,
  support_email
"#,
        pkey_policy.into_uuid(),
        new_course_instance.course_id,
        new_course_instance.name,
        new_course_instance.description,
        new_course_instance.teacher_in_charge_name,
        new_course_instance.teacher_in_charge_email,
        new_course_instance.support_email,
    )
    .fetch_one(conn)
    .await?;
    Ok(course_instance)
}

pub async fn get_course_instance(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<CourseInstance> {
    let course_instance = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  starts_at,
  ends_at,
  name,
  description,
  teacher_in_charge_name,
  teacher_in_charge_email,
  support_email
FROM course_instances
WHERE id = $1
  AND deleted_at IS NULL;
    "#,
        course_instance_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(course_instance)
}

pub async fn get_default_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CourseInstance> {
    let res = sqlx::query_as!(
        CourseInstance,
        "
SELECT *
FROM course_instances
WHERE course_id = $1
  AND name IS NULL
  AND deleted_at IS NULL
    ",
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_organization_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
SELECT courses.organization_id
FROM course_instances
  JOIN courses ON courses.id = course_instances.course_id
WHERE course_instances.id = $1
",
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.organization_id)
}

pub async fn current_course_instance_of_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<CourseInstance>> {
    let course_instance_enrollment = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT i.id,
  i.created_at,
  i.updated_at,
  i.deleted_at,
  i.course_id,
  i.starts_at,
  i.ends_at,
  i.name,
  i.description,
  i.teacher_in_charge_name,
  i.teacher_in_charge_email,
  i.support_email
FROM user_course_settings ucs
  JOIN course_instances i ON (ucs.current_course_instance_id = i.id)
WHERE ucs.user_id = $1
  AND ucs.current_course_id = $2
  AND ucs.deleted_at IS NULL;
    "#,
        user_id,
        course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(course_instance_enrollment)
}

pub async fn course_instance_by_users_latest_enrollment(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<CourseInstance>> {
    let course_instance = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT i.id,
  i.created_at,
  i.updated_at,
  i.deleted_at,
  i.course_id,
  i.starts_at,
  i.ends_at,
  i.name,
  i.description,
  i.teacher_in_charge_name,
  i.teacher_in_charge_email,
  i.support_email
FROM course_instances i
  JOIN course_instance_enrollments ie ON (i.id = ie.course_id)
WHERE i.course_id = $1
  AND i.deleted_at IS NULL
  AND ie.user_id = $2
  AND ie.deleted_at IS NULL
ORDER BY ie.created_at DESC;
    "#,
        course_id,
        user_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(course_instance)
}

pub async fn get_all_course_instances(conn: &mut PgConnection) -> ModelResult<Vec<CourseInstance>> {
    let course_instances = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  starts_at,
  ends_at,
  name,
  description,
  teacher_in_charge_name,
  teacher_in_charge_email,
  support_email
FROM course_instances
WHERE deleted_at IS NULL
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(course_instances)
}

pub async fn get_course_instances_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseInstance>> {
    let course_instances = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  starts_at,
  ends_at,
  name,
  description,
  teacher_in_charge_name,
  teacher_in_charge_email,
  support_email
FROM course_instances
WHERE course_id = $1
  AND deleted_at IS NULL;
        "#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(course_instances)
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChapterScore {
    #[serde(flatten)]
    pub chapter: DatabaseChapter,
    pub score_given: f32,
    pub score_total: i32,
}

#[derive(Debug, Default, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PointMap(pub HashMap<Uuid, f32>);

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Points {
    pub chapter_points: Vec<ChapterScore>,
    pub users: Vec<User>,
    // PointMap is a workaround for https://github.com/rhys-vdw/ts-auto-guard/issues/158
    pub user_chapter_points: HashMap<Uuid, PointMap>,
}

pub async fn get_points(
    conn: &mut PgConnection,
    instance_id: Uuid,
    _pagination: Pagination, // TODO
) -> ModelResult<Points> {
    let mut chapter_point_totals = HashMap::<Uuid, i32>::new();
    let mut exercise_to_chapter_id = HashMap::new();
    let exercises = exercises::get_exercises_by_course_instance_id(&mut *conn, instance_id).await?;
    for exercise in exercises {
        if let Some(chapter_id) = exercise.chapter_id {
            // exercises without chapter ids (i.e. exams) are not counted
            let total = chapter_point_totals.entry(chapter_id).or_default();
            *total += exercise.score_maximum;
            exercise_to_chapter_id.insert(exercise.id, chapter_id);
        }
    }

    let users: HashMap<Uuid, User> =
        users::get_users_by_course_instance_enrollment(conn, instance_id)
            .await?
            .into_iter()
            .map(|u| (u.id, u))
            .collect();
    let mut chapter_points_given = HashMap::<Uuid, f32>::new();
    let states = sqlx::query!(
        "
SELECT user_id,
  exercise_id,
  score_given
FROM user_exercise_states
WHERE course_instance_id = $1
ORDER BY user_id ASC
",
        instance_id,
    )
    .fetch_all(&mut *conn)
    .await?;
    let mut user_chapter_points = HashMap::<Uuid, PointMap>::new();
    for state in states {
        let user = match users.get(&state.user_id) {
            Some(user) => user,
            None => {
                tracing::warn!(
                    "user {} has an exercise state but no enrollment",
                    state.user_id
                );
                continue;
            }
        };
        if let Some(chapter_id) = exercise_to_chapter_id.get(&state.exercise_id).copied() {
            let chapter_points = user_chapter_points.entry(user.id).or_default();
            let user_given = chapter_points.0.entry(chapter_id).or_default();
            let chapter_given = chapter_points_given.entry(chapter_id).or_default();
            let score_given = state.score_given.unwrap_or_default();
            *user_given += score_given;
            *chapter_given += score_given;
        }
    }

    let chapters = chapters::course_instance_chapters(&mut *conn, instance_id).await?;
    let mut chapter_points: Vec<ChapterScore> = chapters
        .into_iter()
        .map(|c| ChapterScore {
            score_given: chapter_points_given.get(&c.id).copied().unwrap_or_default(),
            score_total: chapter_point_totals.get(&c.id).copied().unwrap_or_default(),
            chapter: c,
        })
        .collect();
    chapter_points.sort_by_key(|c| c.chapter.chapter_number);

    Ok(Points {
        chapter_points,
        users: users.into_values().collect(),
        user_chapter_points,
    })
}

pub async fn edit(
    conn: &mut PgConnection,
    instance_id: Uuid,
    update: CourseInstanceForm,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_instances
SET name = $1,
  description = $2,
  teacher_in_charge_name = $3,
  teacher_in_charge_email = $4,
  support_email = $5,
  starts_at = $6,
  ends_at = $7
WHERE id = $8
",
        update.name,
        update.description,
        update.teacher_in_charge_name,
        update.teacher_in_charge_email,
        update.support_email,
        update.opening_time,
        update.closing_time,
        instance_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_instances
SET deleted_at = now()
WHERE id = $1
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
SELECT course_id
FROM course_instances
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.course_id)
}

pub async fn is_open(conn: &mut PgConnection, id: Uuid) -> ModelResult<bool> {
    let res = sqlx::query!(
        "
SELECT starts_at
FROM course_instances
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    let is_open = if let Some(starts_at) = res.starts_at {
        starts_at <= Utc::now()
    } else {
        false
    };
    Ok(is_open)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn allows_only_one_instance_per_course_without_name() {
        insert_data!(:tx, :user, :org, course: course_id);

        let mut tx1 = tx.begin().await;
        // courses always have a default instance with no name, so this should fail
        let mut instance = NewCourseInstance {
            course_id,
            name: None,
            description: None,
            teacher_in_charge_name: "teacher",
            teacher_in_charge_email: "teacher@example.com",
            support_email: None,
            opening_time: None,
            closing_time: None,
        };
        insert(tx1.as_mut(), PKeyPolicy::Generate, instance)
            .await
            .unwrap_err();
        tx1.rollback().await;

        let mut tx2 = tx.begin().await;
        // after we give it a name, it should be ok
        instance.name = Some("name");
        insert(tx2.as_mut(), PKeyPolicy::Generate, instance)
            .await
            .unwrap();
    }
}
