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
RETURNING id
        ",
        pkey_policy.into_uuid(),
        course_language_group_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
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
