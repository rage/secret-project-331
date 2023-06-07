use headless_lms_models::roles::{self, RoleDomain, UserRole};
use sqlx::{Pool, Postgres};

use super::{seed_organizations::uh_cs::SeedOrganizationUhCsResult, seed_users::SeedUsersResult};

pub async fn seed_roles(
    db_pool: &Pool<Postgres>,
    seed_users_result: &SeedUsersResult,
    uh_cs_organization_result: &SeedOrganizationUhCsResult,
) -> anyhow::Result<()> {
    // roles
    info!("inserting roles");
    let mut conn = db_pool.acquire().await?;
    roles::insert(
        &mut conn,
        seed_users_result.admin_user_id,
        UserRole::Admin,
        RoleDomain::Global,
    )
    .await?;
    roles::insert(
        &mut conn,
        seed_users_result.teaching_and_learning_services_user_id,
        UserRole::TeachingAndLearningServices,
        RoleDomain::Global,
    )
    .await?;
    roles::insert(
        &mut conn,
        seed_users_result.teacher_user_id,
        UserRole::Teacher,
        RoleDomain::Organization(uh_cs_organization_result.uh_cs_organization_id),
    )
    .await?;
    roles::insert(
        &mut conn,
        seed_users_result.assistant_user_id,
        UserRole::Assistant,
        RoleDomain::Organization(uh_cs_organization_result.uh_cs_organization_id),
    )
    .await?;
    roles::insert(
        &mut conn,
        seed_users_result.assistant_user_id,
        UserRole::Assistant,
        RoleDomain::Course(uh_cs_organization_result.cs_intro_course_id),
    )
    .await?;
    Ok(())
}
