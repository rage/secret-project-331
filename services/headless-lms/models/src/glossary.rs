use crate::prelude::*;

#[derive(Debug, Serialize, TS)]
pub struct Term {
    id: Uuid,
    term: String,
    definition: String,
}

#[derive(Debug, Deserialize, TS)]
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

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
DELETE FROM glossary
WHERE id = $1
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
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
",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
