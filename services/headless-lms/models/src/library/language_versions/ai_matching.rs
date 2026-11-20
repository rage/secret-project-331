//! Inputs and answers of the AI that suggests counterparts from titles, names and content: what
//! is asked about one chapter of this course and one other course, and how its answer maps back.

use std::collections::{HashMap, HashSet};

use headless_lms_utils::strings::{decode_html_entities, strip_html_tags};

use super::{
    counterpart_index::CounterpartIndex,
    snapshot::LanguageGroupSnapshot,
    suggestions::{CopyLineage, Match, match_exercises, match_pages},
    types::{SuggestionReason, SuggestionSureness},
};
use crate::prelude::*;

/// Excerpt lengths in characters, before [MAX_EXCERPT_CHARS_PER_TASK] shortens them.
const PAGE_EXCERPT_CHARS: usize = 400;
const EXERCISE_EXCERPT_CHARS: usize = 250;
/// Bounds one prompt: a chapter with many exercises gets shorter excerpts.
const MAX_EXCERPT_CHARS_PER_TASK: usize = 30_000;
/// Read from the database per item; the excerpt is cut from this.
const MAX_SOURCE_TEXT_CHARS: i32 = 2_000;

/// A page or exercise the AI is asked to match.
#[derive(Debug, Clone)]
pub struct AiMatchingItem {
    pub id: Uuid,
    /// Page title or exercise name.
    pub title: String,
    /// The page an exercise is on.
    pub page_title: Option<String>,
    /// Plain text from the start of the page or exercise assignment; empty until
    /// [fill_excerpts].
    pub excerpt: String,
    /// The heuristic's pick among the other course's items of the task. Only on this course's
    /// items.
    pub heuristic_pick: Option<(Uuid, SuggestionSureness)>,
}

/// Pages or exercises of the two courses that are fixed already: linked or copies of each other.
#[derive(Debug, Clone)]
pub struct AiKnownPair {
    pub this_title: String,
    pub other_title: String,
}

/// One AI request: the unlinked pages and exercises of one chapter number (or of the pages
/// outside chapters) in this course and in one other course.
#[derive(Debug, Clone)]
pub struct AiMatchingTask {
    pub other_course_id: Uuid,
    pub this_language_code: String,
    pub other_language_code: String,
    pub chapter_number: Option<i32>,
    pub this_chapter_name: Option<String>,
    pub other_chapter_name: Option<String>,
    pub this_pages: Vec<AiMatchingItem>,
    pub other_pages: Vec<AiMatchingItem>,
    pub this_exercises: Vec<AiMatchingItem>,
    pub other_exercises: Vec<AiMatchingItem>,
    pub known_page_pairs: Vec<AiKnownPair>,
    pub known_exercise_pairs: Vec<AiKnownPair>,
}

/// One pick in the AI's answer. Ids are strings so that a mistyped id is caught here rather
/// than failing the whole answer.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AiPick {
    /// Id of this course's item.
    pub item: String,
    /// Id of the other course's item, `None` for no counterpart.
    pub counterpart: Option<String>,
}

/// The AI's answer to one [AiMatchingTask].
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct AiMatchingAnswer {
    pub pages: Vec<AiPick>,
    pub exercises: Vec<AiPick>,
}

/// The AI's picks in one other course by this course's item id: `None` is an explicit "no
/// counterpart". Items without an entry were not answered and keep the heuristic suggestion.
#[derive(Debug, Clone, Default)]
pub struct AiPicks {
    pub pages: HashMap<Uuid, Option<Uuid>>,
    pub exercises: HashMap<Uuid, Option<Uuid>>,
}

/// [AiPicks] by the other course's id.
pub type AiPicksByCourse = HashMap<Uuid, AiPicks>;

/// Picks of an answer that [AiPicks::add_answer] dropped.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct DroppedPicks {
    /// `item` is not an id of this course's items of the task and kind.
    pub unknown_items: usize,
    /// `counterpart` is not an id of the other course's items of the task and kind.
    pub unknown_counterparts: usize,
    /// A second pick of the same item or counterpart.
    pub duplicates: usize,
}

