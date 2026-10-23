//! A live course with AI agent changesets waiting for review, for the review page, preview, page
//! editor notice and agent grant system tests.

use anyhow::{Context, Result};
use chrono::Utc;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    PKeyPolicy,
    agent_changeset_calls::CallActor,
    agent_changeset_entities::{AgentChangesetEntityType, RiskReason},
    library::{
        agent_changesets::{StageCall, StagedEntity, stage_call},
        entity_snapshots::{self, EntitySnapshot},
    },
    oauth_client::{MetadataDocumentClient, OAuthClient},
    oauth_user_client_scopes::{self, OAuthUserClientScopes},
    pages::{self, PageDetailsUpdate},
    roles::UserRole,
    user_details,
    user_passwords::{hash_password, upsert_user_password},
    users,
};
use secrecy::SecretString;
use serde_json::json;
use sqlx::PgConnection;
use tracing::info;
use uuid::Uuid;

use crate::programs::seed::{
    builder::{
        chapter::ChapterBuilder,
        context::SeedContext,
        course::{CourseBuilder, CourseInstanceConfig},
        exercise::{ExerciseBuilder, ExerciseIds},
        module::ModuleBuilder,
        page::PageBuilder,
    },
    seed_courses::CommonCourseData,
    seed_helpers::{heading, paragraph},
};

/// The client id of the seeded agent: the URL of its client ID metadata document.
const AGENT_CLIENT_ID: &str = "https://agent.example.com/oauth/client-metadata.json";
const AGENT_CLIENT_NAME: &str = "Example Agent";

/// Users whose changesets the system tests act on. Each test mutates its own user's changeset, so
/// they can run in parallel; the local part of the address is the password.
const PUBLISHER_EMAIL: &str = "agent-publisher@example.com";
const DISCARDER_EMAIL: &str = "agent-discarder@example.com";
const CONFLICTED_EMAIL: &str = "agent-conflicted@example.com";
const GRANT_HOLDER_EMAIL: &str = "agent-grant-holder@example.com";

