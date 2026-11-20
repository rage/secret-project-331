//! Everything the repair tool reads about a course language group, loaded in one go so that
//! detection, suggestions and the structure comparison work on the same state.

use std::collections::HashSet;

use super::types::{
    LanguageVersionChapter, LanguageVersionCourse, LanguageVersionExercise, LanguageVersionPage,
};
use crate::prelude::*;

/// A course language group with its courses' chapters, pages and exercises.
#[derive(Debug, Clone)]
pub struct LanguageGroupSnapshot {
    pub course_language_group_id: Uuid,
    /// Live courses of the group, oldest first. `can_edit` is false; the caller fills it in for
    /// the requesting user.
    pub courses: Vec<LanguageVersionCourse>,
    /// Live chapters of `courses`, by course and chapter number.
    pub chapters: Vec<LanguageVersionChapter>,
    /// Live pages of `courses`, plus every page sharing a page language group with one of them:
    /// pages of courses outside the group (`is_foreign`) and deleted pages (`page.is_deleted`).
    pub pages: Vec<SnapshotPage>,
    /// Exercises, selected like `pages`.
    pub exercises: Vec<SnapshotExercise>,
    /// Courses of the foreign pages and exercises.
    pub foreign_courses: Vec<ForeignCourse>,
}

/// Whether to count each course's students, which only some views show.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StudentCounts {
    Include,
    Omit,
}

#[derive(Debug, Clone)]
pub struct SnapshotPage {
    /// `position` is 0 for deleted pages.
    pub page: LanguageVersionPage,
    pub copied_from: Option<Uuid>,
    /// The page's course is not in the snapshot's group.
    pub is_foreign: bool,
}

#[derive(Debug, Clone)]
pub struct SnapshotExercise {
    /// `position` is 0 for deleted exercises.
    pub exercise: LanguageVersionExercise,
    pub copied_from: Option<Uuid>,
    /// The exercise's course is not in the snapshot's group.
    pub is_foreign: bool,
}

/// A course outside the group that one of its pages or exercises is linked to.
#[derive(Debug, Clone)]
pub struct ForeignCourse {
    pub id: Uuid,
    pub name: String,
    pub language_code: String,
    pub course_language_group_id: Uuid,
    pub is_deleted: bool,
}

/// Loads the course language group. Fails with `NotFound` if the group has no live courses.
pub async fn load(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    student_counts: StudentCounts,
) -> ModelResult<LanguageGroupSnapshot> {
    load_with_candidates(conn, course_language_group_id, &[], student_counts).await
}

/// Like [load], but treats `candidate_course_ids` (courses not yet in the group) as members, so
/// that suggestions can match them before a join. Deleted candidates are left out.
pub async fn load_with_candidates(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    candidate_course_ids: &[Uuid],
    student_counts: StudentCounts,
) -> ModelResult<LanguageGroupSnapshot> {
    let mut course_ids = sqlx::query_scalar!(
        "
SELECT id
FROM courses
WHERE course_language_group_id = $1
  AND deleted_at IS NULL
        ",
        course_language_group_id
    )
    .fetch_all(&mut *conn)
    .await?;
    if course_ids.is_empty() {
        return Err(model_err!(
            NotFound,
            "The course language group has no courses.".to_string()
        ));
    }
    for id in candidate_course_ids {
        if !course_ids.contains(id) {
            course_ids.push(*id);
        }
    }
    let courses = get_courses(&mut *conn, &course_ids, student_counts).await?;
    let chapters = get_chapters(&mut *conn, &course_ids).await?;
    let pages = get_pages(&mut *conn, &course_ids).await?;
    let exercises = get_exercises(&mut *conn, &course_ids).await?;

    let in_group: HashSet<Uuid> = course_ids.iter().copied().collect();
    let foreign_course_ids: Vec<Uuid> = pages
        .iter()
        .map(|p| p.page.course_id)
        .chain(exercises.iter().map(|e| e.exercise.course_id))
        .filter(|id| !in_group.contains(id))
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let foreign_courses = get_foreign_courses(&mut *conn, &foreign_course_ids).await?;

    Ok(LanguageGroupSnapshot {
        course_language_group_id,
        courses,
        chapters,
        pages: pages
            .into_iter()
            .map(|p| SnapshotPage {
                is_foreign: !in_group.contains(&p.page.course_id),
                ..p
            })
            .collect(),
        exercises: exercises
            .into_iter()
            .map(|e| SnapshotExercise {
                is_foreign: !in_group.contains(&e.exercise.course_id),
                ..e
            })
            .collect(),
        foreign_courses,
    })
}

