use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use sqlx::PgConnection;
use uuid::Uuid;

use headless_lms_models::{
    PKeyPolicy,
    chapters::{self, NewChapter},
    library,
};
use headless_lms_utils::document_schema_processor::GutenbergBlock;

use crate::programs::seed::{
    builder::{context::SeedContext, page::PageBuilder},
    seed_helpers::get_seed_spec_fetcher,
};

/// Builder for course chapters with pages, opening times, and deadlines.
#[derive(Debug, Clone)]
pub struct ChapterBuilder {
    pub number: i32,
    pub name: String,
    pub opens_at: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub pages: Vec<PageBuilder>,
    pub chapter_id: Option<Uuid>,
    pub front_page_id: Option<Uuid>,
    pub front_page_content: Option<Vec<GutenbergBlock>>,
}

impl ChapterBuilder {
    pub fn new(number: i32, name: impl Into<String>) -> Self {
        Self {
            number,
            name: name.into(),
            opens_at: None,
            deadline: None,
            pages: vec![],
            chapter_id: None,
            front_page_id: None,
            front_page_content: None,
        }
    }
    pub fn opens(mut self, t: DateTime<Utc>) -> Self {
        self.opens_at = Some(t);
        self
    }
    pub fn deadline(mut self, t: DateTime<Utc>) -> Self {
        self.deadline = Some(t);
        self
    }
    pub fn chapter_id(mut self, ch_id: Uuid) -> Self {
        self.chapter_id = Some(ch_id);
        self
    }
    pub fn front_page_id(mut self, front_id: Uuid) -> Self {
        self.front_page_id = Some(front_id);
        self
    }
    pub fn fixed_ids(mut self, chapter_id: Uuid, front_page_id: Uuid) -> Self {
        self.chapter_id = Some(chapter_id);
        self.front_page_id = Some(front_page_id);
        self
    }
    pub fn page(mut self, p: PageBuilder) -> Self {
        self.pages.push(p);
        self
    }
    pub fn pages<I: IntoIterator<Item = PageBuilder>>(mut self, it: I) -> Self {
        self.pages.extend(it);
        self
    }

    /// Set custom content for the chapter front page. If not set, default content will be used.
    pub fn front_page_content(mut self, content: Vec<GutenbergBlock>) -> Self {
        self.front_page_content = Some(content);
        self
    }

