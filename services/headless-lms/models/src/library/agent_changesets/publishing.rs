use std::collections::HashMap;

use futures::future::BoxFuture;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use url::Url;
use utoipa::ToSchema;

use crate::{
    SpecFetcher, agent_changeset_calls,
    agent_changeset_entities::{
        self, AgentChangesetEntity, AgentChangesetEntityOperation, AgentChangesetEntityType,
        RiskReason,
    },
    agent_changesets::{self, AgentAttribution, AgentChangeset},
    chapter_history, course_module_history, course_settings_history,
    exercise_service_info::ExerciseServiceInfoApi,
    feedback,
    library::{
        entity_history::{self, EntityHistoryChangeReason},
        entity_snapshots::{self, EntitySnapshot},
    },
    page_history::HistoryChangeReason,
    pages::{self, CoursePageRow, PageUpdateArgs},
    prelude::*,
    proposed_page_edits,
};

/// A staged entity whose live state changed after it was staged.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PublishConflict {
    pub entity_type: AgentChangesetEntityType,
    pub entity_id: Uuid,
    pub label: String,
    /// When the live entity was last changed, if its history knows.
    pub last_changed_at: Option<DateTime<Utc>>,
    pub last_changed_by_user_id: Option<Uuid>,
    /// The agent client of the last change; `None` for the web UI or when unknown.
    pub last_changed_via_client: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct RiskyEntity {
    pub entity_type: AgentChangesetEntityType,
    pub entity_id: Uuid,
    pub label: String,
    pub risk_reasons: Vec<RiskReason>,
}

/// Why a publish was refused. Nothing was written.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "reason", rename_all = "snake_case")]
pub enum PublishRejection {
    /// Live entities changed since they were staged; the agent must restage them.
    Conflicts { conflicts: Vec<PublishConflict> },
    /// The changeset holds risky changes, which only the user can publish on the review page.
    NeedsConfirmation { risky_entities: Vec<RiskyEntity> },
    /// Pages would add tasks of exercise services only global admins may add.
    GlobalAdminOnlyExerciseServices { service_names: Vec<String> },
}

/// A redirect publishing created from a page's old path.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct CreatedRedirect {
    pub page_id: Uuid,
    pub old_url_path: String,
    pub new_url_path: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum PublishOutcome {
    Published {
        changeset: AgentChangeset,
        redirects: Vec<CreatedRedirect>,
    },
    Rejected {
        rejection: PublishRejection,
    },
}

#[derive(Debug, Clone, Copy)]
pub struct PublishOptions {
    /// The user publishing; must be the changeset's owner, checked by the caller.
    pub publisher_user_id: Uuid,
    /// Whether risky entities may be published. True only on the review page.
    pub allow_risky: bool,
    /// Whether the publisher may add tasks of exercise services only global admins may add.
    pub can_add_global_admin_only_exercise_services: bool,
}

/// The changeset's entities whose live state no longer matches the state they were staged on.
pub async fn find_conflicts(
    conn: &mut PgConnection,
    changeset_id: Uuid,
) -> ModelResult<Vec<PublishConflict>> {
    let entities = agent_changeset_entities::get_by_changeset_id(conn, changeset_id).await?;
    conflicts_of(conn, &entities).await
}

async fn conflicts_of(
    conn: &mut PgConnection,
    entities: &[AgentChangesetEntity],
) -> ModelResult<Vec<PublishConflict>> {
    let mut conflicts = Vec::new();
    for entity in entities {
        let base = entity
            .base_snapshot
            .as_ref()
            .map(|value| EntitySnapshot::from_value(entity.entity_type, value))
            .transpose()?;
        let live = entity_snapshots::load_live(conn, entity.entity_type, entity.entity_id).await?;
        if base == live {
            continue;
        }
        let label = live
            .as_ref()
            .or(base.as_ref())
            .map(EntitySnapshot::label)
            .unwrap_or_default();
        let version =
            entity_snapshots::latest_version(conn, entity.entity_type, entity.entity_id).await?;
        conflicts.push(PublishConflict {
            entity_type: entity.entity_type,
            entity_id: entity.entity_id,
            label,
            last_changed_at: version.as_ref().map(|v| v.created_at),
            last_changed_by_user_id: version.as_ref().map(|v| v.author_user_id),
            last_changed_via_client: version.and_then(|v| v.agent_client_name),
        });
    }
    Ok(conflicts)
}

