//! What a change does to an entity, field by field, in the shape the review page and agents read.

use std::collections::HashMap;

use utoipa::ToSchema;

use crate::{
    course_modules::CompletionPolicy,
    courses::CourseAiPolicy,
    library::{
        agent_changesets::course_state::{CourseState, ExerciseRecord, PageRecord},
        entity_snapshots::{
            ChapterSnapshot, ContentEntity, ContentEntityType, CourseDefaultReviewConfigSnapshot,
            CourseSettingsSnapshot, EntityKey, EntityRef, EntitySnapshot, GlossaryTermSnapshot,
            ModuleSnapshot, PageSnapshot, ReferenceSnapshot,
        },
    },
    prelude::*,
};

/// A field of an entity snapshot that a change can set, named as the snapshot names it. Ids and
/// page content are no fields: content is shown rendered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum EntityField {
    Title,
    UrlPath,
    Hidden,
    ChapterId,
    OrderNumber,
    Name,
    Color,
    ChapterNumber,
    CourseModuleId,
    FrontPageId,
    OpensAt,
    Deadline,
    ChapterImagePath,
    CompletionPolicy,
    CertificationEnabled,
    UhCourseCode,
    EctsCredits,
    CompletionRegistrationLinkOverride,
    CompletionsCanBeRegisteredToSisu,
    Description,
    IsDraft,
    IsTestMode,
    IsUnlisted,
    CanAddChatbot,
    IsJoinableByCodeOnly,
    AskMarketingConsent,
    FlaggedAnswersThreshold,
    FlaggedAnswersSkipManualReviewAndAllowRetry,
    ClosedAt,
    ClosedAdditionalMessage,
    ClosedCourseSuccessorId,
    ChapterLockingEnabled,
    AiPolicy,
    CourseMaterialAiInstructions,
    BaseModuleCompletionRequiresNSubmoduleCompletions,
    Audiences,
    Term,
    Definition,
    CitationKey,
    Reference,
    ReviewInstructions,
    /// An exercise's name.
    ExerciseName,
    /// An exercise's own deadline.
    ExerciseDeadline,
    /// One task's instructions.
    TaskInstructions,
    /// Whether an exercise uses the course default review config or its own.
    ReviewConfig,
}

impl EntityField {
    /// Whether the field only places the entity among its siblings or in a parent.
    pub fn is_placement(self) -> bool {
        matches!(
            self,
            Self::ChapterId
                | Self::OrderNumber
                | Self::ChapterNumber
                | Self::CourseModuleId
                | Self::FrontPageId
        )
    }
}

/// A field's value, typed for display.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", content = "value", rename_all = "snake_case")]
pub enum FieldValue {
    Text(String),
    Number(f64),
    Bool(bool),
    DateTime(DateTime<Utc>),
    /// Another entity, labelled as it is or will be called.
    Reference(EntityRef),
    TextList(Vec<String>),
    CompletionPolicy(CompletionPolicy),
    AiPolicy(CourseAiPolicy),
    /// Blocks, as stored.
    Blocks(serde_json::Value),
    ReviewConfig(ReviewConfigKind),
}

/// Which review settings an exercise uses.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReviewConfigKind {
    CourseDefault,
    Own,
}

/// The exercise of a page a field change is in.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ExerciseFieldOwner {
    pub exercise_id: Uuid,
    /// The exercise's name after the change.
    pub exercise_name: String,
    /// The task, for [`EntityField::TaskInstructions`].
    pub task_id: Option<Uuid>,
}

/// One field a change sets to another value.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct FieldChange {
    pub field: EntityField,
    /// The exercise whose field this is; `None` for the entity's own fields.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exercise: Option<ExerciseFieldOwner>,
    /// `None` when the entity or the value didn't exist.
    pub before: Option<FieldValue>,
    /// `None` when the entity or the value doesn't exist after the change.
    pub after: Option<FieldValue>,
}

impl FieldChange {
    /// The entities the values point at, whose labels are left to the caller.
    pub fn references_mut(&mut self) -> impl Iterator<Item = &mut EntityRef> {
        [&mut self.before, &mut self.after]
            .into_iter()
            .filter_map(|value| match value {
                Some(FieldValue::Reference(entity)) => Some(entity),
                _ => None,
            })
    }
}

type Fields = Vec<(EntityField, Option<FieldValue>)>;

fn text(value: &str) -> Option<FieldValue> {
    Some(FieldValue::Text(value.to_string()))
}

