//! Publishing a changeset to the live course.

use std::borrow::Cow;
use std::collections::{HashMap, HashSet};

use futures::future::BoxFuture;
use headless_lms_utils::document_schema_processor::walk;
use url::Url;
use utoipa::ToSchema;

use crate::{
    SpecFetcher, agent_changeset_calls,
    agent_changeset_entities::{self, AgentChangesetEntity, ChangesetEntitySummary},
    agent_changesets::{self, AgentChangeset, AgentChangesetStatus},
    courses::{Course, TextEmbeddings},
    entity_history::{self, HistoryAuthor},
    error::missing_model_error,
    exercise_service_info::ExerciseServiceInfoApi,
    feedback,
    library::{
        agent_changesets::{
            conflicts::{PublishConflict, conflicts_of},
            course_state::{
                CourseParts, PublishBlocker, copy_course_default_review_config, load_live_course,
            },
            locking::{ChangedSinceReview, LockRejection, lock_open_changeset},
            risk::{ChangesetState, reclassify},
        },
        entity_snapshots::{
            ChapterSnapshot, ContentEntity, ContentEntityType, CourseDefaultReviewConfigSnapshot,
            CourseSettingsSnapshot, EntityKey, EntityRef, EntitySnapshot, GlossaryTermSnapshot,
            ModuleSnapshot, PageSnapshot, ReferenceSnapshot, with_snapshot_type,
        },
    },
    page_language_groups,
    pages::{self, PageBlockReferences},
    peer_or_self_review_configs::CmsPeerOrSelfReviewConfiguration,
    prelude::*,
    proposed_page_edits,
    url_redirections::CreatedRedirect,
};

/// Why a publish was refused. Nothing was written.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "reason", rename_all = "snake_case")]
pub enum PublishRejection {
    /// Live entities changed since they were staged; their staged edits must be redone on the
    /// current live state.
    Conflicts { conflicts: Vec<PublishConflict> },
    /// The changeset holds risky changes, which only the user can publish on the review page.
    NeedsConfirmation {
        risky_entities: Vec<ChangesetEntitySummary>,
    },
    /// Pages would add tasks of exercise services only global admins may add.
    GlobalAdminOnlyExerciseServices { service_names: Vec<String> },
    /// The course with the staged changes would break these rules publishing relies on, which
    /// the live course doesn't.
    Blockers { blockers: Vec<PublishBlocker> },
    /// The staged changes changed after the user opened the review page.
    ChangedSinceReview(ChangedSinceReview),
    /// The changeset was published, discarded or expired before.
    NotOpen { status: AgentChangesetStatus },
    /// A save path refused what was staged for `entity`; `None` when the refusal came only once
    /// every write was in. `message` is the save path's own, in English.
    SaveFailed {
        entity: Option<EntityRef>,
        message: String,
    },
}