    pub(crate) async fn seed(
        self,
        conn: &mut PgConnection,
        cx: &SeedContext,
        course_id: Uuid,
        module_id: Uuid,
    ) -> Result<()> {
        if (self.chapter_id.is_some()) ^ (self.front_page_id.is_some()) {
            bail!("ChapterBuilder: chapter_id and front_page_id must both be set or neither.");
        }

        let new_chapter = NewChapter {
            chapter_number: self.number,
            course_id,
            front_page_id: self.front_page_id,
            name: self.name,
            color: None,
            opens_at: self.opens_at,
            deadline: self.deadline,
            course_module_id: Some(module_id),
        };

        let spec = get_seed_spec_fetcher();

        let (chapter, _front) = match (self.chapter_id, self.front_page_id) {
            (Some(ch_id), Some(fp_id)) => {
                library::content_management::create_new_chapter_with_content(
                    conn,
                    PKeyPolicy::Fixed((ch_id, fp_id)),
                    &new_chapter,
                    cx.teacher,
                    spec,
                    crate::domain::models_requests::fetch_service_info,
                    self.front_page_content,
                )
                .await
                .context("creating chapter with fixed IDs")?
            }
            _ => library::content_management::create_new_chapter_with_content(
                conn,
                PKeyPolicy::Generate,
                &new_chapter,
                cx.teacher,
                spec,
                crate::domain::models_requests::fetch_service_info,
                self.front_page_content,
            )
            .await
            .context("creating chapter with generated IDs")?,
        };

        if let Some(opens_at) = self.opens_at {
            chapters::set_opens_at(conn, chapter.id, opens_at)
                .await
                .context("setting chapter opens_at")?;
        }

        for p in self.pages {
            p.seed(conn, &cx, course_id, chapter.id).await?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn chapter_builder_new() {
        let chapter = ChapterBuilder::new(1, "Test Chapter");

        assert_eq!(chapter.number, 1);
        assert_eq!(chapter.name, "Test Chapter");
        assert!(chapter.opens_at.is_none());
        assert!(chapter.deadline.is_none());
        assert!(chapter.pages.is_empty());
        assert!(chapter.chapter_id.is_none());
        assert!(chapter.front_page_id.is_none());
    }

    #[test]
    fn chapter_builder_opens() {
        let now = Utc.with_ymd_and_hms(2024, 1, 1, 12, 0, 0).unwrap();
        let chapter = ChapterBuilder::new(1, "Test Chapter").opens(now);

        assert_eq!(chapter.opens_at, Some(now));
    }

    #[test]
    fn chapter_builder_deadline() {
        let deadline = Utc.with_ymd_and_hms(2024, 12, 31, 23, 59, 59).unwrap();
        let chapter = ChapterBuilder::new(1, "Test Chapter").deadline(deadline);

        assert_eq!(chapter.deadline, Some(deadline));
    }

    #[test]
    fn chapter_builder_chapter_id() {
        let chapter_id = Uuid::new_v4();
        let chapter = ChapterBuilder::new(1, "Test Chapter").chapter_id(chapter_id);

        assert_eq!(chapter.chapter_id, Some(chapter_id));
        assert!(chapter.front_page_id.is_none());
    }

    #[test]
    fn chapter_builder_front_page_id() {
        let front_page_id = Uuid::new_v4();
        let chapter = ChapterBuilder::new(1, "Test Chapter").front_page_id(front_page_id);

        assert_eq!(chapter.front_page_id, Some(front_page_id));
        assert!(chapter.chapter_id.is_none());
    }

    #[test]
    fn chapter_builder_page() {
        let page = PageBuilder::new("/test", "Test Page");
        let chapter = ChapterBuilder::new(1, "Test Chapter").page(page);

        assert_eq!(chapter.pages.len(), 1);
        assert_eq!(chapter.pages[0].url, "/test");
        assert_eq!(chapter.pages[0].title, "Test Page");
    }

    #[test]
    fn chapter_builder_multiple_pages() {
        let page1 = PageBuilder::new("/page1", "Page 1");
        let page2 = PageBuilder::new("/page2", "Page 2");
        let chapter = ChapterBuilder::new(1, "Test Chapter")
            .page(page1)
            .page(page2);

        assert_eq!(chapter.pages.len(), 2);
        assert_eq!(chapter.pages[0].url, "/page1");
        assert_eq!(chapter.pages[1].url, "/page2");
    }

    #[test]
    fn chapter_builder_fluent_interface() {
        let now = Utc.with_ymd_and_hms(2024, 1, 1, 12, 0, 0).unwrap();
        let deadline = Utc.with_ymd_and_hms(2024, 12, 31, 23, 59, 59).unwrap();
        let chapter_id = Uuid::new_v4();
        let front_page_id = Uuid::new_v4();

        let page = PageBuilder::new("/intro", "Introduction");

        let chapter = ChapterBuilder::new(1, "Advanced Chapter")
            .opens(now)
            .deadline(deadline)
            .chapter_id(chapter_id)
            .front_page_id(front_page_id)
            .page(page);

        assert_eq!(chapter.number, 1);
        assert_eq!(chapter.name, "Advanced Chapter");
        assert_eq!(chapter.opens_at, Some(now));
        assert_eq!(chapter.deadline, Some(deadline));
        assert_eq!(chapter.chapter_id, Some(chapter_id));
        assert_eq!(chapter.front_page_id, Some(front_page_id));
        assert_eq!(chapter.pages.len(), 1);
        assert_eq!(chapter.pages[0].url, "/intro");
        assert_eq!(chapter.pages[0].title, "Introduction");
    }

    #[test]
    fn chapter_builder_string_conversion() {
        let chapter1 = ChapterBuilder::new(1, "String literal");
        let chapter2 = ChapterBuilder::new(2, String::from("Owned string"));

        assert_eq!(chapter1.name, "String literal");
        assert_eq!(chapter2.name, "Owned string");
    }

    #[test]
    fn chapter_builder_front_page_content() {
        let custom_content = vec![
            GutenbergBlock::hero_section("Custom Chapter", "Custom description"),
            GutenbergBlock::empty_block_from_name("moocfi/pages-in-chapter".to_string()),
        ];

        let chapter =
            ChapterBuilder::new(1, "Test Chapter").front_page_content(custom_content.clone());

        assert_eq!(chapter.front_page_content, Some(custom_content));
    }

    #[test]
    fn chapter_builder_front_page_content_default() {
        let chapter = ChapterBuilder::new(1, "Test Chapter");

        assert_eq!(chapter.front_page_content, None);
    }
}
