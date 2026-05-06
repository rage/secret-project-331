use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, ToSchema)]

pub struct Term {
    pub id: Uuid,
    pub term: String,
    pub definition: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct GlossaryTerm {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub term: String,
    pub definition: String,
    pub course_id: Uuid,
}

#[derive(Debug, Deserialize, ToSchema)]

pub struct TermUpdate {
    pub term: String,
    pub definition: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    term: &str,
    definition: &str,
    course_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO glossary (term, definition, course_id)
SELECT $1, $2, $3
RETURNING id
",
        term,
        definition,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    term: &str,
    definition: &str,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE glossary
SET term = $1,
  definition = $2
WHERE id = $3
",
        term,
        definition,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_term_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<GlossaryTerm> {
    let res = sqlx::query_as!(
        GlossaryTerm,
        "
SELECT *
FROM glossary
WHERE id = $1
  AND deleted_at IS NULL
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_term_by_id_and_course_id(
    conn: &mut PgConnection,
    id: Uuid,
    course_id: Uuid,
    term: &str,
    definition: &str,
) -> ModelResult<GlossaryTerm> {
    let res = sqlx::query_as!(
        GlossaryTerm,
        "
UPDATE glossary
SET term = $1,
  definition = $2
WHERE id = $3
  AND course_id = $4
  AND deleted_at IS NULL
RETURNING *
        ",
        term,
        definition,
        id,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE glossary
SET deleted_at = now()
WHERE id = $1
AND deleted_at IS NULL
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete_term_by_id_and_course_id(
    conn: &mut PgConnection,
    id: Uuid,
    course_id: Uuid,
) -> ModelResult<GlossaryTerm> {
    let res = sqlx::query_as!(
        GlossaryTerm,
        "
UPDATE glossary
SET deleted_at = now()
WHERE id = $1
  AND course_id = $2
  AND deleted_at IS NULL
RETURNING *
        ",
        id,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn fetch_for_course(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<Vec<Term>> {
    let res = sqlx::query_as!(
        Term,
        "
SELECT glossary.id,
  glossary.term,
  glossary.definition
FROM glossary
WHERE glossary.course_id = $1
AND deleted_at IS NULL
",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