struct ParsedEntity {
    entity_type: AgentChangesetEntityType,
    entity_id: Uuid,
    operation: AgentChangesetEntityOperation,
    base: Option<EntitySnapshot>,
    after: Option<EntitySnapshot>,
}

/// Publishes an open changeset: writes every staged entity through the save paths the web UI
/// uses, in one transaction, and marks the changeset published.
///
/// Pages are saved with their exercise ids kept, and their history rows, like those of chapters,
/// modules and course settings, are attributed to the agent client of the changeset's latest
/// call. A page whose path changed gets a redirect from its old path.
///
/// Returns [`PublishOutcome::Rejected`] without writing anything if any entity's live state
/// changed since it was staged, if risky entities are not allowed, or if pages would add
/// exercise services the publisher may not add. Errors with `PreconditionFailed` if the
/// changeset is not open.
pub async fn publish(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    options: PublishOptions,
    app_conf: &ApplicationConfiguration,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<PublishOutcome> {
    let mut tx = conn.begin().await?;
    let changeset = agent_changesets::get_by_id_for_update(&mut tx, changeset_id).await?;
    if !changeset.is_open() {
        return Err(model_err!(
            PreconditionFailed,
            format!("The changeset is {:?}, not open", changeset.status)
        ));
    }
    let entities = agent_changeset_entities::get_by_changeset_id(&mut tx, changeset_id).await?;

    if !options.allow_risky {
        let risky_entities: Vec<RiskyEntity> = entities
            .iter()
            .filter(|entity| entity.is_risky())
            .map(|entity| RiskyEntity {
                entity_type: entity.entity_type,
                entity_id: entity.entity_id,
                label: entity_label(entity),
                risk_reasons: entity.risk_reasons.clone(),
            })
            .collect();
        if !risky_entities.is_empty() {
            return Ok(PublishOutcome::Rejected {
                rejection: PublishRejection::NeedsConfirmation { risky_entities },
            });
        }
    }

    let conflicts = conflicts_of(&mut tx, &entities).await?;
    if !conflicts.is_empty() {
        return Ok(PublishOutcome::Rejected {
            rejection: PublishRejection::Conflicts { conflicts },
        });
    }

    let parsed = entities
        .iter()
        .map(|entity| {
            Ok(ParsedEntity {
                entity_type: entity.entity_type,
                entity_id: entity.entity_id,
                operation: entity.operation,
                base: entity
                    .base_snapshot
                    .as_ref()
                    .map(|value| EntitySnapshot::from_value(entity.entity_type, value))
                    .transpose()?,
                after: entity
                    .after_snapshot
                    .as_ref()
                    .map(|value| EntitySnapshot::from_value(entity.entity_type, value))
                    .transpose()?,
            })
        })
        .collect::<ModelResult<Vec<_>>>()?;
    for entity in &parsed {
        let course_id = entity
            .after
            .as_ref()
            .or(entity.base.as_ref())
            .map(EntitySnapshot::course_id);
        if course_id != Some(changeset.course_id) {
            return Err(model_err!(
                PreconditionFailed,
                "A staged entity belongs to another course".to_string()
            ));
        }
    }

    if !options.can_add_global_admin_only_exercise_services {
        let mut service_names = Vec::new();
        for entity in &parsed {
            if let Some(EntitySnapshot::Page(page)) = &entity.after {
                let existing_page_id = entity.base.as_ref().map(|_| page.id);
                service_names.extend(
                    pages::get_global_admin_only_exercise_service_names_added_by_tasks(
                        &mut tx,
                        existing_page_id,
                        &page.exercise_tasks,
                    )
                    .await?,
                );
            }
        }
        if !service_names.is_empty() {
            service_names.sort();
            service_names.dedup();
            return Ok(PublishOutcome::Rejected {
                rejection: PublishRejection::GlobalAdminOnlyExerciseServices { service_names },
            });
        }
    }

    let attribution = AgentAttribution {
        client_name: agent_changeset_calls::get_by_changeset_id(&mut tx, changeset_id)
            .await?
            .pop()
            .map(|call| call.client_name)
            .unwrap_or_else(|| "agent".to_string()),
        changeset_id,
    };
    let author = options.publisher_user_id;

    park_changed_unique_fields(&mut tx, &parsed).await?;

    for entity in &parsed {
        if let Some(EntitySnapshot::Module(module)) = &entity.after {
            crate::course_modules::upsert_from_snapshot(&mut tx, module).await?;
            course_module_history::insert(
                &mut tx,
                module,
                EntityHistoryChangeReason::Saved,
                author,
                None,
                Some(&attribution),
            )
            .await?;
        }
    }

    let mut deferred_front_pages = Vec::new();
    for entity in &parsed {
        if let Some(EntitySnapshot::Chapter(chapter)) = &entity.after {
            let mut written = chapter.clone();
            if let Some(front_page_id) = chapter.front_page_id
                && entity_snapshots::load_page(&mut tx, front_page_id)
                    .await?
                    .is_none()
            {
                written.front_page_id = None;
                deferred_front_pages.push((chapter.id, front_page_id));
            }
            crate::chapters::upsert_from_snapshot(&mut tx, &written).await?;
        }
    }

    let mut redirects = Vec::new();
    let mut page_ids = Vec::new();
    let mut page_order_numbers = Vec::new();
    for (index, entity) in parsed.iter().enumerate() {
        let Some(EntitySnapshot::Page(page)) = &entity.after else {
            continue;
        };
        if entity.operation == AgentChangesetEntityOperation::Create {
            pages::insert_or_undelete_course_page_row(
                &mut tx,
                CoursePageRow {
                    id: page.id,
                    course_id: page.course_id,
                    chapter_id: page.chapter_id,
                    url_path: &format!("/agent-publish-parking/{}", page.id),
                    title: &page.title,
                    order_number: 2_000_000 + index as i32,
                    hidden: page.hidden,
                },
            )
            .await?;
        }
        pages::update_page(
            &mut tx,
            PageUpdateArgs {
                page_id: page.id,
                author,
                cms_page_update: page.to_cms_page_update(),
                retain_ids: true,
                history_change_reason: HistoryChangeReason::PageSaved,
                is_exam_page: false,
                agent_attribution: Some(attribution.clone()),
            },
            &spec_fetcher,
            &fetch_service_info,
        )
        .await?;
        page_ids.push(page.id);
        page_order_numbers.push(page.order_number);
        if let Some(EntitySnapshot::Page(base)) = &entity.base {
            let new_url_path = pages::normalize_url_path_for_storage(&page.url_path);
            if base.url_path != new_url_path {
                crate::url_redirections::upsert(
                    &mut tx,
                    PKeyPolicy::Generate,
                    page.id,
                    &base.url_path,
                    page.course_id,
                )
                .await?;
                redirects.push(CreatedRedirect {
                    page_id: page.id,
                    old_url_path: base.url_path.clone(),
                    new_url_path,
                });
            }
        }
    }
    pages::set_order_numbers(&mut tx, &page_ids, &page_order_numbers).await?;

    for (chapter_id, front_page_id) in deferred_front_pages {
        crate::chapters::set_front_page(&mut tx, chapter_id, front_page_id).await?;
    }
    for entity in &parsed {
        if let Some(EntitySnapshot::Chapter(chapter)) = &entity.after {
            chapter_history::insert(
                &mut tx,
                chapter,
                EntityHistoryChangeReason::Saved,
                author,
                None,
                Some(&attribution),
            )
            .await?;
        }
    }

    for entity in &parsed {
        match (&entity.base, &entity.after) {
            (
                Some(EntitySnapshot::CourseSettings(live)),
                Some(EntitySnapshot::CourseSettings(settings)),
            ) => {
                entity_history::write_course_settings(&mut tx, app_conf, settings, live).await?;
                course_settings_history::insert(
                    &mut tx,
                    settings,
                    EntityHistoryChangeReason::Saved,
                    author,
                    None,
                    Some(&attribution),
                )
                .await?;
            }
            (_, Some(EntitySnapshot::GlossaryTerm(term))) => {
                crate::glossary::upsert_from_snapshot(&mut tx, term).await?;
            }
            (_, Some(EntitySnapshot::Reference(reference))) => {
                crate::material_references::upsert_from_snapshot(&mut tx, reference).await?;
            }
            _ => {}
        }
    }

    move_block_references(&mut tx, &parsed).await?;
    delete_removed(&mut tx, &parsed, author, &attribution).await?;

    let changeset = agent_changesets::mark_published(&mut tx, changeset_id, author).await?;
    tx.commit().await?;
    Ok(PublishOutcome::Published {
        changeset,
        redirects,
    })
}

/// Moves page order numbers and paths, chapter numbers and module order numbers that change out of
/// the way of their unique constraints, so that entities can swap them.
async fn park_changed_unique_fields(
    conn: &mut PgConnection,
    parsed: &[ParsedEntity],
) -> ModelResult<()> {
    let mut page_ids = Vec::new();
    let mut chapter_ids = Vec::new();
    let mut module_ids = Vec::new();
    for entity in parsed {
        match (&entity.base, &entity.after) {
            (Some(EntitySnapshot::Page(base)), Some(EntitySnapshot::Page(after)))
                if base.order_number != after.order_number
                    || base.chapter_id != after.chapter_id
                    || base.url_path != pages::normalize_url_path_for_storage(&after.url_path) =>
            {
                page_ids.push(after.id)
            }
            (Some(EntitySnapshot::Chapter(base)), Some(EntitySnapshot::Chapter(after)))
                if base.chapter_number != after.chapter_number =>
            {
                chapter_ids.push(after.id)
            }
            (Some(EntitySnapshot::Module(base)), Some(EntitySnapshot::Module(after)))
                if base.order_number != after.order_number =>
            {
                module_ids.push(after.id)
            }
            _ => {}
        }
    }
    pages::park_order_numbers_and_url_paths(conn, &page_ids).await?;
    crate::chapters::park_chapter_numbers(conn, &chapter_ids).await?;
    crate::course_modules::park_order_numbers(conn, &module_ids).await?;
    Ok(())
}

/// Points feedback and edit proposals at the page their blocks moved to.
///
/// A record moves only when none of its blocks is left on its page; it then follows its first
/// block that still exists. Blocks keep their `clientId` when moved, so only pages in the
/// changeset can have gained or lost them.
async fn move_block_references(
    conn: &mut PgConnection,
    parsed: &[ParsedEntity],
) -> ModelResult<()> {
    let mut changed_page_ids = Vec::new();
    let mut page_of_block = HashMap::new();
    for entity in parsed {
        if entity.entity_type != AgentChangesetEntityType::Page {
            continue;
        }
        if entity.base.is_some() {
            changed_page_ids.push(entity.entity_id);
        }
        if let Some(EntitySnapshot::Page(page)) = &entity.after {
            insert_client_ids(&page.content, page.id, &mut page_of_block);
        }
    }
    if changed_page_ids.is_empty() {
        return Ok(());
    }
    let new_page = |page_id: Uuid, block_ids: &[Uuid]| {
        let mut pages = block_ids
            .iter()
            .filter_map(|id| page_of_block.get(id).copied());
        if pages.clone().any(|block_page_id| block_page_id == page_id) {
            None
        } else {
            pages.next()
        }
    };

    let (mut feedback_ids, mut feedback_page_ids) = (Vec::new(), Vec::new());
    for record in feedback::get_block_ids_by_page_ids(conn, &changed_page_ids).await? {
        if let Some(page_id) = new_page(record.page_id, &record.block_ids) {
            feedback_ids.push(record.id);
            feedback_page_ids.push(page_id);
        }
    }
    feedback::set_page_ids(conn, &feedback_ids, &feedback_page_ids).await?;

    let (mut proposal_ids, mut proposal_page_ids) = (Vec::new(), Vec::new());
    for record in proposed_page_edits::get_block_ids_by_page_ids(conn, &changed_page_ids).await? {
        if let Some(page_id) = new_page(record.page_id, &record.block_ids) {
            proposal_ids.push(record.id);
            proposal_page_ids.push(page_id);
        }
    }
    proposed_page_edits::set_page_ids(conn, &proposal_ids, &proposal_page_ids).await?;
    Ok(())
}

fn insert_client_ids(
    blocks: &[GutenbergBlock],
    page_id: Uuid,
    page_of_block: &mut HashMap<Uuid, Uuid>,
) {
    for block in blocks {
        page_of_block.insert(block.client_id, page_id);
        insert_client_ids(&block.inner_blocks, page_id, page_of_block);
    }
}

/// Deletes the entities the changeset removes: pages first, then chapters, then modules, so that
/// nothing still points at what is deleted next.
async fn delete_removed(
    conn: &mut PgConnection,
    parsed: &[ParsedEntity],
    author: Uuid,
    attribution: &AgentAttribution,
) -> ModelResult<()> {
    let deleted = |entity_type: AgentChangesetEntityType| {
        parsed
            .iter()
            .filter(move |entity| entity.entity_type == entity_type && entity.after.is_none())
    };

    let deleted_chapter_ids: Vec<Uuid> = deleted(AgentChangesetEntityType::Chapter)
        .map(|entity| entity.entity_id)
        .collect();
    crate::chapters::clear_front_pages(conn, &deleted_chapter_ids).await?;
    for entity in deleted(AgentChangesetEntityType::Page) {
        pages::delete_page_and_exercises(conn, entity.entity_id, author, Some(attribution)).await?;
    }
    for entity in deleted(AgentChangesetEntityType::Chapter) {
        if let Some(EntitySnapshot::Chapter(base)) = &entity.base {
            chapter_history::insert(
                conn,
                base,
                EntityHistoryChangeReason::Deleted,
                author,
                None,
                Some(attribution),
            )
            .await?;
        }
        crate::chapters::delete_chapter(conn, entity.entity_id).await?;
    }
    for entity in deleted(AgentChangesetEntityType::Module) {
        if let Some(EntitySnapshot::Module(base)) = &entity.base {
            course_module_history::insert(
                conn,
                base,
                EntityHistoryChangeReason::Deleted,
                author,
                None,
                Some(attribution),
            )
            .await?;
        }
        crate::course_modules::delete(conn, entity.entity_id).await?;
    }
    for entity in deleted(AgentChangesetEntityType::GlossaryTerm) {
        crate::glossary::delete(conn, entity.entity_id).await?;
    }
    for entity in deleted(AgentChangesetEntityType::Reference) {
        crate::material_references::delete_reference(conn, entity.entity_id).await?;
    }
    Ok(())
}

/// The entity's label from its staged snapshot, or from its base for deletes.
pub fn entity_label(entity: &AgentChangesetEntity) -> String {
    entity
        .after_snapshot
        .as_ref()
        .or(entity.base_snapshot.as_ref())
        .and_then(|value| EntitySnapshot::from_value(entity.entity_type, value).ok())
        .map(|snapshot| snapshot.label())
        .unwrap_or_default()
}
