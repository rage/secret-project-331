use headless_lms_models::{
    course_instances::{self, NewCourseInstance},
    courses::{self, NewCourse},
    organizations,
};
use uuid::Uuid;

use sqlx::{Pool, Postgres};

use super::super::seed_users::SeedUsersResult;

pub async fn seed_organization_uh_mathstat(
    db_pool: Pool<Postgres>,
    seed_users_result: SeedUsersResult,
) -> anyhow::Result<Uuid> {
    info!("seeding organization uh-mathstat");

    let SeedUsersResult {
        admin_user_id,
        teacher_user_id: _,
        language_teacher_user_id: _,
        assistant_user_id: _,
        course_or_exam_creator_user_id: _,
        student_user_id: _,
        example_normal_user_ids: _,
    } = seed_users_result;

    let mut conn = db_pool.acquire().await?;

    let uh_mathstat_id = organizations::insert(
        &mut conn,
        "University of Helsinki, Department of Mathematics and Statistics",
        "uh-mathstat",
        "Organization for Mathematics and Statistics courses. This organization creates courses that do require prior experience in mathematics, such as integration and induction.",
        Uuid::parse_str("269d28b2-a517-4572-9955-3ed5cecc69bd")?,
    )
    .await?;
    let new_course = NewCourse {
        name: "Introduction to Statistics".to_string(),
        slug: "introduction-to-statistics".to_string(),
        organization_id: uh_mathstat_id,
        language_code: "en-US".to_string(),
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: "Introduces you to the wonderful world of statistics!".to_string(),
        is_draft: false,
        is_test_mode: false,
    };
    let (statistics_course, _statistics_front_page, _statistics_default_course_instance) =
        courses::insert_course(
            &mut conn,
            Uuid::parse_str("f307d05f-be34-4148-bb0c-21d6f7a35cdb")?,
            Uuid::parse_str("8e4aeba5-1958-49bc-9b40-c9f0f0680911")?,
            new_course,
            admin_user_id,
        )
        .await?;
    let _statistics_course_instance = course_instances::insert(
        &mut conn,
        NewCourseInstance {
            id: Uuid::parse_str("c4a99a18-fd43-491a-9500-4673cb900be0")?,
            course_id: statistics_course.id,
            name: Some("non-default instance"),
            description: Some("this appears to be a non-default instance"),
            support_email: Some("contact@example.com"),
            teacher_in_charge_name: "admin",
            teacher_in_charge_email: "admin@example.com",
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;

    let draft_course = NewCourse {
        name: "Introduction to Drafts".to_string(),
        slug: "introduction-to-drafts".to_string(),
        organization_id: uh_mathstat_id,
        language_code: "en-US".to_string(),
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: "Just a draft.".to_string(),
        is_draft: true,
        is_test_mode: false,
    };
    courses::insert_course(
        &mut conn,
        Uuid::parse_str("963a9caf-1e2d-4560-8c88-9c6d20794da3")?,
        Uuid::parse_str("5cb4b4d6-4599-4f81-ab7e-79b415f8f584")?,
        draft_course,
        admin_user_id,
    )
    .await?;
    Ok(uh_mathstat_id)
}