impl From<LockRejection> for PublishRejection {
    fn from(rejection: LockRejection) -> Self {
        match rejection {
            LockRejection::NotOpen(status) => Self::NotOpen { status },
            LockRejection::ChangedSinceReview(changed) => Self::ChangedSinceReview(changed),
        }
    }
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

/// How a publish may proceed. The publisher is always the changeset's owner, which the caller
/// checks.
#[derive(Debug, Clone, Copy)]
pub struct PublishOptions {
    /// Whether the publisher may add tasks of exercise services only global admins may add.
    pub can_add_global_admin_only_exercise_services: bool,
    /// The changeset revision the user reviewed on the review page; publishing any other revision
    /// is rejected. Risky entities are published only with a reviewed revision.
    pub reviewed_revision: Option<i32>,
}

/// The order publishing locks the live rows of entity kinds in. Every publish uses it, so two
/// publishes never deadlock on each other.
const LOCK_ORDER: [ContentEntityType; 7] = [
    ContentEntityType::CourseSettings,
    ContentEntityType::Module,
    ContentEntityType::Chapter,
    ContentEntityType::Page,
    ContentEntityType::GlossaryTerm,
    ContentEntityType::Reference,
    ContentEntityType::CourseDefaultReviewConfig,
];

/// Locks the live rows of the staged entities until the transaction ends, so that nothing changes
/// them between the conflict check and the writes.
async fn lock_live_rows(
    conn: &mut PgConnection,
    entities: &[AgentChangesetEntity],
) -> ModelResult<()> {
    for entity_type in LOCK_ORDER {
        let mut ids: Vec<Uuid> = entities
            .iter()
            .filter(|entity| entity.entity_type == entity_type)
            .map(|entity| entity.entity_id)
            .collect();
        ids.sort();
        with_snapshot_type!(entity_type, T => T::lock_rows(conn, &ids).await?);
    }
    Ok(())
}

/// Why publishing stops before writing anything.
struct Refusal {
    rejection: PublishRejection,
    /// Whether the risk reasons classified on the way are stored all the same.
    keeps_reclassification: bool,
}

/// Publishes an open changeset: writes every staged entity in one transaction, through the module
/// and chapter writers, the CMS page save and the course save paths, and marks the changeset
/// published.
///
/// Pages are saved with their exercise ids kept. Every history row written is attributed to the
/// changeset's owner through the latest call that staged the entity. A page whose path changed
/// gets a redirect from its old path.
///
/// Risk is classified again against the live course and student activity of this moment, and the
/// new reasons are stored. Returns [`PublishOutcome::Rejected`] without publishing if the
/// changeset is not open or not at the reviewed revision, if any entity's live state changed since
/// it was staged, if it holds risky entities and no revision was reviewed, if the new
/// classification found risks the reviewed revision didn't show, if pages would add exercise
/// services the publisher may not add, or if a save path refuses what was staged.
pub async fn publish(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    options: PublishOptions,
    app_conf: &ApplicationConfiguration,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<PublishOutcome> {
    let embeddings = embed_staged_settings(conn, changeset_id, app_conf).await?;
    let mut tx = conn.begin().await?;
    let changeset =
        match lock_open_changeset(&mut tx, changeset_id, options.reviewed_revision).await? {
            Ok(changeset) => changeset,
            Err(rejection) => {
                tx.rollback().await?;
                return Ok(PublishOutcome::Rejected {
                    rejection: rejection.into(),
                });
            }
        };
    let course = crate::courses::get_course(&mut tx, changeset.course_id).await?;
    let publishable = match check_publishable(&mut tx, &changeset, &course, options).await? {
        Ok(publishable) => publishable,
        Err(refusal) => {
            if refusal.keeps_reclassification {
                tx.commit().await?;
            } else {
                tx.rollback().await?;
            }
            return Ok(PublishOutcome::Rejected {
                rejection: refusal.rejection,
            });
        }
    };
    let context = PublishContext {
        changeset: &changeset,
        course: &course,
        app_conf,
        embeddings: &embeddings,
        spec_fetcher: &spec_fetcher,
        fetch_service_info: &fetch_service_info,
    };
    let writes = StagedWrites::of(&publishable.entities, &publishable.bases)?;
    let written = write_staged(&mut tx, &context, writes).await;
    let redirects = match written {
        Ok(redirects) => redirects,
        Err(stop) => {
            tx.rollback().await?;
            return stop.into_outcome();
        }
    };
    let changeset = agent_changesets::mark_published(&mut tx, changeset_id).await?;
    // The uniqueness constraints `write_staged` defers are checked only now.
    if let Err(stop) = saved(|| None, tx.commit().await.map_err(ModelError::from)) {
        return stop.into_outcome();
    }
    Ok(PublishOutcome::Published {
        changeset,
        redirects,
    })
}

/// Embeds the texts the changeset's staged course settings add or change; see [`TextEmbeddings`].
async fn embed_staged_settings(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<TextEmbeddings> {
    let keys: Vec<EntityKey> = agent_changesets::get_by_id(conn, changeset_id)
        .await
        .optional()?
        .map(|changeset| EntityKey::new(ContentEntityType::CourseSettings, changeset.course_id))
        .into_iter()
        .collect();
    let entities = agent_changeset_entities::get_by_keys(conn, changeset_id, &keys).await?;
    let bases = agent_changeset_entities::get_bases(conn, changeset_id, &keys).await?;
    let texts = written::<CourseSettingsSnapshot>(&entities, &bases)
        .into_iter()
        .flat_map(|(settings, base)| match base {
            Some(base) => crate::courses::changed_settings_texts(settings, base),
            None => crate::courses::settings_texts(settings),
        })
        .collect();
    TextEmbeddings::create(app_conf, texts).await
}

/// A changeset that may be published: its staged rows and the bases they were staged on.
struct Publishable {
    entities: Vec<AgentChangesetEntity>,
    bases: HashMap<EntityKey, EntitySnapshot>,
}

/// Locks what the changeset writes and checks that it may be published: no conflicts, no risk the
/// publisher hasn't reviewed, no exercise services the publisher may not add. The risk reasons it
/// classifies again are stored, not put in the returned rows.
async fn check_publishable(
    conn: &mut PgConnection,
    changeset: &AgentChangeset,
    course: &Course,
    options: PublishOptions,
) -> ModelResult<Result<Publishable, Refusal>> {
    let entities = agent_changeset_entities::get_by_changeset_id(conn, changeset.id).await?;
    // Writing pages fetches exercise specs from their services under these locks: which tasks
    // need a new spec depends on the tasks the locked pages have.
    lock_live_rows(conn, &entities).await?;
    let keys: Vec<EntityKey> = entities.iter().map(AgentChangesetEntity::key).collect();
    let bases = agent_changeset_entities::get_bases(conn, changeset.id, &keys).await?;

    let conflicts = conflicts_of(conn, &entities, &bases).await?;
    if !conflicts.is_empty() {
        return Ok(Err(Refusal {
            rejection: PublishRejection::Conflicts { conflicts },
            keeps_reclassification: false,
        }));
    }

    let live = load_live_course(conn, course, CourseParts::All).await?;
    let state = ChangesetState::of_rows(Cow::Owned(live), &entities);
    let blockers = state.staged.blockers_added_since(&state.live);
    if !blockers.is_empty() {
        return Ok(Err(Refusal {
            rejection: PublishRejection::Blockers { blockers },
            keeps_reclassification: false,
        }));
    }

    let reclassified = reclassify(conn, changeset.id, &state).await?;
    if reclassified.has_changed_reasons {
        let revision = agent_changesets::increment_revision(conn, changeset.id).await?;
        if options.reviewed_revision.is_some() && reclassified.has_new_reasons {
            return Ok(Err(Refusal {
                rejection: PublishRejection::ChangedSinceReview(ChangedSinceReview { revision }),
                keeps_reclassification: true,
            }));
        }
    }
    if options.reviewed_revision.is_none() {
        let risky_entities: Vec<ChangesetEntitySummary> = entities
            .iter()
            .filter_map(|entity| {
                Some(ChangesetEntitySummary {
                    risk_reasons: reclassified.reasons.get(&entity.key())?.clone(),
                    ..ChangesetEntitySummary::from(entity)
                })
            })
            .collect();
        if !risky_entities.is_empty() {
            return Ok(Err(Refusal {
                rejection: PublishRejection::NeedsConfirmation { risky_entities },
                keeps_reclassification: true,
            }));
        }
    }

    if !options.can_add_global_admin_only_exercise_services {
        let tasks: Vec<_> = entities
            .iter()
            .filter_map(|entity| {
                entity
                    .after_snapshot
                    .as_ref()
                    .and_then(PageSnapshot::narrow)
            })
            .flat_map(|page| page.exercise_tasks.iter())
            .cloned()
            .collect();
        let service_names = pages::get_global_admin_only_exercise_service_names_added_by_tasks(
            conn,
            pages::ExistingTasks::InCourse(changeset.course_id),
            &tasks,
        )
        .await?;
        if !service_names.is_empty() {
            return Ok(Err(Refusal {
                rejection: PublishRejection::GlobalAdminOnlyExerciseServices { service_names },
                keeps_reclassification: false,
            }));
        }
    }
    Ok(Ok(Publishable { entities, bases }))
}

/// The staged entities of a changeset by what publishing does with them.
struct StagedWrites<'a> {
    modules: Vec<&'a ModuleSnapshot>,
    chapters: Vec<&'a ChapterSnapshot>,
    /// With the live page for updates.
    pages: Vec<(&'a PageSnapshot, Option<&'a PageSnapshot>)>,
    /// With the live settings.
    course_settings: Vec<(&'a CourseSettingsSnapshot, &'a CourseSettingsSnapshot)>,
    glossary_terms: Vec<&'a GlossaryTermSnapshot>,
    references: Vec<&'a ReferenceSnapshot>,
    course_default_review_configs: Vec<&'a CourseDefaultReviewConfigSnapshot>,
    deleted: HashMap<ContentEntityType, Vec<&'a AgentChangesetEntity>>,
}

/// The staged snapshots of kind `T`, each with its base.
fn written<'a, T: ContentEntity>(
    entities: &'a [AgentChangesetEntity],
    bases: &'a HashMap<EntityKey, EntitySnapshot>,
) -> Vec<(&'a T, Option<&'a T>)> {
    entities
        .iter()
        .filter_map(|entity| {
            let after = T::narrow(entity.after_snapshot.as_ref()?)?;
            Some((after, bases.get(&entity.key()).and_then(T::narrow)))
        })
        .collect()
}

fn afters<T>(written: Vec<(T, Option<T>)>) -> Vec<T> {
    written.into_iter().map(|(after, _)| after).collect()
}

impl<'a> StagedWrites<'a> {
    fn of(
        entities: &'a [AgentChangesetEntity],
        bases: &'a HashMap<EntityKey, EntitySnapshot>,
    ) -> ModelResult<Self> {
        let mut deleted: HashMap<ContentEntityType, Vec<&AgentChangesetEntity>> = HashMap::new();
        for entity in entities.iter().filter(|e| e.after_snapshot.is_none()) {
            deleted.entry(entity.entity_type).or_default().push(entity);
        }
        let course_settings = written::<CourseSettingsSnapshot>(entities, bases)
            .into_iter()
            .map(|(settings, live)| {
                let live = live.ok_or_else(missing_model_error(
                    ModelErrorType::Generic,
                    "Course settings were staged without their live state",
                ))?;
                Ok((settings, live))
            })
            .collect::<ModelResult<_>>()?;
        Ok(Self {
            modules: afters(written(entities, bases)),
            chapters: afters(written(entities, bases)),
            pages: written(entities, bases),
            course_settings,
            glossary_terms: afters(written(entities, bases)),
            references: afters(written(entities, bases)),
            course_default_review_configs: afters(written(entities, bases)),
            deleted,
        })
    }

