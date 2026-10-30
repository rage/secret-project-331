use std::collections::HashMap;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct PageLanguageGroup {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_language_group_id: Uuid,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    course_language_group_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO page_language_groups (
  id,
  course_language_group_id
  )
VALUES ($1, $2)
RETURNING *
        ",
        pkey_policy.into_uuid(),
        course_language_group_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

/// Why a page can't be paired with another course's page through its page language group.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PairingRefusal {
    /// No page with the id, or it is deleted.
    NotPublished,
    /// The page isn't in a course of the course language group, or has no page language group.
    NotInCourseLanguageGroup,
}

/// The page language group a page of a course in `course_language_group_id` joins to pair with
/// `source_page_id`, a published page of another course in that course language group.
///
/// Doesn't check that the source is in another course; a course's own page passes.
pub async fn resolve_pairing(
    conn: &mut PgConnection,
    source_page_id: Uuid,
    course_language_group_id: Uuid,
) -> ModelResult<Result<Uuid, PairingRefusal>> {
    let source = sqlx::query!(
        r#"
SELECT p.page_language_group_id,
  c.course_language_group_id AS "course_language_group_id?"
FROM pages p
  LEFT JOIN courses c ON c.id = p.course_id
  AND c.deleted_at IS NULL
WHERE p.id = $1
  AND p.deleted_at IS NULL
        "#,
        source_page_id
    )
    .fetch_optional(conn)
    .await?;
    let Some(source) = source else {
        return Ok(Err(PairingRefusal::NotPublished));
    };
    Ok(source
        .page_language_group_id
        .filter(|_| source.course_language_group_id == Some(course_language_group_id))
        .ok_or(PairingRefusal::NotInCourseLanguageGroup))
}

/// Whether the course has a page other than `page_id` in page language group `id`.
///
/// Locks the group until the transaction ends, so concurrent publishes pairing pages with it see
/// each other's pages; call it after inserting `page_id`.
pub async fn course_has_other_page(
    conn: &mut PgConnection,
    id: Uuid,
    course_id: Uuid,
    page_id: Uuid,
) -> ModelResult<bool> {
    // Not FOR UPDATE: callers' inserted pages hold KEY SHARE on the group through their foreign
    // key, which FOR UPDATE waits for, deadlocking two publishes into the same group.
    sqlx::query!(
        "SELECT id FROM page_language_groups WHERE id = $1 FOR NO KEY UPDATE",
        id
    )
    .fetch_optional(&mut *conn)
    .await?;
    let has_other = sqlx::query_scalar!(
        r#"
SELECT EXISTS (
    SELECT 1
    FROM pages
    WHERE page_language_group_id = $1
      AND course_id = $2
      AND id <> $3
      AND deleted_at IS NULL
  ) AS "has_other!"
        "#,
        id,
        course_id,
        page_id
    )
    .fetch_one(conn)
    .await?;
    Ok(has_other)
}

pub struct PageLanguageGroupNavigationInfo {
    pub page_language_group_id: Uuid,
    pub page_id: Uuid,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub page_path: String,
}

/** Can be used to find the same page in all the different language versions of the course. Returns a mappgig from course_id or exam_id to the page language group navigation info. */
pub async fn get_all_pages_in_page_language_group_mapping(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<HashMap<CourseOrExamId, PageLanguageGroupNavigationInfo>> {
    let res = sqlx::query_as!(
        PageLanguageGroupNavigationInfo,
        "
SELECT plg.id AS page_language_group_id,
  p.id AS page_id,
  p.url_path AS page_path,
  p.course_id AS course_id,
  p.exam_id AS exam_id
FROM page_language_groups plg
  JOIN pages p ON plg.id = p.page_language_group_id
WHERE plg.id = (SELECT page_language_group_id FROM pages WHERE id = $1)
  AND plg.deleted_at IS NULL
  AND p.deleted_at IS NULL
        ",
        page_id,
    )
    .fetch_all(conn)
    .await?;
    let mut result = HashMap::new();
    for x in res {
        let key = CourseOrExamId::from_course_and_exam_ids(x.course_id, x.exam_id)?;
        result.insert(key, x);
    }
    Ok(result)
}

/// The page language group of each of the course's pages that has one, by page id.
pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<HashMap<Uuid, Uuid>> {
    let rows = sqlx::query!(
        r#"
SELECT id,
  page_language_group_id AS "page_language_group_id!"
FROM pages
WHERE course_id = $1
  AND page_language_group_id IS NOT NULL
  AND deleted_at IS NULL
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.id, row.page_language_group_id))
        .collect())
}