impl DroppedPicks {
    /// All dropped picks.
    pub fn total(&self) -> usize {
        self.unknown_items + self.unknown_counterparts + self.duplicates
    }
}

impl AiPicks {
    /// Adds the valid picks of `answer`. A pick is dropped when its ids are not among the task's
    /// items of that kind, or when an earlier pick has its item or counterpart, keeping the picks
    /// one-to-one.
    pub fn add_answer(&mut self, task: &AiMatchingTask, answer: &AiMatchingAnswer) -> DroppedPicks {
        let mut dropped = DroppedPicks::default();
        add_picks(
            &mut self.pages,
            &mut dropped,
            &task.this_pages,
            &task.other_pages,
            &answer.pages,
        );
        add_picks(
            &mut self.exercises,
            &mut dropped,
            &task.this_exercises,
            &task.other_exercises,
            &answer.exercises,
        );
        dropped
    }
}

fn add_picks(
    res: &mut HashMap<Uuid, Option<Uuid>>,
    dropped: &mut DroppedPicks,
    this: &[AiMatchingItem],
    other: &[AiMatchingItem],
    picks: &[AiPick],
) {
    let find = |items: &[AiMatchingItem], id: &str| {
        let id = Uuid::parse_str(id.trim()).ok()?;
        items.iter().any(|item| item.id == id).then_some(id)
    };
    let mut used_other = HashSet::new();
    let mut answered = HashSet::new();
    for pick in picks {
        let Some(item) = find(this, &pick.item) else {
            dropped.unknown_items += 1;
            continue;
        };
        let counterpart = match &pick.counterpart {
            None => None,
            Some(id) => match find(other, id) {
                Some(id) => Some(id),
                None => {
                    dropped.unknown_counterparts += 1;
                    continue;
                }
            },
        };
        if answered.contains(&item) || counterpart.is_some_and(|id| used_other.contains(&id)) {
            dropped.duplicates += 1;
            continue;
        }
        answered.insert(item);
        used_other.extend(counterpart);
        res.insert(item, counterpart);
    }
}

/// Linked counterparts and copies stay as they are, so the AI is not asked about them.
fn is_fixed<T>(m: &Match<'_, T>) -> bool {
    m.is_linked || m.reason == Some(SuggestionReason::CopyHistory)
}