    fn deleted(&self, entity_type: ContentEntityType) -> &[&'a AgentChangesetEntity] {
        self.deleted.get(&entity_type).map_or(&[], Vec::as_slice)
    }
}

/// The staged exercises that switch from the course default review config to their own.
fn exercises_switched_to_own_review_config(
    pages: &[(&PageSnapshot, Option<&PageSnapshot>)],
) -> HashSet<Uuid> {
    let used_default: HashSet<Uuid> = pages
        .iter()
        .filter_map(|(_, base)| *base)
        .flat_map(|base| base.exercises.iter())
        .filter(|exercise| exercise.use_course_default_peer_or_self_review_config)
        .map(|exercise| exercise.id)
        .collect();
    pages
        .iter()
        .flat_map(|(page, _)| page.exercises.iter())
        .filter(|exercise| {
            !exercise.use_course_default_peer_or_self_review_config
                && used_default.contains(&exercise.id)
        })
        .map(|exercise| exercise.id)
        .collect()
}

/// The staged page with the exercises in `switched` given a new copy of `course_default`, keeping
/// the config id and review instructions staged: staging copied the default as it was then.
fn with_course_default_copies<'a>(
    page: &'a PageSnapshot,
    switched: &HashSet<Uuid>,
    course_default: Option<&CmsPeerOrSelfReviewConfiguration>,
) -> Cow<'a, PageSnapshot> {
    let Some(course_default) = course_default else {
        return Cow::Borrowed(page);
    };
    if !page
        .exercises
        .iter()
        .any(|exercise| switched.contains(&exercise.id))
    {
        return Cow::Borrowed(page);
    }
    let mut page = page.clone();
    for exercise in page
        .exercises
        .iter_mut()
        .filter(|exercise| switched.contains(&exercise.id))
    {
        if let Some(own) = exercise.peer_or_self_review_config.take() {
            copy_course_default_review_config(
                exercise,
                course_default,
                own.id,
                own.review_instructions,
                Uuid::new_v4,
            );
        }
    }
    Cow::Owned(page)
}