fn optional_text(value: &Option<String>) -> Option<FieldValue> {
    value.as_deref().and_then(text)
}

fn flag(value: bool) -> Option<FieldValue> {
    Some(FieldValue::Bool(value))
}

fn number(value: impl Into<f64>) -> Option<FieldValue> {
    Some(FieldValue::Number(value.into()))
}

fn date_time(value: Option<DateTime<Utc>>) -> Option<FieldValue> {
    value.map(FieldValue::DateTime)
}

/// A reference to be labelled; see [`FieldChange::references_mut`].
fn reference(entity_type: ContentEntityType, id: Option<Uuid>) -> Option<FieldValue> {
    id.map(|entity_id| {
        FieldValue::Reference(EntityRef {
            entity_type,
            entity_id,
            label: String::new(),
        })
    })
}

/// The fields of each kind of entity. Each destructures its snapshot, so that a new snapshot field
/// can't go unlisted.
trait HasFields {
    fn fields(&self) -> Fields;
}

impl HasFields for PageRecord {
    fn fields(&self) -> Fields {
        let PageRecord {
            id: _,
            chapter_id,
            url_path,
            title,
            hidden,
            order_number,
            content: _,
            joins_page_language_group_id: _,
        } = self;
        vec![
            (EntityField::Title, text(title)),
            (EntityField::UrlPath, text(url_path)),
            (EntityField::Hidden, flag(*hidden)),
            (
                EntityField::ChapterId,
                reference(ContentEntityType::Chapter, *chapter_id),
            ),
            (EntityField::OrderNumber, number(*order_number)),
        ]
    }
}

impl HasFields for ChapterSnapshot {
    fn fields(&self) -> Fields {
        let ChapterSnapshot {
            id: _,
            course_id: _,
            course_module_id,
            name,
            color,
            chapter_number,
            front_page_id,
            opens_at,
            deadline,
            chapter_image_path,
        } = self;
        vec![
            (EntityField::Name, text(name)),
            (EntityField::Color, optional_text(color)),
            (EntityField::ChapterNumber, number(*chapter_number)),
            (
                EntityField::CourseModuleId,
                reference(ContentEntityType::Module, Some(*course_module_id)),
            ),
            (
                EntityField::FrontPageId,
                reference(ContentEntityType::Page, *front_page_id),
            ),
            (EntityField::OpensAt, date_time(*opens_at)),
            (EntityField::Deadline, date_time(*deadline)),
            (
                EntityField::ChapterImagePath,
                optional_text(chapter_image_path),
            ),
        ]
    }
}

impl HasFields for ModuleSnapshot {
    fn fields(&self) -> Fields {
        let ModuleSnapshot {
            id: _,
            course_id: _,
            name,
            order_number,
            completion_policy,
            certification_enabled,
            uh_course_code,
            ects_credits,
            completion_registration_link_override,
            completions_can_be_registered_to_sisu,
        } = self;
        vec![
            (EntityField::Name, optional_text(name)),
            (EntityField::OrderNumber, number(*order_number)),
            (
                EntityField::CompletionPolicy,
                Some(FieldValue::CompletionPolicy(completion_policy.clone())),
            ),
            (
                EntityField::CertificationEnabled,
                flag(*certification_enabled),
            ),
            (EntityField::UhCourseCode, optional_text(uh_course_code)),
            (EntityField::EctsCredits, ects_credits.and_then(number)),
            (
                EntityField::CompletionRegistrationLinkOverride,
                optional_text(completion_registration_link_override),
            ),
            (
                EntityField::CompletionsCanBeRegisteredToSisu,
                flag(*completions_can_be_registered_to_sisu),
            ),
        ]
    }
}

