use headless_lms_models::roles::{self, RoleDomain, UserRole};

use crate::programs::seed::seed_helpers::seed_connect_to_db;

use super::{seed_organizations::uh_cs::SeedOrganizationUhCsResult, seed_users::SeedUsersResult};

pub async fn seed_roles(
    seed_users_result: &SeedUsersResult,
    uh_cs_organization_result: &SeedOrganizationUhCsResult,
) -> anyhow::Result<()> {
    // roles
    info!("inserting roles");
    let mut conn = seed_connect_to_db().await?;
    roles::insert(
        &mut conn,
        seed_users_result.admin_user_id,
        UserRole::Admin,
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
