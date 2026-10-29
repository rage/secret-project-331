//! A live course with AI agent changesets waiting for review, for the review page, preview, page
//! editor notice and agent grant system tests.

use std::sync::Arc;

use anyhow::{Context, Result};
use chrono::Utc;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    PKeyPolicy,
    agent_changeset_calls::CallActor,
    exercise_slide_submissions::{self, NewExerciseSlideSubmission},
    exercise_task_gradings::UserPointsUpdateStrategy,
    library::{
        agent_changesets::{
            RiskBaseline, StageCall, StagedEntity, StagedStateRead,
            course_state::{ExerciseRecord, ExerciseReviewConfig},
            stage_call,
        },
        entity_snapshots::{self, ContentEntityType, EntityKey, EntitySnapshot},
        oauth::{mcp::McpScope, scopes::metadata_document_client_scopes},
    },
    oauth_client::{MetadataDocumentClient, OAuthClient},
    oauth_user_client_scopes::OAuthUserClientScopes,
    pages::{self, PageDetailsUpdate},
    peer_or_self_review_configs::{self, CmsPeerOrSelfReviewConfig, PeerReviewProcessingStrategy},
    peer_or_self_review_submissions,
};
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
    seed_users::SeedUsersResult,
};

/// The client id of the seeded agent: the URL of its client ID metadata document.
const AGENT_CLIENT_ID: &str = "https://agent.example.com/oauth/client-metadata.json";
const AGENT_CLIENT_NAME: &str = "Example Agent";