/// The courses with their counts, oldest first, whatever group they are in. Deleted courses are
/// left out; `can_edit` is false.
pub async fn get_courses(
    conn: &mut PgConnection,
    course_ids: &[Uuid],
    student_counts: StudentCounts,
) -> ModelResult<Vec<LanguageVersionCourse>> {
    let res = sqlx::query_as!(
        LanguageVersionCourse,
        r#"
SELECT c.id,
  c.name,
  c.slug,
  c.language_code,
  c.course_language_group_id,
  c.is_draft,
  c.created_at,
  (
    SELECT COUNT(*)
    FROM chapters ch
    WHERE ch.course_id = c.id
      AND ch.deleted_at IS NULL
  ) AS "chapter_count!",
  (
    SELECT COUNT(*)
    FROM pages p
    WHERE p.course_id = c.id
      AND p.deleted_at IS NULL
  ) AS "page_count!",
  (
    SELECT COUNT(*)
    FROM exercises e
    WHERE e.course_id = c.id
      AND e.deleted_at IS NULL
  ) AS "exercise_count!",
  CASE
    WHEN $2 THEN (
      SELECT COUNT(*)
      FROM user_course_settings ucs
      WHERE ucs.current_course_id = c.id
        AND ucs.deleted_at IS NULL
    )
  END AS "student_count?",
  FALSE AS "can_edit!"
FROM courses c
WHERE c.id = ANY($1)
  AND c.deleted_at IS NULL
ORDER BY c.created_at,
  c.id
        "#,
        course_ids,
        student_counts == StudentCounts::Include
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

async fn get_chapters(
    conn: &mut PgConnection,
    course_ids: &[Uuid],
) -> ModelResult<Vec<LanguageVersionChapter>> {
    let res = sqlx::query_as!(
        LanguageVersionChapter,
        r#"
SELECT ch.id,
  ch.course_id,
  ch.chapter_number,
  ch.name,
  (
    SELECT COUNT(*)
    FROM pages p
    WHERE p.chapter_id = ch.id
      AND p.deleted_at IS NULL
  ) AS "page_count!"
FROM chapters ch
WHERE ch.course_id = ANY($1)
  AND ch.deleted_at IS NULL
ORDER BY ch.course_id,
  ch.chapter_number
        "#,
        course_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

async fn get_pages(conn: &mut PgConnection, course_ids: &[Uuid]) -> ModelResult<Vec<SnapshotPage>> {
    let rows = sqlx::query!(
        r#"
WITH selected AS (
  SELECT p.id
  FROM pages p
  WHERE p.course_id = ANY($1)
    AND p.deleted_at IS NULL
  UNION
  SELECT p.id
  FROM pages p
  WHERE p.course_id IS NOT NULL
    AND p.page_language_group_id IN (
      SELECT page_language_group_id
      FROM pages
      WHERE course_id = ANY($1)
        AND deleted_at IS NULL
    )
),
live_positions AS (
  SELECT p.id,
    ROW_NUMBER() OVER (
      PARTITION BY p.course_id,
      p.chapter_id
      ORDER BY p.order_number,
        p.id
    ) AS position
  FROM pages p
  WHERE p.deleted_at IS NULL
    AND p.course_id IN (
      SELECT course_id
      FROM pages
      WHERE id IN (
          SELECT id
          FROM selected
        )
    )
)
SELECT p.id,
  p.course_id AS "course_id!",
  c.language_code,
  p.title,
  p.url_path,
  p.chapter_id,
  ch.chapter_number AS "chapter_number?",
  ch.name AS "chapter_name?",
  COALESCE(lp.position, 0)::INTEGER AS "position!",
  COALESCE(ch.front_page_id = p.id, FALSE) AS "is_chapter_front_page!",
  p.page_language_group_id,
  (
    SELECT COUNT(*)
    FROM exercises e
    WHERE e.page_id = p.id
      AND e.deleted_at IS NULL
  ) AS "exercise_count!",
  (
    p.deleted_at IS NOT NULL
    OR c.deleted_at IS NOT NULL
  ) AS "is_deleted!",
  p.copied_from
FROM selected s
  JOIN pages p ON p.id = s.id
  JOIN courses c ON c.id = p.course_id
  LEFT JOIN chapters ch ON ch.id = p.chapter_id
  LEFT JOIN live_positions lp ON lp.id = p.id
ORDER BY p.course_id,
  ch.chapter_number NULLS FIRST,
  p.order_number,
  p.id
        "#,
        course_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| SnapshotPage {
            page: LanguageVersionPage {
                id: r.id,
                course_id: r.course_id,
                language_code: r.language_code,
                title: r.title,
                url_path: r.url_path,
                chapter_id: r.chapter_id,
                chapter_number: r.chapter_number,
                chapter_name: r.chapter_name,
                position: r.position,
                is_chapter_front_page: r.is_chapter_front_page,
                page_language_group_id: r.page_language_group_id,
                exercise_count: r.exercise_count,
                is_deleted: r.is_deleted,
            },
            copied_from: r.copied_from,
            is_foreign: false,
        })
        .collect())
}

async fn get_exercises(
    conn: &mut PgConnection,
    course_ids: &[Uuid],
) -> ModelResult<Vec<SnapshotExercise>> {
    let rows = sqlx::query!(
        r#"
WITH selected AS (
  SELECT e.id
  FROM exercises e
  WHERE e.course_id = ANY($1)
    AND e.deleted_at IS NULL
  UNION
  SELECT e.id
  FROM exercises e
  WHERE e.course_id IS NOT NULL
    AND e.exercise_language_group_id IN (
      SELECT exercise_language_group_id
      FROM exercises
      WHERE course_id = ANY($1)
        AND deleted_at IS NULL
    )
),
live_positions AS (
  SELECT e.id,
    ROW_NUMBER() OVER (
      PARTITION BY e.page_id
      ORDER BY e.order_number,
        e.id
    ) AS position
  FROM exercises e
  WHERE e.deleted_at IS NULL
    AND e.page_id IN (
      SELECT page_id
      FROM exercises
      WHERE id IN (
          SELECT id
          FROM selected
        )
    )
)
SELECT e.id,
  e.course_id AS "course_id!",
  c.language_code,
  e.name,
  e.page_id,
  p.title AS page_title,
  ch.chapter_number AS "chapter_number?",
  COALESCE(lp.position, 0)::INTEGER AS "position!",
  ARRAY(
    SELECT et.exercise_type
    FROM exercise_slides es
      JOIN exercise_tasks et ON et.exercise_slide_id = es.id
    WHERE es.exercise_id = e.id
      AND (
        e.deleted_at IS NOT NULL
        OR (
          es.deleted_at IS NULL
          AND et.deleted_at IS NULL
        )
      )
    ORDER BY es.order_number,
      et.order_number
  ) AS "exercise_types!",
  e.exercise_language_group_id,
  (
    e.deleted_at IS NOT NULL
    OR c.deleted_at IS NOT NULL
  ) AS "is_deleted!",
  e.copied_from
FROM selected s
  JOIN exercises e ON e.id = s.id
  JOIN courses c ON c.id = e.course_id
  JOIN pages p ON p.id = e.page_id
  LEFT JOIN chapters ch ON ch.id = p.chapter_id
  LEFT JOIN live_positions lp ON lp.id = e.id
ORDER BY e.course_id,
  ch.chapter_number NULLS FIRST,
  p.order_number,
  e.order_number,
  e.id
        "#,
        course_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            let mut exercise_types: Vec<String> = Vec::new();
            for exercise_type in r.exercise_types {
                if !exercise_types.contains(&exercise_type) {
                    exercise_types.push(exercise_type);
                }
            }
            SnapshotExercise {
                exercise: LanguageVersionExercise {
                    id: r.id,
                    course_id: r.course_id,
                    language_code: r.language_code,
                    name: r.name,
                    page_id: r.page_id,
                    page_title: r.page_title,
                    chapter_number: r.chapter_number,
                    position: r.position,
                    exercise_types,
                    exercise_language_group_id: r.exercise_language_group_id,
                    is_deleted: r.is_deleted,
                },
                copied_from: r.copied_from,
                is_foreign: false,
            }
        })
        .collect())
}

async fn get_foreign_courses(
    conn: &mut PgConnection,
    course_ids: &[Uuid],
) -> ModelResult<Vec<ForeignCourse>> {
    if course_ids.is_empty() {
        return Ok(Vec::new());
    }
    let res = sqlx::query_as!(
        ForeignCourse,
        r#"
SELECT id,
  name,
  language_code,
  course_language_group_id,
  deleted_at IS NOT NULL AS "is_deleted!"
FROM courses
WHERE id = ANY($1)
        "#,
        course_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
