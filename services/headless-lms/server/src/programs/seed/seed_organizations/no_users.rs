use headless_lms_models::{PKeyPolicy, organizations};
use sqlx::{Pool, Postgres};
use tracing::info;
use uuid::Uuid;

pub async fn seed_organization_no_users(db_pool: Pool<Postgres>) -> anyhow::Result<Uuid> {
    info!("Inserting organization: no-users");

    let mut conn = db_pool.acquire().await?;

    let organization_id = organizations::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("dcdde135-f38f-4e8d-94f1-739e77aa0000")?),
        "No Users Organization",
        "no-users-org",
        Some("This is a minimal test organization without any users or content."),
        false,
    )
    .await?;

    Ok(organization_id)
}