/// What to ask the AI about `course_id`'s pages and exercises: one task per other course and
/// chapter number with something unlinked on both sides.
pub fn ai_matching_tasks(
    snapshot: &LanguageGroupSnapshot,
    lineage: &CopyLineage,
    course_id: Uuid,
) -> Vec<AiMatchingTask> {
    let index = CounterpartIndex::new(snapshot);
    let language_of = |id: Uuid| {
        snapshot
            .courses
            .iter()
            .find(|c| c.id == id)
            .map(|c| c.language_code.clone())
            .unwrap_or_default()
    };
    let chapter_name = |course: Uuid, number: Option<i32>| {
        let number = number?;
        snapshot
            .chapters
            .iter()
            .find(|c| c.course_id == course && c.chapter_number == number)
            .map(|c| c.name.clone())
    };
    let mut res = Vec::new();
    for other in index.course_ids().into_iter().filter(|id| *id != course_id) {
        let page_matches = match_pages(&index, lineage, course_id, other);
        let exercise_matches = match_exercises(&index, lineage, course_id, other, &page_matches);
        let fixed_other_pages: HashSet<Uuid> = page_matches
            .values()
            .filter(|m| is_fixed(m))
            .map(|m| m.item.page.id)
            .collect();
        let fixed_other_exercises: HashSet<Uuid> = exercise_matches
            .values()
            .filter(|m| is_fixed(m))
            .map(|m| m.item.exercise.id)
            .collect();
        let free_this_pages: Vec<_> = index
            .live_pages(course_id)
            .filter(|p| !page_matches.get(&p.page.id).is_some_and(is_fixed))
            .collect();
        let free_other_pages: Vec<_> = index
            .live_pages(other)
            .filter(|p| {
                !fixed_other_pages.contains(&p.page.id)
                    && index.page_counterpart_in(&p.page, course_id).is_none()
            })
            .collect();
        let free_this_exercises: Vec<_> = index
            .live_exercises(course_id)
            .filter(|e| !exercise_matches.get(&e.exercise.id).is_some_and(is_fixed))
            .collect();
        let free_other_exercises: Vec<_> = index
            .live_exercises(other)
            .filter(|e| {
                !fixed_other_exercises.contains(&e.exercise.id)
                    && index
                        .exercise_counterpart_in(&e.exercise, course_id)
                        .is_none()
            })
            .collect();

        let mut chapter_numbers: Vec<Option<i32>> = free_this_pages
            .iter()
            .map(|p| p.page.chapter_number)
            .chain(
                free_this_exercises
                    .iter()
                    .map(|e| e.exercise.chapter_number),
            )
            .collect();
        chapter_numbers.sort_unstable();
        chapter_numbers.dedup();
        for chapter_number in chapter_numbers {
            let other_pages: Vec<AiMatchingItem> = free_other_pages
                .iter()
                .filter(|p| p.page.chapter_number == chapter_number)
                .map(|p| AiMatchingItem {
                    id: p.page.id,
                    title: p.page.title.clone(),
                    page_title: None,
                    excerpt: String::new(),
                    heuristic_pick: None,
                })
                .collect();
            let other_exercises: Vec<AiMatchingItem> = free_other_exercises
                .iter()
                .filter(|e| e.exercise.chapter_number == chapter_number)
                .map(|e| AiMatchingItem {
                    id: e.exercise.id,
                    title: e.exercise.name.clone(),
                    page_title: Some(e.exercise.page_title.clone()),
                    excerpt: String::new(),
                    heuristic_pick: None,
                })
                .collect();
            let listed_pick =
                |items: &[AiMatchingItem], id: Uuid| items.iter().any(|o| o.id == id).then_some(id);
            let this_pages: Vec<AiMatchingItem> = free_this_pages
                .iter()
                .filter(|p| p.page.chapter_number == chapter_number)
                .map(|p| AiMatchingItem {
                    id: p.page.id,
                    title: p.page.title.clone(),
                    page_title: None,
                    excerpt: String::new(),
                    heuristic_pick: page_matches.get(&p.page.id).and_then(|m| {
                        listed_pick(&other_pages, m.item.page.id).map(|n| (n, m.sureness))
                    }),
                })
                .collect();
            let this_exercises: Vec<AiMatchingItem> = free_this_exercises
                .iter()
                .filter(|e| e.exercise.chapter_number == chapter_number)
                .map(|e| AiMatchingItem {
                    id: e.exercise.id,
                    title: e.exercise.name.clone(),
                    page_title: Some(e.exercise.page_title.clone()),
                    excerpt: String::new(),
                    heuristic_pick: exercise_matches.get(&e.exercise.id).and_then(|m| {
                        listed_pick(&other_exercises, m.item.exercise.id).map(|n| (n, m.sureness))
                    }),
                })
                .collect();
            let has_page_question = !this_pages.is_empty() && !other_pages.is_empty();
            let has_exercise_question = !this_exercises.is_empty() && !other_exercises.is_empty();
            if !has_page_question && !has_exercise_question {
                continue;
            }
            let known_page_pairs = page_matches
                .iter()
                .filter(|(_, m)| is_fixed(m) && m.item.page.chapter_number == chapter_number)
                .filter_map(|(id, m)| {
                    Some(AiKnownPair {
                        this_title: index.page(*id)?.page.title.clone(),
                        other_title: m.item.page.title.clone(),
                    })
                })
                .collect();
            let this_exercise_names: HashMap<Uuid, &str> = index
                .live_exercises(course_id)
                .map(|e| (e.exercise.id, e.exercise.name.as_str()))
                .collect();
            let known_exercise_pairs = exercise_matches
                .iter()
                .filter(|(_, m)| is_fixed(m) && m.item.exercise.chapter_number == chapter_number)
                .filter_map(|(id, m)| {
                    Some(AiKnownPair {
                        this_title: this_exercise_names.get(id)?.to_string(),
                        other_title: m.item.exercise.name.clone(),
                    })
                })
                .collect();
            res.push(AiMatchingTask {
                other_course_id: other,
                this_language_code: language_of(course_id),
                other_language_code: language_of(other),
                chapter_number,
                this_chapter_name: chapter_name(course_id, chapter_number),
                other_chapter_name: chapter_name(other, chapter_number),
                this_pages,
                other_pages,
                this_exercises,
                other_exercises,
                known_page_pairs,
                known_exercise_pairs,
            });
        }
    }
    res
}