pub async fn seed_agent_changesets_course(
    app_config: ApplicationConfiguration,
    course_id: Uuid,
    course_name: &str,
    course_slug: &str,
    common_course_data: CommonCourseData,
) -> Result<Uuid> {
    let CommonCourseData {
        db_pool,
        organization_id: org,
        teacher_user_id,
        ..
    } = common_course_data;
    let mut conn = db_pool.acquire().await?;
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: course_id,
    };

    info!("Inserting agent changesets course {}", course_name);

    let publisher = insert_user(&mut conn, cx.v5(b"user:publisher"), PUBLISHER_EMAIL).await?;
    let discarder = insert_user(&mut conn, cx.v5(b"user:discarder"), DISCARDER_EMAIL).await?;
    let conflicted = insert_user(&mut conn, cx.v5(b"user:conflicted"), CONFLICTED_EMAIL).await?;
    let grant_holder =
        insert_user(&mut conn, cx.v5(b"user:grant-holder"), GRANT_HOLDER_EMAIL).await?;

    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Sample course with changes an AI agent has staged for review.")
        .course_id(course_id)
        .instance(CourseInstanceConfig {
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"instance:default")),
        })
        .role(publisher, UserRole::Teacher)
        .role(discarder, UserRole::Teacher)
        .role(conflicted, UserRole::Teacher)
        .module(
            ModuleBuilder::new().order(0).chapter(
                ChapterBuilder::new(1, "Getting started")
                    .opens(Utc::now())
                    .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:instance"))
                    .page(
                        PageBuilder::new("/chapter-1/variables", "Variables")
                            .block(heading("Variables", cx.v5(b"variables:heading"), 2))
                            .block(paragraph(
                                "A variable stores a value under a name.",
                                cx.v5(b"variables:paragraph"),
                            )),
                    )
                    .page(
                        PageBuilder::new("/chapter-1/old-notes", "Old notes").block(paragraph(
                            "These notes are no longer needed.",
                            cx.v5(b"old-notes:paragraph"),
                        )),
                    )
                    .page(
                        PageBuilder::new("/chapter-1/loops", "Loops").block(paragraph(
                            "A loop repeats a block of code.",
                            cx.v5(b"loops:paragraph"),
                        )),
                    )
                    .page(
                        PageBuilder::new("/chapter-1/functions", "Functions")
                            .block(paragraph(
                                "A function is a named piece of code.",
                                cx.v5(b"functions:paragraph"),
                            ))
                            .exercise(ExerciseBuilder::example_exercise(
                                "Functions quiz",
                                ExerciseIds {
                                    exercise_id: cx.v5(b"functions:exercise"),
                                    slide_id: cx.v5(b"functions:exercise:slide"),
                                    task_id: cx.v5(b"functions:exercise:task"),
                                    block_id: cx.v5(b"functions:exercise:block"),
                                },
                                vec![paragraph(
                                    "Which keyword defines a function in Python?",
                                    cx.v5(b"functions:exercise:prompt"),
                                )],
                                json!([
                                    {
                                        "name": "def",
                                        "correct": true,
                                        "id": cx.v5(b"functions:exercise:option:1")
                                    },
                                    {
                                        "name": "fun",
                                        "correct": false,
                                        "id": cx.v5(b"functions:exercise:option:2")
                                    }
                                ]),
                                false,
                                None,
                                None,
                            )),
                    )
                    .page(
                        PageBuilder::new("/chapter-1/strings", "Strings").block(paragraph(
                            "A string is a piece of text.",
                            cx.v5(b"strings:paragraph"),
                        )),
                    ),
            ),
        );
    let (course, _default_instance, _last_module) =
        course.seed(&mut conn, &app_config, &cx).await?;

    let agent_client = OAuthClient::upsert_metadata_document_client(
        &mut conn,
        MetadataDocumentClient {
            client_id: AGENT_CLIENT_ID,
            client_name: AGENT_CLIENT_NAME,
            redirect_uris: &["http://127.0.0.1/callback".to_string()],
            client_uri: Some("https://agent.example.com"),
            logo_uri: None,
            scopes: &[
                "material:read".to_string(),
                "material:stage".to_string(),
                "material:publish".to_string(),
                "settings:write".to_string(),
            ],
        },
    )
    .await?;
    let agent_scopes = [
        "material:read".to_string(),
        "material:stage".to_string(),
        "material:publish".to_string(),
    ];
    for user_id in [publisher, discarder, conflicted, grant_holder] {
        OAuthUserClientScopes::insert(&mut conn, user_id, agent_client.id, &agent_scopes).await?;
    }

    let page_ids = PageIds::load(&mut conn, course.id).await?;

    let publisher_actor = agent_actor(&mut conn, publisher, agent_client.id).await?;
    stage_page_edit(
        &mut conn,
        &publisher_actor,
        course.id,
        page_ids.variables,
        "Explain variables with an example",
        |snapshot| {
            snapshot.content.push(paragraph(
                "For example, age = 30 stores the number 30 under the name age.",
                cx.v5(b"variables:staged-example"),
            ));
        },
    )
    .await?;
    stage_call(
        &mut conn,
        StageCall {
            actor: &publisher_actor,
            course_id: course.id,
            tool_name: "patch_course_structure",
            ops: &json!([{ "op": "remove", "path": format!("/pages/{}", page_ids.old_notes) }]),
            summary: Some("Remove the outdated notes page"),
            entities: vec![StagedEntity {
                entity_type: AgentChangesetEntityType::Page,
                entity_id: page_ids.old_notes,
                after: None,
                risk_reasons: vec![RiskReason {
                    code: "visible_page_removed".to_string(),
                    message: format!(
                        "removes page {}, which students can see",
                        page_ids.old_notes
                    ),
                    consequence:
                        "the page disappears for students and its address gets no redirect"
                            .to_string(),
                }],
            }],
            revert_of_call_id: None,
        },
    )
    .await?;

    let discarder_actor = agent_actor(&mut conn, discarder, agent_client.id).await?;
    stage_page_edit(
        &mut conn,
        &discarder_actor,
        course.id,
        page_ids.loops,
        "Mention while loops",
        |snapshot| {
            snapshot.content.push(paragraph(
                "A while loop repeats as long as its condition is true.",
                cx.v5(b"loops:staged-while"),
            ));
        },
    )
    .await?;

    let conflicted_actor = agent_actor(&mut conn, conflicted, agent_client.id).await?;
    stage_page_edit(
        &mut conn,
        &conflicted_actor,
        course.id,
        page_ids.functions,
        "Add a heading and an example to the functions page",
        |snapshot| {
            snapshot.content.insert(
                0,
                heading("Functions", cx.v5(b"functions:staged-heading"), 2),
            );
            snapshot.content.insert(
                2,
                paragraph(
                    "For example, def greet(): defines a function called greet.",
                    cx.v5(b"functions:staged-example"),
                ),
            );
        },
    )
    .await?;
    stage_page_edit(
        &mut conn,
        &conflicted_actor,
        course.id,
        page_ids.strings,
        "Explain string concatenation",
        |snapshot| {
            snapshot.content.push(paragraph(
                "Strings can be joined with the + operator.",
                cx.v5(b"strings:staged-concatenation"),
            ));
        },
    )
    .await?;
    // Someone else edits the page after the agent staged it, so publishing must be refused.
    pages::update_page_details(
        &mut conn,
        page_ids.strings,
        &PageDetailsUpdate {
            title: "Strings and text".to_string(),
            url_path: "/chapter-1/strings".to_string(),
        },
    )
    .await?;

    Ok(course.id)
}

