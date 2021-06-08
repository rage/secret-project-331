use crate::models::roles::UserRole;
use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Copy)]
pub enum Action {
    View,
    Edit,
    Grade,
    Download,
    Duplicate,
    DeleteAnswer,
}

#[derive(Debug, Clone, Copy)]
pub enum Resource {
    Chapter(Uuid),
    Course(Uuid),
    ExerciseItem(Uuid),
    Exercise(Uuid),
    Grading(Uuid),
    Organization(Uuid),
    Page(Uuid),
    Submission(Uuid),
    Role,
    User,
}

pub async fn authorize(
    pool: &PgPool,
    action: Action,
    user_id: Uuid,
    resource: Resource,
) -> Result<()> {
    let user_roles = crate::models::roles::get_roles(&pool, user_id).await?;

    // check global role
    for role in &user_roles {
        if role.is_global() && has_permission(role.role, action) {
            return Ok(());
        }
    }

    let (course_id, organization_id) = match resource {
        Resource::Chapter(chapter_id) => (
            Some(crate::models::chapters::get_course_id(pool, chapter_id).await?),
            None,
        ),
        Resource::Course(course_id) => (Some(course_id), None),
        Resource::ExerciseItem(id) => (
            Some(crate::models::exercise_items::get_course_id(pool, id).await?),
            None,
        ),
        Resource::Exercise(id) => (
            Some(crate::models::exercises::get_course_id(pool, id).await?),
            None,
        ),
        Resource::Grading(id) => (
            Some(crate::models::gradings::get_course_id(pool, id).await?),
            None,
        ),
        Resource::Organization(id) => (None, Some(id)),
        Resource::Page(id) => (
            Some(crate::models::pages::get_course_id(pool, id).await?),
            None,
        ),
        Resource::Submission(id) => (
            Some(crate::models::submissions::get_course_id(pool, id).await?),
            None,
        ),
        Resource::Role | Resource::User => (None, None),
    };

    // check course role
    if let Some(course_id) = course_id {
        for role in &user_roles {
            if role.is_role_for_course(course_id) && has_permission(role.role, action) {
                return Ok(());
            }
        }
    }

    // check organization role
    // if we didn't get an organization id yet, get one from the course id if we have one
    let organization_id = if let (None, Some(course_id)) = (organization_id, course_id) {
        Some(crate::models::courses::get_organization_id(pool, course_id).await?)
    } else {
        organization_id
    };
    if let Some(organization_id) = organization_id {
        for role in &user_roles {
            if role.is_role_for_organization(organization_id) && has_permission(role.role, action) {
                return Ok(());
            }
        }
    }

    anyhow::bail!("Unauthorized")
}

fn has_permission(user_role: UserRole, action: Action) -> bool {
    use Action::*;
    use UserRole::*;

    match user_role {
        Admin => true,
        Assistant => matches!(action, View | Edit | Grade | DeleteAnswer),
        Teacher => matches!(action, View | Edit | Grade | DeleteAnswer),
        Reviewer => matches!(action, View | Grade),
    }
}
