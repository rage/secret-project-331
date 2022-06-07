use std::collections::HashMap;

use crate::prelude::*;

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    name: Option<&str>,
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
    pub name: Option<String>,
    pub order_number: i32,
}

pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<Module>> {
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

/// Gets course modules for the given course as a map, indexed by the `id` field.
pub async fn get_by_course_id_as_map(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<HashMap<Uuid, Module>> {
    let res = get_by_course_id(conn, course_id)
        .await?
        .into_iter()
        .map(|course_module| (course_module.id, course_module))
        .collect();
    Ok(res)
}
