use headless_lms_utils::document_schema_processor::GutenbergBlock;

use crate::{
    page_history::{HistoryChangeReason, PageHistoryContent},
    prelude::*,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct NewCoursePage {
    pub content: Vec<GutenbergBlock>,
    pub course_id: Uuid,
    pub chapter_id: Option<Uuid>,
    pub front_page_of_chapter_id: Option<Uuid>,
    pub order_number: i32,
    pub title: String,
    pub hidden: bool,
    pub url_path: String,
}

impl NewCoursePage {
    /// Creates `NewCoursePage` with provided values that is public by default.
    pub fn new<TTitle: Into<String>, TUrlPath: Into<String>>(
        course_id: Uuid,
        order_number: i32,
        url_path: TUrlPath,
        title: TTitle,
    ) -> Self {
        Self {
            content: Default::default(),
            course_id,
            chapter_id: None,
            front_page_of_chapter_id: None,
            order_number,
            title: title.into(),
            hidden: false,
            url_path: url_path.into(),
        }
    }

    /// Creates a new `NewCoursePage` for the same course as this one and increments the page number.
    pub fn followed_by<TTitle: Into<String>, TUrlPath: Into<String>>(
        &self,
        url_path: TUrlPath,
        title: TTitle,
    ) -> Self {
        Self::new(self.course_id, self.order_number + 1, url_path, title)
    }

    /// Sets the content of this page.
    pub fn set_content(mut self, content: Vec<GutenbergBlock>) -> Self {
        self.content = content;
        self
    }

    /// Sets the chapter this page belongs to.
    pub fn set_chapter_id(mut self, chapter_id: Option<Uuid>) -> Self {
        self.chapter_id = chapter_id;
        self
    }

    /// Marks this page as the front page of the given chapter.
    pub fn set_front_page_of_chapter_id(mut self, chapter_id: Option<Uuid>) -> Self {
        self.front_page_of_chapter_id = chapter_id;
        self
    }

    /// Sets the hidden status of this page.
    pub fn set_hidden(mut self, hidden: bool) -> Self {
        self.hidden = hidden;
        self
    }
}

pub async fn insert_course_page(
    conn: &mut PgConnection,
    new_course_page: &NewCoursePage,
    author: Uuid,
) -> ModelResult<(Uuid, Uuid)> {
    let course = crate::courses::get_course(&mut *conn, new_course_page.course_id).await?;

    if let Some(chapter_id) = new_course_page.chapter_id {
        let chapter = crate::chapters::get_chapter(&mut *conn, chapter_id).await?;
        if chapter.course_id != new_course_page.course_id {
            return Err(model_err!(
                PreconditionFailed,
                "Chapter must belong to the expected course".to_string()
            ));
        }
    }

    if let Some(front_page_of_chapter_id) = new_course_page.front_page_of_chapter_id {
        let chapter = crate::chapters::get_chapter(&mut *conn, front_page_of_chapter_id).await?;
        if chapter.course_id != new_course_page.course_id {
            return Err(model_err!(
                PreconditionFailed,
                "Chapter must belong to the expected course".to_string()
            ));
        }
        if new_course_page.chapter_id.is_none()
            || new_course_page.chapter_id != new_course_page.front_page_of_chapter_id
        {
            return Err(model_err!(
                PreconditionFailed,
                "Page chapter_id must match front_page_of_chapter_id".to_string()
            ));
        }
    }

    let page_language_group_id = crate::page_language_groups::insert(
        &mut *conn,
        crate::PKeyPolicy::Generate,
        course.course_language_group_id,
    )
    .await?;

    let mut tx = conn.begin().await?;
    let page_res: Uuid = sqlx::query_scalar(
        "
INSERT INTO pages (
    course_id,
    chapter_id,
    content,
    url_path,
    title,
    order_number,
    hidden,
    page_language_group_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id
",
    )
    .bind(new_course_page.course_id)
    .bind(new_course_page.chapter_id)
    .bind(serde_json::to_value(new_course_page.content.clone())?)
    .bind(new_course_page.url_path.as_str())
    .bind(new_course_page.title.as_str())
    .bind(new_course_page.order_number)
    .bind(new_course_page.hidden)
    .bind(page_language_group_id)
    .fetch_one(&mut *tx)
    .await?;

    if let Some(front_page_of_chapter_id) = new_course_page.front_page_of_chapter_id {
        crate::chapters::set_front_page(&mut tx, front_page_of_chapter_id, page_res).await?;
    }

    let history_title = new_course_page.title.clone();

    let history_id = crate::page_history::insert(
        &mut tx,
        PKeyPolicy::Generate,
        page_res,
        history_title.as_str(),
        &PageHistoryContent {
            content: serde_json::Value::Array(vec![]),
            exercises: vec![],
            exercise_slides: vec![],
            exercise_tasks: vec![],
            peer_or_self_review_configs: Vec::new(),
            peer_or_self_review_questions: Vec::new(),
        },
        HistoryChangeReason::PageSaved,
        author,
        None,
    )
    .await?;
    tx.commit().await?;
    Ok((page_res, history_id))
}
