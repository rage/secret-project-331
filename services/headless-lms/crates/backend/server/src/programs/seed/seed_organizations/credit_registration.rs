//! An organization of its own for the credit-registration fixtures, so these courses live where
//! nothing else seeds and a dashboard spec has an organization it can assert totals within.

use std::sync::Arc;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{PKeyPolicy, organizations};
use sqlx::{Pool, Postgres};
use tracing::info;
use uuid::Uuid;

use crate::{
    domain::models_requests::JwtKey,
    programs::seed::{
        seed_courses::{CommonCourseData, seed_credit_registration},
        seed_file_storage::SeedFileStorageResult,
        seed_users::SeedUsersResult,
    },
};

pub const CREDIT_REGISTRATION_ORGANIZATION_ID: Uuid =
    Uuid::from_u128(0xc5ed17ea_0000_4a5e_9e6e_c0de00000000);

pub async fn seed_organization_credit_registration(
    db_pool: Pool<Postgres>,
    app_config: &ApplicationConfiguration,
    seed_users_result: SeedUsersResult,
    base_url: String,
    jwt_key: Arc<JwtKey>,
    // Taken so this cannot run before the seed file storage has.
    _seed_file_storage_result: SeedFileStorageResult,
) -> anyhow::Result<Uuid> {
    info!("inserting organization credit-registration");
    let mut conn = db_pool.acquire().await?;
    let organization_id = organizations::insert(
        &mut conn,
        PKeyPolicy::Fixed(CREDIT_REGISTRATION_ORGANIZATION_ID),
        "Credit registration fixtures",
        "credit-registration",
        Some("Courses the credit registration system tests own. Not meant for humans to study."),
        false,
    )
    .await?;
    drop(conn);

    seed_credit_registration(
        app_config,
        CommonCourseData {
            db_pool,
            organization_id,
            teacher_user_id: seed_users_result.teacher_user_id,
            student_user_id: seed_users_result.student_1_user_id,
            langs_user_id: seed_users_result.langs_user_id,
            example_normal_user_ids: Arc::new(seed_users_result.example_normal_user_ids.to_vec()),
            jwt_key,
            base_url,
        },
    )
    .await?;
    Ok(organization_id)
}