/// Seeds the agent changesets course with changesets waiting for review.
pub async fn seed_agent_changesets_course(
    app_config: ApplicationConfiguration,
    course_id: Uuid,
    course_name: &str,
    course_slug: &str,
    common_course_data: CommonCourseData,
    seed_users_result: SeedUsersResult,
) -> Result<Uuid> {
    let CommonCourseData {
        db_pool,
        organization_id: org,
        teacher_user_id,
        student_user_id: student,
        ..
    } = common_course_data;
    let mut conn = db_pool.acquire().await?;
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: course_id,
    };

    info!("Inserting agent changesets course {}", course_name);

    // One open changeset per user and course, so each system test that changes its changeset or
    // grant gets its own user; `utils/agentChangesets.ts` in the system tests names them.
    let publisher = seed_users_result.admin_user_id;
    let conflicted = teacher_user_id;
    let review_settings = seed_users_result.language_teacher_user_id;
    let grant_holder = seed_users_result.course_or_exam_creator_user_id;

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
                        PageBuilder::new("/chapter-1/classes", "Classes")
                            .block(paragraph(
                                "A class describes what objects of one kind have in common.",
                                cx.v5(b"classes:paragraph"),
                            ))
                            .exercise(ExerciseBuilder::example_exercise(
                                "Classes quiz",
                                ExerciseIds {
                                    exercise_id: cx.v5(b"classes:exercise"),
                                    slide_id: cx.v5(b"classes:exercise:slide"),
                                    task_id: cx.v5(b"classes:exercise:task"),
                                    block_id: cx.v5(b"classes:exercise:block"),
                                },
                                vec![paragraph(
                                    "Which keyword defines a class in Python?",
                                    cx.v5(b"classes:exercise:prompt"),
                                )],
                                json!([
                                    {
                                        "name": "class",
                                        "correct": true,
                                        "id": cx.v5(b"classes:exercise:option:1")
                                    },
                                    {
                                        "name": "object",
                                        "correct": false,
                                        "id": cx.v5(b"classes:exercise:option:2")
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
                    )
                    .page(
                        PageBuilder::new("/chapter-1/objects", "Objects")
                            .block(paragraph(
                                "An object is a value made from a class.",
                                cx.v5(b"objects:paragraph"),
                            ))
                            .exercise(peer_reviewed_exercise(&cx, "Objects essay", "objects"))
                            .exercise(peer_reviewed_exercise(&cx, "Methods essay", "methods")),
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
            scopes: &metadata_document_client_scopes(),
        },
    )
    .await?;
    let agent_scopes = [
        McpScope::MaterialRead,
        McpScope::MaterialStage,
        McpScope::MaterialPublish,
    ]
    .map(|scope| scope.as_str().to_string());
    for user_id in [publisher, conflicted, grant_holder, review_settings] {
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
            Arc::make_mut(&mut snapshot.content).push(paragraph(
                "For example, age = 30 stores the number 30 under the name age.",
                cx.v5(b"variables:staged-example"),
            ));
        },
    )
    .await?;
    let old_notes = EntityKey::new(ContentEntityType::Page, page_ids.old_notes);
    let read = StagedStateRead::current(&mut conn, publisher, course.id, &[old_notes]).await?;
    stage_call(
        &mut conn,
        StageCall {
            actor: &publisher_actor,
            course_id: course.id,
            tool_name: "patch_course_structure",
            ops: &json!([{ "op": "remove", "path": format!("/pages/{}", page_ids.old_notes) }]),
            summary: Some("Remove the outdated notes page"),
            entities: vec![StagedEntity::Delete(old_notes)],
            revert_of_call_id: None,
            read: &read,
            risk: &RiskBaseline::Current,
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
            Arc::make_mut(&mut snapshot.content).insert(
                0,
                heading("Functions", cx.v5(b"functions:staged-heading"), 2),
            );
            Arc::make_mut(&mut snapshot.content).insert(
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
            Arc::make_mut(&mut snapshot.content).push(paragraph(
                "Strings can be joined with the + operator.",
                cx.v5(b"strings:staged-concatenation"),
            ));
        },
    )
    .await?;
    stage_page_edit_with_tool(
        &mut conn,
        &conflicted_actor,
        course.id,
        page_ids.classes,
        "patch_exercise",
        &json!([{ "op": "replace", "path": "/exercises/0/name" }]),
        "Clarify the classes exercise",
        |snapshot| {
            snapshot.exercises[0].name = "Classes quiz: keywords".to_string();
            snapshot.exercise_tasks[0].assignment = json!([paragraph(
                "Which Python keyword starts the definition of a class?",
                cx.v5(b"classes:exercise:staged-prompt"),
            )]);
        },
    )
    .await?;

    let course_default = peer_or_self_review_configs::upsert_with_id(
        &mut conn,
        PKeyPolicy::Fixed(cx.v5(b"course-default-review")),
        &CmsPeerOrSelfReviewConfig {
            id: cx.v5(b"course-default-review"),
            course_id: course.id,
            exercise_id: None,
            peer_reviews_to_give: 2,
            peer_reviews_to_receive: 1,
            accepting_threshold: 2.1,
            processing_strategy: PeerReviewProcessingStrategy::AutomaticallyGradeByAverage,
            points_are_all_or_nothing: true,
            reset_answer_if_zero_points_from_review: false,
            review_instructions: Some(json!([paragraph(
                "Read the whole answer before you rate it.",
                cx.v5(b"course-default-review:instructions"),
            )])),
        },
    )
    .await?;
    let methods_exercise_id = cx.v5(b"methods:exercise");
    let submission = exercise_slide_submissions::insert_exercise_slide_submission_with_id(
        &mut conn,
        cx.v5(b"methods:student-submission"),
        &NewExerciseSlideSubmission {
            exercise_slide_id: cx.v5(b"methods:exercise:slide"),
            course_id: Some(course.id),
            exam_id: None,
            exercise_id: methods_exercise_id,
            user_id: student,
            user_points_update_strategy: UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
        },
    )
    .await?;
    peer_or_self_review_submissions::insert(
        &mut conn,
        PKeyPolicy::Fixed(cx.v5(b"methods:student-review")),
        student,
        methods_exercise_id,
        course.id,
        course_default.id,
        submission.id,
    )
    .await?;

    let review_settings_actor = agent_actor(&mut conn, review_settings, agent_client.id).await?;
    stage_course_default_review_instructions(
        &mut conn,
        &review_settings_actor,
        course.id,
        course_default.id,
        json!([paragraph(
            "Read the whole answer before you rate it, and say what was done well.",
            cx.v5(b"course-default-review:staged-instructions"),
        )]),
    )
    .await?;
    let objects = entity_snapshots::load_page(&mut conn, page_ids.objects)
        .await?
        .context("seeded page not found")?;
    let course_default_with_questions =
        peer_or_self_review_configs::get_course_default_cms_peer_review_configuration(
            &mut conn, course.id,
        )
        .await?;
    let mut bundles = objects.exercise_bundles();
    let methods = bundles
        .iter_mut()
        .find(|bundle| bundle.exercise.id == methods_exercise_id)
        .context("seeded methods exercise not found")?;
    let before = ExerciseRecord::of_bundle(objects.id, methods);
    let forked = ExerciseRecord {
        review_config: ExerciseReviewConfig::Own {
            config_id: cx.v5(b"methods:own-review-config"),
            review_instructions: Some(Arc::new(json!([paragraph(
                "Check that the answer calls a method on an object.",
                cx.v5(b"methods:staged-review-instructions"),
            )]))),
        },
        ..before.clone()
    };
    forked
        .apply_to(
            &before,
            methods,
            course_default_with_questions.as_ref(),
            Uuid::new_v4,
        )
        .map_err(|error| anyhow::anyhow!("forking the seeded review config failed: {error:?}"))?;
    stage_page_edit_with_tool(
        &mut conn,
        &review_settings_actor,
        course.id,
        page_ids.objects,
        "patch_exercise",
        &json!([{ "op": "replace", "path": "/review_instructions/0" }]),
        "Give the methods essay its own review instructions",
        |snapshot| snapshot.set_exercise_bundles(&bundles),
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
    functions: Uuid,
    classes: Uuid,
    strings: Uuid,
    objects: Uuid,
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
            functions: find("/chapter-1/functions")?,
            classes: find("/chapter-1/classes")?,
            strings: find("/chapter-1/strings")?,
            objects: find("/chapter-1/objects")?,
        })
    }
}

