use std::collections::HashMap;

use super::{
    ChapterSnapshot, ContentEntityType, CourseDefaultReviewConfigSnapshot, CourseSettingsSnapshot,
    EntityKey, EntitySnapshot, GlossaryTermSnapshot, ModuleSnapshot, PageSnapshot,
    ReferenceSnapshot, course_settings_of, load_pages,
};
use crate::{course_modules, prelude::*};

/// What models know about one kind of content entity, implemented by its snapshot type, so that
/// code over every kind dispatches on [`ContentEntityType`] once.
pub(crate) trait ContentEntity: Clone + PartialEq + Into<EntitySnapshot> {
    const ENTITY_TYPE: ContentEntityType;

    /// The entity's id; the course id for course settings.
    fn id(&self) -> Uuid;

    fn course_id(&self) -> Uuid;

    /// See [`EntityRef::label`](super::EntityRef::label).
    fn label(&self) -> &str;

    /// The chapter or module the entity is placed in; `None` for entities of the course itself.
    fn parent(&self) -> Option<EntityKey> {
        None
    }

    /// The snapshot, if it is of this kind.
    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self>;

    /// The live entities with the ids, as [`load_live_many`](super::load_live_many) has them, by id.
    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>>;

    /// Locks the entities' rows until the transaction ends. Soft-deleted rows are locked too: a
    /// publish can restore them. `ids` must be sorted, so that concurrent lockers take the rows in
    /// the same order.
    async fn lock_rows(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()>;
}

impl ContentEntity for PageSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::Page;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        &self.title
    }

    fn parent(&self) -> Option<EntityKey> {
        self.chapter_id
            .map(|chapter_id| EntityKey::new(ContentEntityType::Chapter, chapter_id))
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::Page(page) => Some(page),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        load_pages(conn, ids).await
    }

    async fn lock_rows(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM pages WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }
}

impl ContentEntity for ChapterSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::Chapter;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        &self.name
    }

    fn parent(&self) -> Option<EntityKey> {
        Some(EntityKey::new(
            ContentEntityType::Module,
            self.course_module_id,
        ))
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::Chapter(chapter) => Some(chapter),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let chapters = sqlx::query_as!(
            ChapterSnapshot,
            r#"
SELECT id,
  course_id,
  course_module_id,
  name,
  color,
  chapter_number,
  front_page_id,
  opens_at,
  deadline,
  chapter_image_path
FROM chapters
WHERE id = ANY($1)
  AND deleted_at IS NULL
            "#,
            ids
        )
        .fetch_all(conn)
        .await?;
        Ok(chapters.into_iter().map(|c| (c.id, c)).collect())
    }

    async fn lock_rows(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM chapters WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }
}

impl ContentEntity for ModuleSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::Module;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        self.name.as_deref().unwrap_or_default()
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::Module(module) => Some(module),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        Ok(course_modules::get_by_ids(conn, ids)
            .await?
            .into_iter()
            .map(|module| (module.id, module.into()))
            .collect())
    }

    async fn lock_rows(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM course_modules WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }
}

impl ContentEntity for CourseSettingsSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::CourseSettings;

    fn id(&self) -> Uuid {
        self.course_id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        &self.name
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::CourseSettings(settings) => Some(settings),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        let mut settings = HashMap::with_capacity(ids.len());
        for course in crate::courses::get_by_ids(conn, ids).await? {
            settings.insert(course.id, course_settings_of(conn, &course).await?);
        }
        Ok(settings)
    }

    async fn lock_rows(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM courses WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }
}

impl ContentEntity for GlossaryTermSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::GlossaryTerm;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        &self.term
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::GlossaryTerm(term) => Some(term),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let terms = sqlx::query_as!(
            GlossaryTermSnapshot,
            r#"
SELECT id,
  course_id,
  term,
  definition
FROM glossary
WHERE id = ANY($1)
  AND deleted_at IS NULL
            "#,
            ids
        )
        .fetch_all(conn)
        .await?;
        Ok(terms.into_iter().map(|t| (t.id, t)).collect())
    }

    async fn lock_rows(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM glossary WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }
}

impl ContentEntity for ReferenceSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::Reference;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        &self.citation_key
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::Reference(reference) => Some(reference),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let references = sqlx::query_as!(
            ReferenceSnapshot,
            r#"
SELECT id,
  course_id,
  citation_key,
  reference
FROM material_references
WHERE id = ANY($1)
  AND deleted_at IS NULL
            "#,
            ids
        )
        .fetch_all(conn)
        .await?;
        Ok(references.into_iter().map(|r| (r.id, r)).collect())
    }

    async fn lock_rows(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM material_references WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }
}

impl ContentEntity for CourseDefaultReviewConfigSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::CourseDefaultReviewConfig;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        ""
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::CourseDefaultReviewConfig(config) => Some(config),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let configs = sqlx::query_as!(
            CourseDefaultReviewConfigSnapshot,
            r#"
SELECT id,
  course_id,
  review_instructions
FROM peer_or_self_review_configs
WHERE id = ANY($1)
  AND exercise_id IS NULL
  AND deleted_at IS NULL
            "#,
            ids
        )
        .fetch_all(conn)
        .await?;
        Ok(configs.into_iter().map(|c| (c.id, c)).collect())
    }

    async fn lock_rows(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM peer_or_self_review_configs WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }
}