/// Who the history of each published entity is attributed to: the changeset's owner, through the
/// latest call that staged the entity.
struct Authors {
    user_id: Uuid,
    call_ids: HashMap<EntityKey, Uuid>,
}

impl Authors {
    fn of(&self, key: EntityKey) -> ModelResult<HistoryAuthor> {
        let call_id = self.call_ids.get(&key).ok_or_else(missing_model_error(
            ModelErrorType::Generic,
            format!("No call of the changeset staged {key:?}"),
        ))?;
        Ok(HistoryAuthor::agent(self.user_id, *call_id))
    }

    /// Records the published snapshot in the entity's history.
    async fn record_saved<T: ContentEntity>(
        &self,
        conn: &mut PgConnection,
        snapshot: &T,
    ) -> ModelResult<()> {
        let author = self.of(EntityKey::new(T::ENTITY_TYPE, snapshot.id()))?;
        entity_history::record_saved(conn, &[snapshot.clone().into()], author).await
    }
}

/// Why writing the staged entities stopped.
enum WriteStop {
    Refused(PublishRejection),
    Failed(ModelError),
}

impl From<ModelError> for WriteStop {
    fn from(error: ModelError) -> Self {
        Self::Failed(error)
    }
}

impl WriteStop {
    fn into_outcome(self) -> ModelResult<PublishOutcome> {
        match self {
            Self::Refused(rejection) => Ok(PublishOutcome::Rejected { rejection }),
            Self::Failed(error) => Err(error),
        }
    }
}

