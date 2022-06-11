use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Module {
    pub id: Uuid,
    pub name: String,
    pub order_number: i32,
    pub is_default: bool,
}

pub async fn new(
    conn: &mut PgConnection,
    course_id: Uuid,
    name: &str,
    order_number: i32,
    default: bool,
) -> ModelResult<Module> {
    let res = sqlx::query_as!(
        Module,
        "
INSERT INTO course_modules (course_id, name, order_number, is_default)
VALUES ($1, $2, $3, $4)
RETURNING id,
  name,
  order_number,
  is_default
",
        course_id,
        name,
        order_number,
        default
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    name: Option<&str>,
    order_number: Option<i32>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_modules
SET name = COALESCE($1, name),
  order_number = COALESCE($2, order_number)
WHERE id = $3
",
        name,
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
UPDATE course_modules
SET deleted_at = now()
WHERE id = $1
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn for_course(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<Vec<Module>> {
    let modules = sqlx::query_as!(
        Module,
        "
SELECT id,
  name,
  order_number,
  is_default
FROM course_modules
WHERE course_id = $1
AND deleted_at IS NULL
",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(modules)
}

pub async fn get_default(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<Module> {
    let res = sqlx::query_as!(
        Module,
        "
SELECT id,
  name,
  order_number,
  is_default
FROM course_modules
WHERE course_id = $1
  AND is_default = TRUE
  AND deleted_at IS NULL
",
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
