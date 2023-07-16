use crate::prelude::Uuid;
use headless_lms_models::{user_research_consents, PKeyPolicy};
use sqlx::{Pool, Postgres};

pub async fn seed_user_research_consents(db_pool: &Pool<Postgres>) -> anyhow::Result<()> {
    info!("inserting research consents for users");
    let mut conn = db_pool.acquire().await?;

    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("02c79854-da22-4cfc-95c4-13038af25d2e")?,
        true,
    )
    .await?;
    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("90643204-7656-4570-bdd9-aad5d297f9ce")?,
        true,
    )
    .await?;
    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("0fd8bd2d-cb4e-4035-b7db-89e798fe4df0")?,
        true,
    )
    .await?;
    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("24342539-f1ba-453e-ae13-14aa418db921")?,
        true,
    )
    .await?;
    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("c9f9f9f9-f9f9-f9f9-f9f9-f9f9f9f9f9f9")?,
        true,
    )
    .await?;
    let _student_user_research_consent = user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("849b8d32-d5f8-4994-9d21-5aa6259585b1")?,
        true,
    )
    .await?;

    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("02364d40-2aac-4763-8a06-2381fd298d79")?,
        true,
    )
    .await?;

    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("d7d6246c-45a8-4ff4-bf4d-31dedfaac159")?,
        true,
    )
    .await?;

    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("6b9b61f2-012a-4dc2-9e35-5da81cd3936b")?,
        true,
    )
    .await?;

    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("5d081ccb-1dab-4367-9549-267fd3f1dd9c")?,
        true,
    )
    .await?;

    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("00e249d8-345f-4eff-aedb-7bdc4c44c1d5")?,
        true,
    )
    .await?;
    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("8d7d6c8c-4c31-48ae-8e20-c68fa95c25cc")?,
        true,
    )
    .await?;
    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("fbeb9286-3dd8-4896-a6b8-3faffa3fabd6")?,
        true,
    )
    .await?;
    user_research_consents::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Uuid::parse_str("3524d694-7fa8-4e73-aa1a-de9a20fd514b")?,
        true,
    )
    .await?;
    Ok(())
}
