use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseCustomPrivacyPolicyCheckboxText {
    pub id: Uuid,
    pub course_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub text_html: String,
    pub text_slug: String,
}

pub async fn get_all_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseCustomPrivacyPolicyCheckboxText>> {
    let texts = sqlx::query_as!(
        CourseCustomPrivacyPolicyCheckboxText,
        r#"
SELECT *
FROM course_custom_privacy_policy_checkbox_texts
WHERE course_id = $1
  AND deleted_at IS NULL;
        "#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(texts)
}
