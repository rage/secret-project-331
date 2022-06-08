use crate::prelude::*;

pub async fn new(
    conn: &mut PgConnection,
    course_id: Uuid,
    name: &str,
    order_number: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_modules (course_id, name, order_number)
VALUES ($1, $2, $3)
RETURNING id
",
        course_id,
        name,
        order_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn rename(conn: &mut PgConnection, id: Uuid, name: &str) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_modules
SET name = $1
WHERE id = $2
",
        name,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn reorder(conn: &mut PgConnection, id: Uuid, order_number: i32) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_modules
SET order_number = $1
WHERE id = $2
",
        order_number,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
DELETE FROM course_modules
WHERE id = $1
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Module {
    pub id: Uuid,
    pub name: String,
    pub order_number: i32,
}

pub async fn for_course(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<Vec<Module>> {
    let modules = sqlx::query_as!(
        Module,
        "
SELECT id,
  name,
  order_number
FROM course_modules
WHERE course_id = $1
",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(modules)
}
