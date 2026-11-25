//! Courses outside a course language group that could join it as language versions.

use headless_lms_utils::language_tags::is_same_language;

use super::{
    snapshot::LanguageGroupSnapshot,
    types::{JoinBlockedReason, JoinCandidate, JoinCandidateReason, LanguageVersionCourse},
};
use crate::prelude::*;

/// Most candidates returned; the caller checks edit rights on each.
const CANDIDATE_LIMIT: i64 = 50;

/// Names at least this similar (pg_trgm) count as [JoinCandidateReason::SimilarName].
const SIMILAR_NAME_THRESHOLD: f32 = 0.4;

/// Courses that look like translations of the group's courses: same organization, outside the
/// group, sharing copy history or a similar size (chapters, pages, exercises) with it; teachers,
/// dates and names alone match too many unrelated courses. With `search`, courses of any organization
/// whose name or slug contains it instead, with whatever reasons apply. Courses whose language
/// the group already has come back blocked. `can_edit` is false; the caller fills it in and
/// drops courses the user can't edit.
pub async fn get_join_candidates(
    conn: &mut PgConnection,
    snapshot: &LanguageGroupSnapshot,
    search: Option<&str>,
) -> ModelResult<Vec<JoinCandidate>> {
    let search_pattern = search.map(str::trim).filter(|s| !s.is_empty()).map(|s| {
        format!(
            "%{}%",
            s.replace('\\', "\\\\")
                .replace('%', "\\%")
                .replace('_', "\\_")
        )
    });
    let rows = sqlx::query!(
        r#"
WITH course_counts AS (
  SELECT c.id,
    (
      SELECT COUNT(*)
      FROM chapters ch
      WHERE ch.course_id = c.id
        AND ch.deleted_at IS NULL
    ) AS chapter_count,
    (
      SELECT COUNT(*)
      FROM pages p
      WHERE p.course_id = c.id
        AND p.deleted_at IS NULL
    ) AS page_count,
    (
      SELECT COUNT(*)
      FROM exercises e
      WHERE e.course_id = c.id
        AND e.deleted_at IS NULL
    ) AS exercise_count
  FROM courses c
  WHERE c.deleted_at IS NULL
    AND (
      c.course_language_group_id = $1
      OR (
        $2::TEXT IS NULL
        AND c.organization_id IN (
          SELECT organization_id
          FROM courses
          WHERE course_language_group_id = $1
            AND deleted_at IS NULL
        )
      )
      OR c.name ILIKE $2
      OR c.slug ILIKE $2
    )
),
group_courses AS (
  SELECT c.id,
    c.copied_from,
    c.created_at,
    c.name,
    cc.chapter_count,
    cc.page_count,
    cc.exercise_count
  FROM courses c
    JOIN course_counts cc ON cc.id = c.id
  WHERE c.course_language_group_id = $1
),
group_teachers AS (
  SELECT DISTINCT r.user_id
  FROM roles r
  WHERE r.course_id IN (
      SELECT id
      FROM group_courses
    )
    AND r.role IN ('teacher', 'course_or_exam_creator')
    AND r.deleted_at IS NULL
),
scored AS (
  SELECT c.id,
    c.name,
    c.slug,
    c.language_code,
    c.course_language_group_id,
    c.is_draft,
    c.created_at,
    cc.chapter_count,
    cc.page_count,
    cc.exercise_count,
    EXISTS (
      SELECT 1
      FROM group_courses g
      WHERE g.id = c.copied_from
        OR g.copied_from = c.id
    ) AS copied_from_this_course,
    EXISTS (
      SELECT 1
      FROM group_courses g
      WHERE g.copied_from = c.copied_from
    ) AS copied_from_same_course,
    EXISTS (
      SELECT 1
      FROM group_courses g
      WHERE g.chapter_count > 0
        AND g.chapter_count = cc.chapter_count
        AND ABS(g.page_count - cc.page_count) <= GREATEST(2, g.page_count / 10)
        AND ABS(g.exercise_count - cc.exercise_count) <= GREATEST(5, g.exercise_count / 4)
    ) AS same_chapter_and_page_counts,
    EXISTS (
      SELECT 1
      FROM roles r
      WHERE r.course_id = c.id
        AND r.role IN ('teacher', 'course_or_exam_creator')
        AND r.deleted_at IS NULL
        AND r.user_id IN (
          SELECT user_id
          FROM group_teachers
        )
    ) AS same_teachers,
    EXISTS (
      SELECT 1
      FROM group_courses g
      WHERE g.created_at::DATE = c.created_at::DATE
    ) AS created_on_same_day,
    EXISTS (
      SELECT 1
      FROM group_courses g
      WHERE similarity(g.name, c.name) >= $3
    ) AS similar_name
  FROM courses c
    JOIN course_counts cc ON cc.id = c.id
  WHERE c.course_language_group_id <> $1
)
SELECT id,
  name,
  slug,
  language_code,
  course_language_group_id,
  is_draft,
  created_at,
  chapter_count AS "chapter_count!",
  page_count AS "page_count!",
  exercise_count AS "exercise_count!",
  (
    SELECT COUNT(*)
    FROM user_course_settings ucs
    WHERE ucs.current_course_id = scored.id
      AND ucs.deleted_at IS NULL
  ) AS "student_count!",
  copied_from_this_course AS "copied_from_this_course!",
  copied_from_same_course AS "copied_from_same_course!",
  same_chapter_and_page_counts AS "same_chapter_and_page_counts!",
  same_teachers AS "same_teachers!",
  created_on_same_day AS "created_on_same_day!",
  similar_name AS "similar_name!"
FROM scored
WHERE $2::TEXT IS NOT NULL
  OR copied_from_this_course
  OR copied_from_same_course
  OR same_chapter_and_page_counts
ORDER BY name,
  slug
LIMIT $4
        "#,
        snapshot.course_language_group_id,
        search_pattern,
        SIMILAR_NAME_THRESHOLD,
        CANDIDATE_LIMIT
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let reasons = [
                (
                    row.copied_from_this_course,
                    JoinCandidateReason::CopiedFromThisCourse,
                ),
                (
                    // A direct copy also shares its original with the group's other copies.
                    row.copied_from_same_course && !row.copied_from_this_course,
                    JoinCandidateReason::CopiedFromSameCourse,
                ),
                (
                    row.same_chapter_and_page_counts,
                    JoinCandidateReason::SameChapterAndPageCounts,
                ),
                (row.same_teachers, JoinCandidateReason::SameTeachers),
                (
                    row.created_on_same_day,
                    JoinCandidateReason::CreatedOnSameDay,
                ),
                (row.similar_name, JoinCandidateReason::SimilarName),
            ]
            .into_iter()
            .filter_map(|(applies, reason)| applies.then_some(reason))
            .collect();
            let blocked_reason = snapshot
                .courses
                .iter()
                .any(|c| is_same_language(&c.language_code, &row.language_code))
                .then_some(JoinBlockedReason::LanguageAlreadyPresent);
            JoinCandidate {
                course: LanguageVersionCourse {
                    id: row.id,
                    name: row.name,
                    slug: row.slug,
                    language_code: row.language_code,
                    course_language_group_id: row.course_language_group_id,
                    is_draft: row.is_draft,
                    created_at: row.created_at,
                    chapter_count: row.chapter_count,
                    page_count: row.page_count,
                    exercise_count: row.exercise_count,
                    student_count: Some(row.student_count),
                    can_edit: false,
                },
                reasons,
                blocked_reason,
            }
        })
        .collect())
}

/// Whether the candidate is likely enough a translation to report it as a problem: it can join,
/// and it shares copy history with the group, or its structure plus another sign.
pub fn is_likely_language_version(candidate: &JoinCandidate) -> bool {
    let has = |reason| candidate.reasons.contains(&reason);
    candidate.blocked_reason.is_none()
        && (has(JoinCandidateReason::CopiedFromThisCourse)
            || has(JoinCandidateReason::CopiedFromSameCourse)
            || (has(JoinCandidateReason::SameChapterAndPageCounts) && candidate.reasons.len() >= 2))
}