impl HasFields for CourseSettingsSnapshot {
    fn fields(&self) -> Fields {
        let CourseSettingsSnapshot {
            course_id: _,
            name,
            description,
            is_draft,
            is_test_mode,
            is_unlisted,
            can_add_chatbot,
            is_joinable_by_code_only,
            ask_marketing_consent,
            flagged_answers_threshold,
            flagged_answers_skip_manual_review_and_allow_retry,
            closed_at,
            closed_additional_message,
            closed_course_successor_id,
            chapter_locking_enabled,
            ai_policy,
            course_material_ai_instructions,
            base_module_completion_requires_n_submodule_completions,
            audiences,
        } = self;
        vec![
            (EntityField::Name, text(name)),
            (EntityField::Description, optional_text(description)),
            (EntityField::IsDraft, flag(*is_draft)),
            (EntityField::IsTestMode, flag(*is_test_mode)),
            (EntityField::IsUnlisted, flag(*is_unlisted)),
            (EntityField::CanAddChatbot, flag(*can_add_chatbot)),
            (
                EntityField::IsJoinableByCodeOnly,
                flag(*is_joinable_by_code_only),
            ),
            (
                EntityField::AskMarketingConsent,
                flag(*ask_marketing_consent),
            ),
            (
                EntityField::FlaggedAnswersThreshold,
                flagged_answers_threshold.and_then(number),
            ),
            (
                EntityField::FlaggedAnswersSkipManualReviewAndAllowRetry,
                flag(*flagged_answers_skip_manual_review_and_allow_retry),
            ),
            (EntityField::ClosedAt, date_time(*closed_at)),
            (
                EntityField::ClosedAdditionalMessage,
                optional_text(closed_additional_message),
            ),
            (
                EntityField::ClosedCourseSuccessorId,
                reference(
                    ContentEntityType::CourseSettings,
                    *closed_course_successor_id,
                ),
            ),
            (
                EntityField::ChapterLockingEnabled,
                flag(*chapter_locking_enabled),
            ),
            (
                EntityField::AiPolicy,
                Some(FieldValue::AiPolicy(*ai_policy)),
            ),
            (
                EntityField::CourseMaterialAiInstructions,
                course_material_ai_instructions.and_then(flag),
            ),
            (
                EntityField::BaseModuleCompletionRequiresNSubmoduleCompletions,
                number(*base_module_completion_requires_n_submodule_completions),
            ),
            (
                EntityField::Audiences,
                Some(FieldValue::TextList(
                    audiences.iter().map(|a| a.audience.clone()).collect(),
                )),
            ),
        ]
    }
}

impl HasFields for GlossaryTermSnapshot {
    fn fields(&self) -> Fields {
        let GlossaryTermSnapshot {
            id: _,
            course_id: _,
            term,
            definition,
        } = self;
        vec![
            (EntityField::Term, text(term)),
            (EntityField::Definition, text(definition)),
        ]
    }
}

impl HasFields for ReferenceSnapshot {
    fn fields(&self) -> Fields {
        let ReferenceSnapshot {
            id: _,
            course_id: _,
            citation_key,
            reference,
        } = self;
        vec![
            (EntityField::CitationKey, text(citation_key)),
            (EntityField::Reference, text(reference)),
        ]
    }
}

impl HasFields for CourseDefaultReviewConfigSnapshot {
    fn fields(&self) -> Fields {
        let CourseDefaultReviewConfigSnapshot {
            id: _,
            course_id: _,
            review_instructions,
        } = self;
        vec![(
            EntityField::ReviewInstructions,
            review_instructions.clone().map(FieldValue::Blocks),
        )]
    }
}

impl HasFields for EntitySnapshot {
    fn fields(&self) -> Fields {
        match self {
            EntitySnapshot::Page(page) => PageRecord::from(page).fields(),
            EntitySnapshot::Chapter(chapter) => chapter.fields(),
            EntitySnapshot::Module(module) => module.fields(),
            EntitySnapshot::CourseSettings(settings) => settings.fields(),
            EntitySnapshot::GlossaryTerm(term) => term.fields(),
            EntitySnapshot::Reference(reference) => reference.fields(),
            EntitySnapshot::CourseDefaultReviewConfig(config) => config.fields(),
        }
    }
}

/// The fields that differ between two states of one entity, `None` for a state where it doesn't
/// exist; both must be of the same kind.
fn diff<T: HasFields>(before: Option<&T>, after: Option<&T>) -> Vec<FieldChange> {
    let before = before.map(T::fields);
    let after = after.map(T::fields);
    let fields: Vec<EntityField> = before
        .iter()
        .chain(after.iter())
        .flatten()
        .map(|(field, _)| *field)
        .collect();
    let value = |state: &Option<Fields>, field: EntityField| {
        state
            .iter()
            .flatten()
            .find(|(f, _)| *f == field)
            .and_then(|(_, value)| value.clone())
    };
    let mut changes: Vec<FieldChange> = Vec::new();
    for field in fields {
        let (before, after) = (value(&before, field), value(&after, field));
        if before != after && !changes.iter().any(|change| change.field == field) {
            changes.push(FieldChange {
                field,
                exercise: None,
                before,
                after,
            });
        }
    }
    changes
}

