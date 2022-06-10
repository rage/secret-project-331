use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[sqlx(type_name = "grade_scale_id")]
pub enum GradeScaleId {
    #[sqlx(rename = "sis_0_5")]
    SisuZeroFive,
    #[sqlx(rename = "sis_pass_fail")]
    SisuPassFail,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[sqlx(type_name = "grade_local_id")]
pub enum GradeLocalId {
    #[sqlx(rename = "1")]
    One,
    #[sqlx(rename = "2")]
    Two,
    #[sqlx(rename = "3")]
    Three,
    #[sqlx(rename = "4")]
    Four,
    #[sqlx(rename = "5")]
    Five,
}

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct CourseModuleCompletion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub user_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub completion_registration_attempt_date: Option<DateTime<Utc>>,
    pub completion_language: String,
    pub eligible_for_ects: bool,
    pub email: String,
    pub grade_scale_id: GradeScaleId,
    pub grade_local_id: GradeLocalId,
}

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct NewCourseModuleCompletion {
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub user_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub completion_registration_attempt_date: Option<DateTime<Utc>>,
    pub completion_language: String,
    pub eligible_for_ects: bool,
    pub email: String,
    pub grade_scale_id: GradeScaleId,
    pub grade_local_id: GradeLocalId,
}

pub async fn insert(
    conn: &mut PgConnection,
    new_course_module_completion: &NewCourseModuleCompletion,
    test_only_fixed_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_module_completions (
    id,
    course_id,
    course_module_id,
    user_id,
    completion_date,
    completion_registration_attempt_date,
    completion_language,
    eligible_for_ects,
    email,
    grade_scale_id,
    grade_local_id
  )
VALUES (
    COALESCE($1, uuid_generate_v4()),
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11
  )
RETURNING id
        ",
        test_only_fixed_id,
        new_course_module_completion.course_id,
        new_course_module_completion.course_module_id,
        new_course_module_completion.user_id,
        new_course_module_completion.completion_date,
        new_course_module_completion.completion_registration_attempt_date,
        new_course_module_completion.completion_language,
        new_course_module_completion.eligible_for_ects,
        new_course_module_completion.email,
        new_course_module_completion.grade_scale_id as GradeScaleId,
        new_course_module_completion.grade_local_id as GradeLocalId,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<CourseModuleCompletion> {
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_id,
  course_module_id,
  user_id,
  completion_date,
  completion_registration_attempt_date,
  completion_language,
  eligible_for_ects,
  email,
  grade_scale_id AS "grade_scale_id: _",
  grade_local_id AS "grade_local_id: _"
FROM course_module_completions
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "

UPDATE course_module_completions
SET deleted_at = now()
WHERE id = $1
        ",
        id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
pub mod tests {
    use chrono::TimeZone;

    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn type_conversions_work() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module);
        let new_completion = NewCourseModuleCompletion {
            course_id: course,
            course_module_id: course_module,
            user_id: user,
            completion_date: Utc.ymd(2022, 6, 10).and_hms(14, 0, 0),
            completion_registration_attempt_date: None,
            completion_language: "en_US".to_string(),
            eligible_for_ects: true,
            email: "email@example.com".to_string(),
            grade_scale_id: GradeScaleId::SisuZeroFive,
            grade_local_id: GradeLocalId::Four,
        };
        let completion_id = insert(tx.as_mut(), &new_completion, None).await.unwrap();
        let completion = get_by_id(tx.as_mut(), completion_id).await.unwrap();
        assert_eq!(completion.grade_scale_id, GradeScaleId::SisuZeroFive);
        assert_eq!(completion.grade_local_id, GradeLocalId::Four);
    }
}