struct PageIds {
    variables: Uuid,
    old_notes: Uuid,
    loops: Uuid,
    functions: Uuid,
    strings: Uuid,
}

impl PageIds {
    async fn load(conn: &mut PgConnection, course_id: Uuid) -> Result<Self> {
        let course_pages = pages::get_pages_by_course_id(conn, course_id).await?;
        let find = |url_path: &str| {
            course_pages
                .iter()
                .find(|page| page.url_path == url_path)
                .map(|page| page.id)
                .with_context(|| format!("seeded page {url_path} not found"))
        };
        Ok(Self {
            variables: find("/chapter-1/variables")?,
            old_notes: find("/chapter-1/old-notes")?,
            loops: find("/chapter-1/loops")?,
            functions: find("/chapter-1/functions")?,
            strings: find("/chapter-1/strings")?,
        })
    }
}

async fn insert_user(conn: &mut PgConnection, user_id: Uuid, email: &str) -> Result<Uuid> {
    let local_part = email
        .split('@')
        .next()
        .expect("split always yields one element");
    let user_id = users::insert(
        conn,
        PKeyPolicy::Fixed(user_id),
        email,
        Some("Agent"),
        Some(local_part),
    )
    .await?;
    user_details::update_user_country(conn, user_id, "fi").await?;
    let hash = hash_password(&SecretString::new(local_part.to_string().into()))
        .map_err(|e| anyhow::anyhow!("failed to hash a seeded password: {e}"))?;
    upsert_user_password(conn, user_id, &hash).await?;
    Ok(user_id)
}

async fn agent_actor(
    conn: &mut PgConnection,
    user_id: Uuid,
    oauth_client_id: Uuid,
) -> Result<CallActor> {
    let grant = oauth_user_client_scopes::get_grants_for_user(conn, user_id)
        .await?
        .into_iter()
        .find(|grant| grant.client_id == oauth_client_id)
        .context("seeded agent grant not found")?;
    Ok(CallActor {
        user_id,
        oauth_client_id: Some(oauth_client_id),
        oauth_grant_id: Some(grant.id),
        client_name: AGENT_CLIENT_NAME.to_string(),
    })
}

/// Stages a routine edit of the live page, as a `patch_page_content` call would.
async fn stage_page_edit(
    conn: &mut PgConnection,
    actor: &CallActor,
    course_id: Uuid,
    page_id: Uuid,
    summary: &str,
    edit: impl FnOnce(&mut entity_snapshots::PageSnapshot),
) -> Result<()> {
    let mut snapshot = entity_snapshots::load_page(conn, page_id)
        .await?
        .context("seeded page not found")?;
    edit(&mut snapshot);
    stage_call(
        conn,
        StageCall {
            actor,
            course_id,
            tool_name: "patch_page_content",
            ops: &json!([{ "op": "add", "path": "/content/-" }]),
            summary: Some(summary),
            entities: vec![StagedEntity {
                entity_type: AgentChangesetEntityType::Page,
                entity_id: page_id,
                after: Some(EntitySnapshot::Page(snapshot).to_value()?),
                risk_reasons: vec![],
            }],
            revert_of_call_id: None,
        },
    )
    .await?;
    Ok(())
}