/// What a change does to an entity, field by field, with references left unlabelled; see
/// [`FieldChange::references_mut`]. A page's exercises are compared with `exercises_before`,
/// the exercises before the change by id, wherever they were.
pub fn field_changes(
    before: Option<&EntitySnapshot>,
    after: Option<&EntitySnapshot>,
    exercises_before: &HashMap<Uuid, ExerciseRecord>,
) -> Vec<FieldChange> {
    let mut changes = diff(before, after);
    if let Some(page) = after.and_then(PageSnapshot::narrow) {
        let exercises = ExerciseRecord::of_page(page);
        changes.extend(exercises_field_changes(&exercises, |id| {
            exercises_before.get(&id)
        }));
    }
    changes
}

/// The field changes of `exercises` from their records in `before`; exercises without one there
/// are new, so their fields are left out.
fn exercises_field_changes<'a>(
    exercises: impl IntoIterator<Item = &'a ExerciseRecord>,
    before: impl Fn(Uuid) -> Option<&'a ExerciseRecord>,
) -> Vec<FieldChange> {
    exercises
        .into_iter()
        .filter_map(|after| Some(exercise_field_changes(before(after.id)?, after)))
        .flatten()
        .collect()
}

/// The fields agents edit that differ between two states of one exercise. Review instructions
/// count only where the exercise has its own; the course default's are its own entity's.
pub fn exercise_field_changes(before: &ExerciseRecord, after: &ExerciseRecord) -> Vec<FieldChange> {
    let owner = |task_id: Option<Uuid>| {
        Some(ExerciseFieldOwner {
            exercise_id: after.id,
            exercise_name: after.name.clone(),
            task_id,
        })
    };
    let mut changes = Vec::new();
    if before.name != after.name {
        changes.push(FieldChange {
            field: EntityField::ExerciseName,
            exercise: owner(None),
            before: text(&before.name),
            after: text(&after.name),
        });
    }
    if before.deadline != after.deadline {
        changes.push(FieldChange {
            field: EntityField::ExerciseDeadline,
            exercise: owner(None),
            before: date_time(before.deadline),
            after: date_time(after.deadline),
        });
    }
    for task in &after.tasks {
        if let Some(before_task) = before.tasks.iter().find(|t| t.id == task.id)
            && before_task.assignment != task.assignment
        {
            changes.push(FieldChange {
                field: EntityField::TaskInstructions,
                exercise: owner(Some(task.id)),
                before: Some(FieldValue::Blocks((*before_task.assignment).clone())),
                after: Some(FieldValue::Blocks((*task.assignment).clone())),
            });
        }
    }
    let (before_kind, after_kind) = (
        before.review_config.kind().map(FieldValue::ReviewConfig),
        after.review_config.kind().map(FieldValue::ReviewConfig),
    );
    if before_kind != after_kind {
        changes.push(FieldChange {
            field: EntityField::ReviewConfig,
            exercise: owner(None),
            before: before_kind,
            after: after_kind,
        });
    }
    let (before_instructions, after_instructions) = (
        before
            .review_config
            .own_review_instructions()
            .cloned()
            .map(FieldValue::Blocks),
        after
            .review_config
            .own_review_instructions()
            .cloned()
            .map(FieldValue::Blocks),
    );
    if before_instructions != after_instructions {
        changes.push(FieldChange {
            field: EntityField::ReviewInstructions,
            exercise: owner(None),
            before: before_instructions,
            after: after_instructions,
        });
    }
    changes
}

impl CourseState {
    /// What this state changes of one entity of `before`, field by field, with references
    /// labelled as this state calls them, or `before` does.
    pub fn field_changes_since(&self, before: &CourseState, key: EntityKey) -> Vec<FieldChange> {
        let mut changes = match key.0 {
            ContentEntityType::Page => {
                let mut changes = diff(before.page(key.1), self.page(key.1));
                if let Some(page) = self.page(key.1) {
                    let exercises = page
                        .content
                        .iter()
                        .filter_map(|block| self.exercise(block.exercise_id()?));
                    changes.extend(exercises_field_changes(exercises, |id| before.exercise(id)));
                }
                changes
            }
            _ => diff(
                before.entity_snapshot(key).as_ref(),
                self.entity_snapshot(key).as_ref(),
            ),
        };
        for entity in changes.iter_mut().flat_map(FieldChange::references_mut) {
            entity.label = self
                .entity_label(entity.key())
                .or_else(|| before.entity_label(entity.key()))
                .unwrap_or_default();
        }
        changes
    }
}