/// Fills in the excerpts of the tasks' items from page content and exercise assignments.
pub async fn fill_excerpts(
    conn: &mut PgConnection,
    tasks: &mut [AiMatchingTask],
) -> ModelResult<()> {
    let page_ids: Vec<Uuid> = tasks
        .iter()
        .flat_map(|t| t.this_pages.iter().chain(&t.other_pages))
        .map(|p| p.id)
        .collect();
    let exercise_ids: Vec<Uuid> = tasks
        .iter()
        .flat_map(|t| t.this_exercises.iter().chain(&t.other_exercises))
        .map(|e| e.id)
        .collect();
    let mut texts: HashMap<Uuid, String> = HashMap::new();
    let page_rows = sqlx::query!(
        r#"
SELECT p.id,
  left(p.content_search_original_text, $2) AS text
FROM pages p
WHERE p.id = ANY($1)
  AND p.deleted_at IS NULL
        "#,
        &page_ids,
        MAX_SOURCE_TEXT_CHARS
    )
    .fetch_all(&mut *conn)
    .await?;
    texts.extend(
        page_rows
            .into_iter()
            .filter_map(|row| Some((row.id, row.text?))),
    );
    let exercise_rows = sqlx::query!(
        r#"
SELECT es.exercise_id AS "id!",
  left(
    string_agg(
      block_text.value #>> '{}',
      ' '
      ORDER BY es.order_number,
        et.order_number
    ),
    $2
  ) AS text
FROM exercise_slides es
  JOIN exercise_tasks et ON et.exercise_slide_id = es.id
  AND et.deleted_at IS NULL
  CROSS JOIN LATERAL extract_searchable_text_from_document_schema(
    CASE
      WHEN jsonb_typeof(et.assignment) = 'array' THEN et.assignment
      ELSE '[]'::jsonb
    END
  ) AS block_text(value)
WHERE es.exercise_id = ANY($1)
  AND es.deleted_at IS NULL
GROUP BY es.exercise_id
        "#,
        &exercise_ids,
        MAX_SOURCE_TEXT_CHARS
    )
    .fetch_all(&mut *conn)
    .await?;
    texts.extend(
        exercise_rows
            .into_iter()
            .filter_map(|row| Some((row.id, row.text?))),
    );

    for task in tasks {
        let page_count = task.this_pages.len() + task.other_pages.len();
        let exercise_count = task.this_exercises.len() + task.other_exercises.len();
        let wanted = page_count * PAGE_EXCERPT_CHARS + exercise_count * EXERCISE_EXCERPT_CHARS;
        let scale = |chars: usize| {
            if wanted <= MAX_EXCERPT_CHARS_PER_TASK {
                chars
            } else {
                chars * MAX_EXCERPT_CHARS_PER_TASK / wanted
            }
        };
        let (page_chars, exercise_chars) =
            (scale(PAGE_EXCERPT_CHARS), scale(EXERCISE_EXCERPT_CHARS));
        for item in task
            .this_pages
            .iter_mut()
            .chain(task.other_pages.iter_mut())
        {
            item.excerpt = excerpt(texts.get(&item.id), page_chars);
        }
        for item in task
            .this_exercises
            .iter_mut()
            .chain(task.other_exercises.iter_mut())
        {
            item.excerpt = excerpt(texts.get(&item.id), exercise_chars);
        }
    }
    Ok(())
}

fn excerpt(text: Option<&String>, max_chars: usize) -> String {
    let Some(text) = text else {
        return String::new();
    };
    let plain = decode_html_entities(&strip_html_tags(text)).into_owned();
    plain
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(max_chars)
        .collect()
}