/// `result` of saving `entity`, with a save path's refusal of what was staged as
/// [`PublishRejection::SaveFailed`].
fn saved<T>(
    entity: impl FnOnce() -> Option<EntityRef>,
    result: ModelResult<T>,
) -> Result<T, WriteStop> {
    result.map_err(|error| match error.error_type() {
        ModelErrorType::PreconditionFailed
        | ModelErrorType::PreconditionFailedWithCMSAnchorBlockId { .. }
        | ModelErrorType::InvalidRequest
        | ModelErrorType::DatabaseConstraint { .. } => {
            WriteStop::Refused(PublishRejection::SaveFailed {
                entity: entity(),
                message: error.message().to_string(),
            })
        }
        _ => WriteStop::Failed(error),
    })
}

fn entity_ref<T: ContentEntity>(snapshot: &T) -> Option<EntityRef> {
    Some(EntityRef {
        entity_type: T::ENTITY_TYPE,
        entity_id: snapshot.id(),
        label: snapshot.label().to_string(),
    })
}

/// What writing a changeset's staged entities uses besides the entities.
struct PublishContext<'a, S, F> {
    changeset: &'a AgentChangeset,
    course: &'a Course,
    app_conf: &'a ApplicationConfiguration,
    /// Made before the publish transaction; see [`TextEmbeddings`].
    embeddings: &'a TextEmbeddings,
    spec_fetcher: &'a S,
    fetch_service_info: &'a F,
}

