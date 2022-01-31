use crate::prelude::*;

#[derive(Debug, Serialize, TS)]
pub struct Acronym {
    id: Uuid,
    acronym: String,
    meaning: String,
}

#[derive(Debug, Deserialize, TS)]
pub struct AcronymUpdate {
    pub acronym: String,
    pub meaning: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    acronym: &str,
    meaning: &str,
    language_code: &str,
    course_slug: &str,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO acronyms (acronym, meaning, language, course_id)
SELECT $1, $2, $3, courses.id
FROM courses WHERE courses.slug = $4
RETURNING id
",
        acronym,
        meaning,
        language_code,
        course_slug
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    acronym: &str,
    meaning: &str,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE acronyms
SET acronym = $1,
  meaning = $2
WHERE id = $3
",
        acronym,
        meaning,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
DELETE FROM acronyms
WHERE id = $1
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn fetch_for_course(
    conn: &mut PgConnection,
    course_slug: &str,
    language_code: &str,
) -> ModelResult<Vec<Acronym>> {
    let res = sqlx::query_as!(
        Acronym,
        "
SELECT acronyms.id,
  acronyms.acronym,
  acronyms.meaning
FROM acronyms
  JOIN courses ON slug = $1
WHERE language = $2
  AND acronyms.course_id = courses.id
",
        course_slug,
        language_code
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
