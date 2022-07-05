use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct OpenUniversityRegistrationLink {
    pub uh_course_code: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub registration_link: String,
}

pub async fn upsert(
    conn: &mut PgConnection,
    uh_course_code: &str,
    registration_link: &str,
) -> ModelResult<OpenUniversityRegistrationLink> {
    let res = sqlx::query_as!(
        OpenUniversityRegistrationLink,
        "
INSERT INTO open_university_registration_links (uh_course_code, registration_link)
VALUES ($1, $2) ON CONFLICT (uh_course_code) DO
UPDATE
SET registration_link = $2,
  deleted_at = NULL
RETURNING *
        ",
        uh_course_code,
        registration_link,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_link_by_course_code(
    conn: &mut PgConnection,
    uh_course_code: &str,
) -> ModelResult<String> {
    let res = sqlx::query!(
        "
SELECT uh_course_code
FROM open_university_registration_links
WHERE uh_course_code = $1
  AND deleted_at IS NULL
        ",
        uh_course_code
    )
    .map(|record| record.uh_course_code)
    .fetch_one(conn)
    .await?;
    Ok(res)
}
