use futures::Stream;

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
    #[sqlx(rename = "0")]
    Zero,
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
    pub passed: bool,
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
  grade_local_id AS "grade_local_id: _",
  passed
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

pub fn stream_by_course_module_id(
    conn: &mut PgConnection,
    course_module_id: Uuid,
) -> impl Stream<Item = sqlx::Result<CourseModuleCompletion>> + '_ {
    sqlx::query_as!(
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
  grade_local_id AS "grade_local_id: _",
  passed
FROM course_module_completions
WHERE course_module_id = $1
  AND deleted_at IS NULL
        "#,
        course_module_id,
    )
    .fetch(conn)
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

    mod passed_evaluation {
        use super::*;

        #[tokio::test]
        async fn sis_0_5_validation() {
            insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module);
            let dataset = vec![
                (GradeLocalId::Zero, false),
                (GradeLocalId::One, true),
                (GradeLocalId::Two, true),
                (GradeLocalId::Three, true),
                (GradeLocalId::Four, true),
                (GradeLocalId::Five, true),
            ];
            for (grade_local_id, expected_to_pass) in dataset {
                let completion = create_new_completion(
                    tx.as_mut(),
                    course,
                    course_module,
                    user,
                    GradeScaleId::SisuZeroFive,
                    grade_local_id,
                )
                .await
                .unwrap();
                assert_eq!(completion.passed, expected_to_pass);
            }
        }

        #[tokio::test]
        async fn sis_pass_fail_validation() {
            insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module);
            let dataset = vec![(GradeLocalId::Zero, false), (GradeLocalId::One, true)];
            for (grade_local_id, expected_to_pass) in dataset {
                let completion = create_new_completion(
                    tx.as_mut(),
                    course,
                    course_module,
                    user,
                    GradeScaleId::SisuPassFail,
                    grade_local_id,
                )
                .await
                .unwrap();
                assert_eq!(completion.passed, expected_to_pass);
            }
        }

        async fn create_new_completion(
            conn: &mut PgConnection,
            course_id: Uuid,
            course_module_id: Uuid,
            user_id: Uuid,
            grade_scale_id: GradeScaleId,
            grade_local_id: GradeLocalId,
        ) -> ModelResult<CourseModuleCompletion> {
            let new_completion = NewCourseModuleCompletion {
                course_id,
                course_module_id,
                user_id,
                completion_date: Utc.ymd(2022, 6, 10).and_hms(14, 0, 0),
                completion_registration_attempt_date: None,
                completion_language: "en_US".to_string(),
                eligible_for_ects: true,
                email: "email@example.com".to_string(),
                grade_scale_id,
                grade_local_id,
            };
            let completion_id = insert(conn, &new_completion, None).await.unwrap();
            let completion = get_by_id(conn, completion_id).await.unwrap();
            Ok(completion)
        }
    }

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
