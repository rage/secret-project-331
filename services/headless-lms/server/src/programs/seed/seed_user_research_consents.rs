use headless_lms_models::{user_research_consents, PKeyPolicy};
use sqlx::{Pool, Postgres};

use super::seed_users::SeedUsersResult;

pub async fn seed_user_research_consents(
    db_pool: Pool<Postgres>,
    seed_users_result: SeedUsersResult,
) -> anyhow::Result<()> {
    info!("inserting research consents for users");
    let mut conn = db_pool.acquire().await?;

    let SeedUsersResult {
        admin_user_id,
        teacher_user_id,
        language_teacher_user_id,
        assistant_user_id,
        course_or_exam_creator_user_id,
        example_normal_user_ids,
        teaching_and_learning_services_user_id,
        student_without_research_consent: _,
        material_viewer_user_id,
        user_user_id,
        student_1_user_id,
        student_2_user_id,
        student_3_user_id,
        student_4_user_id,
        student_5_user_id,
        student_6_user_id,
        langs_user_id,
    } = seed_users_result;

    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, admin_user_id, true).await?;
    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, teacher_user_id, true).await?;
    user_research_consents::upsert(
        &mut conn,
        PKeyPolicy::Generate,
        language_teacher_user_id,
        true,
    )
    .await?;
    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, assistant_user_id, true)
        .await?;
    user_research_consents::upsert(
        &mut conn,
        PKeyPolicy::Generate,
        course_or_exam_creator_user_id,
        true,
    )
    .await?;
    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, user_user_id, true).await?;
    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, student_1_user_id, true)
        .await?;
    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, student_2_user_id, true)
        .await?;
    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, student_3_user_id, true)
        .await?;
    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, student_4_user_id, true)
        .await?;
    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, student_5_user_id, true)
        .await?;
    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, student_6_user_id, true)
        .await?;
    user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, langs_user_id, true).await?;

    user_research_consents::upsert(
        &mut conn,
        PKeyPolicy::Generate,
        teaching_and_learning_services_user_id,
        true,
    )
    .await?;
    user_research_consents::upsert(
        &mut conn,
        PKeyPolicy::Generate,
        material_viewer_user_id,
        true,
    )
    .await?;

    for user_id in example_normal_user_ids {
        user_research_consents::upsert(&mut conn, PKeyPolicy::Generate, user_id, true).await?;
    }

    Ok(())
}