/// A peer reviewed exercise that uses the course default review config; `key` namespaces its ids.
fn peer_reviewed_exercise(cx: &SeedContext, name: &str, key: &str) -> ExerciseBuilder {
    let id = |part: &str| cx.v5(format!("{key}:exercise{part}").as_bytes());
    ExerciseBuilder::example_exercise(
        name,
        ExerciseIds {
            exercise_id: id(""),
            slide_id: id(":slide"),
            task_id: id(":task"),
            block_id: id(":block"),
        },
        vec![paragraph(
            &format!("Write a short essay for the {name}."),
            id(":prompt"),
        )],
        json!([
            { "name": "Done", "correct": true, "id": id(":option:1") }
        ]),
        true,
        None,
        None,
    )
}

async fn agent_actor(
    conn: &mut PgConnection,
    user_id: Uuid,
    oauth_client_id: Uuid,
) -> Result<CallActor> {
    let grant = OAuthUserClientScopes::find_grant(conn, user_id, oauth_client_id)
        .await?
        .context("seeded agent grant not found")?;
    Ok(CallActor {
        user_id,
        oauth_client_id,
        oauth_grant_id: grant.id,
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
    stage_page_edit_with_tool(
        conn,
        actor,
        course_id,
        page_id,
        "patch_page_content",
        &json!([{ "op": "add", "path": "/content/-" }]),
        summary,
        edit,
    )
    .await
}

/// Stages new course default review instructions, as a `patch_exercise` call with
/// `review_config: edit_course_default` would.
async fn stage_course_default_review_instructions(
    conn: &mut PgConnection,
    actor: &CallActor,
    course_id: Uuid,
    config_id: Uuid,
    review_instructions: serde_json::Value,
) -> Result<()> {
    let key = EntityKey::new(ContentEntityType::CourseDefaultReviewConfig, config_id);
    let Some(Some(EntitySnapshot::CourseDefaultReviewConfig(mut snapshot))) =
        entity_snapshots::load_live_many(conn, &[key])
            .await?
            .remove(&key)
    else {
        anyhow::bail!("seeded course default review config not found");
    };
    snapshot.review_instructions = Some(review_instructions);
    let read = StagedStateRead::current(conn, actor.user_id, course_id, &[key]).await?;
    stage_call(
        conn,
        StageCall {
            actor,
            course_id,
            tool_name: "patch_exercise",
            ops: &json!([{ "op": "replace", "path": "/review_instructions/0" }]),
            summary: Some("Ask reviewers to say what was done well"),
            entities: vec![StagedEntity::Write(snapshot.into())],
            revert_of_call_id: None,
            read: &read,
            risk: &RiskBaseline::Current,
        },
    )
    .await?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn stage_page_edit_with_tool(
    conn: &mut PgConnection,
    actor: &CallActor,
    course_id: Uuid,
    page_id: Uuid,
    tool_name: &str,
    ops: &serde_json::Value,
    summary: &str,
    edit: impl FnOnce(&mut entity_snapshots::PageSnapshot),
) -> Result<()> {
    let mut snapshot = entity_snapshots::load_page(conn, page_id)
        .await?
        .context("seeded page not found")?;
    edit(&mut snapshot);
    let read = StagedStateRead::current(
        conn,
        actor.user_id,
        course_id,
        &[EntityKey::new(ContentEntityType::Page, page_id)],
    )
    .await?;
    stage_call(
        conn,
        StageCall {
            actor,
            course_id,
            tool_name,
            ops,
            summary: Some(summary),
            entities: vec![StagedEntity::Write(EntitySnapshot::Page(snapshot))],
            revert_of_call_id: None,
            read: &read,
            risk: &RiskBaseline::Current,
        },
    )
    .await?;
    Ok(())
}
