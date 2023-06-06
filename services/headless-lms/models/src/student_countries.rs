use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct StudentCountry {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_instance_id: Uuid,
    pub country_code: String,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    id: Uuid,
    user_id: Uuid,
    course_id: Uuid,
    course_instance_id: Uuid,
    country_code: &str,
) -> ModelResult<()> {
    sqlx::query!(
        r"
INSERT INTO student_countries (
  id,
  user_id,
  course_id,
  course_instance_id,
  country_code
)
VALUES($1, $2, $3, $4, $5)
      ",
        id,
        user_id,
        course_id,
        course_instance_id,
        country_code,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete_student_country(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE student_countries
SET deleted_at = now()
WHERE id = $1
      "#,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_countries(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<StudentCountry>> {
    let student_countries = sqlx::query_as!(
        StudentCountry,
        "
SELECT *
FROM student_countries
WHERE course_id = $1
AND deleted_at IS NULL;
",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(student_countries)
}