/// Writes the staged entities in an order where nothing points at what doesn't exist yet, records
/// their history and returns the redirects created from changed page paths.
async fn write_staged<S, F>(
    conn: &mut PgConnection,
    context: &PublishContext<'_, S, F>,
    writes: StagedWrites<'_>,
) -> Result<Vec<CreatedRedirect>, WriteStop>
where
    S: SpecFetcher,
    F: Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
{
    let PublishContext {
        changeset,
        course,
        app_conf,
        embeddings,
        spec_fetcher,
        fetch_service_info,
    } = *context;
    let authors = Authors {
        user_id: changeset.user_id,
        call_ids: agent_changeset_calls::get_latest_by_entity(conn, changeset.id).await?,
    };
    // Staged entities may swap numbers, paths and citation keys, which are unique only once all
    // are written and deleted, and new chapters point at front pages written after them.
    crate::courses::defer_structure_constraints(conn).await?;

    for module in &writes.modules {
        let author = authors.of(EntityKey::new(ContentEntityType::Module, module.id))?;
        saved(
            || entity_ref(*module),
            crate::course_modules::upsert_from_snapshot(conn, module, author.user_id).await,
        )?;
        authors.record_saved(conn, *module).await?;
    }

    for chapter in &writes.chapters {
        saved(
            || entity_ref(*chapter),
            crate::chapters::upsert_from_snapshot(conn, chapter).await,
        )?;
        authors.record_saved(conn, *chapter).await?;
    }

    let switched = exercises_switched_to_own_review_config(&writes.pages);
    let course_default = if switched.is_empty() {
        None
    } else {
        crate::peer_or_self_review_configs::get_course_default_cms_peer_review_configuration(
            conn, course.id,
        )
        .await?
    };
    let mut redirects = Vec::new();
    for (page, live) in &writes.pages {
        let page = &with_course_default_copies(page, &switched, course_default.as_ref());
        let saved_page = pages::upsert_from_snapshot(
            conn,
            course,
            page,
            live.is_none(),
            authors.of(EntityKey::new(ContentEntityType::Page, page.id))?,
            spec_fetcher,
            fetch_service_info,
        )
        .await;
        redirects.extend(saved(|| entity_ref(&**page), saved_page)?);
    }

    for (settings, live) in &writes.course_settings {
        // Agents can't edit can_add_chatbot, and a live change to it is a conflict.
        saved(
            || entity_ref(*settings),
            crate::courses::write_settings(conn, app_conf, settings, live, false, embeddings).await,
        )?;
        authors.record_saved(conn, *settings).await?;
    }
    for term in &writes.glossary_terms {
        saved(
            || entity_ref(*term),
            crate::glossary::upsert_from_snapshot(conn, term).await,
        )?;
    }
    for reference in &writes.references {
        saved(
            || entity_ref(*reference),
            crate::material_references::upsert_from_snapshot(conn, reference).await,
        )?;
    }

    for config in &writes.course_default_review_configs {
        saved(
            || entity_ref(*config),
            crate::peer_or_self_review_configs::set_course_default_review_instructions(
                conn,
                config.id,
                config.course_id,
                config.review_instructions.as_ref(),
            )
            .await,
        )?;
        authors.record_saved(conn, *config).await?;
    }

    move_block_references(conn, changeset.course_id, &writes).await?;
    delete_removed(conn, &writes, &authors).await?;
    // Pairing is checked when staged, but a discard, revert or another editor's publish can give
    // the course its version of the page since.
    for (page, _) in writes.pages.iter().filter(|(_, live)| live.is_none()) {
        let Some(group) = page.joins_page_language_group_id else {
            continue;
        };
        if page_language_groups::course_has_other_page(conn, group, course.id, page.id).await? {
            return Err(WriteStop::Refused(PublishRejection::SaveFailed {
                entity: entity_ref(*page),
                message:
                    "This course already has its version of the page this page was paired with"
                        .to_string(),
            }));
        }
    }
    Ok(redirects)
}

/// Points feedback and edit proposals at the page their blocks moved to.
///
/// A record moves only when none of its blocks is left on its page; it then follows its first
/// block that still exists. Blocks keep their `clientId` when moved, so only pages in the
/// changeset can have gained or lost them.
async fn move_block_references(
    conn: &mut PgConnection,
    course_id: Uuid,
    writes: &StagedWrites<'_>,
) -> ModelResult<()> {
    let mut changed_page_ids: Vec<Uuid> = writes
        .deleted(ContentEntityType::Page)
        .iter()
        .map(|page| page.entity_id)
        .collect();
    let mut page_of_block = HashMap::new();
    for (page, live) in &writes.pages {
        if live.is_some() {
            changed_page_ids.push(page.id);
        }
        walk(&page.content, &mut |block, _| {
            page_of_block.insert(block.client_id, page.id);
        });
    }
    if changed_page_ids.is_empty() {
        return Ok(());
    }
    let moves = |records: &[PageBlockReferences]| {
        let mut ids = Vec::new();
        let mut page_ids = Vec::new();
        for record in records {
            let mut pages = record
                .block_ids
                .iter()
                .filter_map(|id| page_of_block.get(id).copied());
            if pages.clone().any(|page_id| page_id == record.page_id) {
                continue;
            }
            if let Some(page_id) = pages.next() {
                ids.push(record.id);
                page_ids.push(page_id);
            }
        }
        (ids, page_ids)
    };

    let (ids, page_ids) =
        moves(&feedback::get_block_ids_by_page_ids(conn, course_id, &changed_page_ids).await?);
    feedback::set_page_ids(conn, &ids, &page_ids).await?;
    let (ids, page_ids) = moves(
        &proposed_page_edits::get_block_ids_by_page_ids(conn, course_id, &changed_page_ids).await?,
    );
    proposed_page_edits::set_page_ids(conn, &ids, &page_ids).await?;
    Ok(())
}

/// Deletes the entities the changeset removes: chapters with their pages first, then the other
/// pages, then modules, so that nothing still points at what is deleted next.
async fn delete_removed(
    conn: &mut PgConnection,
    writes: &StagedWrites<'_>,
    authors: &Authors,
) -> Result<(), WriteStop> {
    for chapter in writes.deleted(ContentEntityType::Chapter) {
        let author = authors.of(chapter.key())?;
        saved(
            || Some(chapter.entity_ref()),
            crate::chapters::delete_chapter(conn, chapter.entity_id, author).await,
        )?;
    }
    for page in writes.deleted(ContentEntityType::Page) {
        // The pages of deleted chapters are gone already.
        if pages::exists(conn, page.entity_id).await? {
            let author = authors.of(page.key())?;
            saved(
                || Some(page.entity_ref()),
                pages::delete_page_and_exercises(conn, page.entity_id, author).await,
            )?;
        }
    }
    for module in writes.deleted(ContentEntityType::Module) {
        entity_history::record_deleted(
            conn,
            module.entity_type,
            module.entity_id,
            authors.of(module.key())?,
        )
        .await?;
        saved(
            || Some(module.entity_ref()),
            crate::course_modules::delete(conn, module.entity_id).await,
        )?;
    }
    for term in writes.deleted(ContentEntityType::GlossaryTerm) {
        saved(
            || Some(term.entity_ref()),
            crate::glossary::delete(conn, term.entity_id).await,
        )?;
    }
    for reference in writes.deleted(ContentEntityType::Reference) {
        saved(
            || Some(reference.entity_ref()),
            crate::material_references::delete_reference(conn, reference.entity_id).await,
        )?;
    }
    Ok(())
}
