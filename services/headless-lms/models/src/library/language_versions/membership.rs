//! Joins a course into a course language group and splits one off, moving the per-group student
//! data with it. Per-course data (completions, course instance enrolments, exercise states,
//! points) stays with the course and needs no moving.

use std::collections::{HashMap, HashSet};

use headless_lms_utils::language_tags::is_same_language;
use serde_json::json;

use super::linking::LinkedItemKind;
use super::operation_logs::{self, LanguageVersionOperation};
use super::snapshot::{self, StudentCounts};
use super::types::{
    JoinBlockedReason, JoinLanguageVersionPreview, JoinLanguageVersionRequest,
    JoinLanguageVersionResult, LanguageVersionCourse, SplitLanguageVersionPreview,
    SplitLanguageVersionRequest, SplitLanguageVersionResult, StudentDataCount, StudentDataKind,
};
use super::{first_free_suffixed, invalid_request};
use crate::prelude::*;

/// What a join or split returned, with the course language groups whose courses changed.
pub struct MembershipChange<T> {
    pub result: T,
    pub changed_course_language_group_ids: [Uuid; 2],
}

/// A student with enrolment settings both in the moved course and in the target language
/// versions. Only one settings row per student and group can exist, so the one with the later
/// activity is kept and the other removed (and logged); points stay on both courses.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct EnrolmentConflict {
    pub user_id: Uuid,
    pub kept_course_id: Uuid,
    pub removed_course_id: Uuid,
    /// Later of the settings' last update and the student's latest exercise activity there.
    pub kept_activity_at: DateTime<Utc>,
    pub removed_activity_at: DateTime<Utc>,
    pub keeps_moved_course: bool,
}

/// What joining `joined_course_id` into the group would change. Changes nothing.
///
/// `can_edit` of the returned courses is false; the caller fills it in. Fails with `NotFound` if
/// the course is deleted or the group has no live courses.
pub async fn join_preview(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    joined_course_id: Uuid,
) -> ModelResult<JoinLanguageVersionPreview> {
    let course = get_course(&mut *conn, joined_course_id).await?;
    let language_versions = get_group_courses(&mut *conn, course_language_group_id).await?;
    let blocked_reason = join_blocked_reason(&course, &language_versions, course_language_group_id);
    let left_language_versions = if course.course_language_group_id == course_language_group_id {
        vec![]
    } else {
        get_group_courses(&mut *conn, course.course_language_group_id)
            .await?
            .into_iter()
            .filter(|c| c.id != joined_course_id)
            .collect()
    };
    let plan = plan_move(
        &mut *conn,
        joined_course_id,
        course.course_language_group_id,
        Some(course_language_group_id),
    )
    .await?;
    Ok(JoinLanguageVersionPreview {
        course,
        language_versions,
        left_language_versions,
        unlinked_page_count: plan.pages.unlinked_count(),
        unlinked_exercise_count: plan.exercises.unlinked_count(),
        blocked_reason,
        expected_student_count: plan.live_enrolment_count,
        moved_data: plan.moved_data(),
        students_in_both_count: plan.enrolment_conflicts.len() as i64,
    })
}

/// Moves `request.course_id` from its own group into this one with its students' per-group data,
/// in one transaction, and logs the change. Its links to courses that stay in the old group are
/// removed; the old group is soft-deleted when no live course is left in it.
///
/// Fails with `InvalidRequest` when the course already is a language version or the group
/// already has a course in its language, and with `StaleVersion` when the course's student count
/// is no longer `request.expected_student_count` or the course changed groups since the preview.
pub async fn join_course(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    actor_user_id: Uuid,
    request: &JoinLanguageVersionRequest,
) -> ModelResult<MembershipChange<JoinLanguageVersionResult>> {
    let mut tx = conn.begin().await?;
    let from_group_id = get_course(&mut tx, request.course_id)
        .await?
        .course_language_group_id;
    lock_groups(&mut tx, &[from_group_id, course_language_group_id]).await?;
    let course = get_course(&mut tx, request.course_id).await?;
    if course.course_language_group_id != from_group_id {
        return Err(stale_error());
    }
    let language_versions = get_group_courses(&mut tx, course_language_group_id).await?;
    if let Some(reason) = join_blocked_reason(&course, &language_versions, course_language_group_id)
    {
        return Err(invalid_request(match reason {
            JoinBlockedReason::AlreadyLanguageVersion => {
                "The course already is one of the language versions."
            }
            JoinBlockedReason::LanguageAlreadyPresent => {
                "The language versions already have a course in this language."
            }
        }));
    }
    if course.student_count != Some(request.expected_student_count) {
        return Err(stale_error());
    }

    let plan = plan_move(
        &mut tx,
        request.course_id,
        from_group_id,
        Some(course_language_group_id),
    )
    .await?;
    let log_payload = apply_move(&mut tx, &plan, course_language_group_id).await?;
    operation_logs::insert(
        &mut tx,
        actor_user_id,
        LanguageVersionOperation::Join,
        course_language_group_id,
        log_payload,
    )
    .await?;
    tx.commit().await?;
    Ok(MembershipChange {
        result: JoinLanguageVersionResult {
            course_language_group_id,
            moved_data: plan.moved_data(),
            removed_enrolment_settings_count: plan.enrolment_conflicts.len() as i64,
        },
        changed_course_language_group_ids: [course_language_group_id, from_group_id],
    })
}

/// What splitting `split_course_id` off the group would change. Changes nothing.
///
/// `can_edit` of the returned courses is false; the caller fills it in. Fails with
/// `InvalidRequest` when the course is not a live course of the group or is its last one.
pub async fn split_preview(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    split_course_id: Uuid,
) -> ModelResult<SplitLanguageVersionPreview> {
    let courses = get_group_courses(&mut *conn, course_language_group_id).await?;
    let (course, remaining_courses) = split_off(courses, split_course_id)?;
    let plan = plan_move(&mut *conn, split_course_id, course_language_group_id, None).await?;
    Ok(SplitLanguageVersionPreview {
        course,
        remaining_courses,
        expected_student_count: plan.live_enrolment_count,
        moved_data: plan.moved_data(),
        unlinked_page_count: plan.pages.unlinked_count(),
        unlinked_exercise_count: plan.exercises.unlinked_count(),
    })
}

/// Moves `request.course_id` out of the group into a new group of its own with its students'
/// per-group data, unlinking its pages and exercises from the other versions, in one
/// transaction, and logs the change. Students of the other versions stay; group-wide data (AI
/// notice acknowledgements, mailing list) is copied.
///
/// Fails with `InvalidRequest` when the course is not a live course of the group or is its last
/// one, and with `StaleVersion` when its student count is no longer
/// `request.expected_student_count`.
pub async fn split_course(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    actor_user_id: Uuid,
    request: &SplitLanguageVersionRequest,
) -> ModelResult<MembershipChange<SplitLanguageVersionResult>> {
    let mut tx = conn.begin().await?;
    lock_groups(&mut tx, &[course_language_group_id]).await?;
    let courses = get_group_courses(&mut tx, course_language_group_id).await?;
    let (course, _) = split_off(courses, request.course_id)?;
    if course.student_count != Some(request.expected_student_count) {
        return Err(stale_error());
    }

    let plan = plan_move(&mut tx, request.course_id, course_language_group_id, None).await?;
    let slug = unique_group_slug(&mut tx, &course.slug).await?;
    let new_group_id =
        crate::course_language_groups::insert(&mut tx, PKeyPolicy::Generate, &slug).await?;
    let log_payload = apply_move(&mut tx, &plan, new_group_id).await?;
    operation_logs::insert(
        &mut tx,
        actor_user_id,
        LanguageVersionOperation::Split,
        course_language_group_id,
        log_payload,
    )
    .await?;
    tx.commit().await?;
    Ok(MembershipChange {
        result: SplitLanguageVersionResult {
            course_language_group_id: new_group_id,
            unlinked_page_count: plan.pages.unlinked_count(),
            unlinked_exercise_count: plan.exercises.unlinked_count(),
        },
        changed_course_language_group_ids: [course_language_group_id, new_group_id],
    })
}

fn stale_error() -> ModelError {
    model_err!(
        StaleVersion,
        "The course's students changed after the preview. Check the preview again.".to_string()
    )
}

fn join_blocked_reason(
    course: &LanguageVersionCourse,
    language_versions: &[LanguageVersionCourse],
    course_language_group_id: Uuid,
) -> Option<JoinBlockedReason> {
    if course.course_language_group_id == course_language_group_id {
        Some(JoinBlockedReason::AlreadyLanguageVersion)
    } else if language_versions
        .iter()
        .any(|c| is_same_language(&c.language_code, &course.language_code))
    {
        Some(JoinBlockedReason::LanguageAlreadyPresent)
    } else {
        None
    }
}

/// Splits `courses` into the course with the id and the rest.
fn split_off(
    courses: Vec<LanguageVersionCourse>,
    course_id: Uuid,
) -> ModelResult<(LanguageVersionCourse, Vec<LanguageVersionCourse>)> {
    let (course, remaining): (Vec<_>, Vec<_>) =
        courses.into_iter().partition(|c| c.id == course_id);
    let course = course
        .into_iter()
        .next()
        .ok_or_else(|| invalid_request("The course is not one of the language versions."))?;
    if remaining.is_empty() {
        return Err(invalid_request("The course is the only language version."));
    }
    Ok((course, remaining))
}

async fn get_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<LanguageVersionCourse> {
    snapshot::get_courses(conn, &[course_id], StudentCounts::Include)
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| model_err!(NotFound, "The course does not exist.".to_string()))
}

/// Live courses of the group, oldest first. Fails with `NotFound` if there are none.
async fn get_group_courses(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
) -> ModelResult<Vec<LanguageVersionCourse>> {
    let ids = get_group_course_ids(&mut *conn, course_language_group_id).await?;
    if ids.is_empty() {
        return Err(model_err!(
            NotFound,
            "The course language group has no courses.".to_string()
        ));
    }
    snapshot::get_courses(conn, &ids, StudentCounts::Include).await
}

async fn get_group_course_ids(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let ids = sqlx::query_scalar!(
        "
SELECT id
FROM courses
WHERE course_language_group_id = $1
  AND deleted_at IS NULL
        ",
        course_language_group_id
    )
    .fetch_all(conn)
    .await?;
    Ok(ids)
}

/// Locks the groups and their courses, in id order. Locking the courses also blocks new enrolment
/// settings for them until the transaction ends (their foreign key check needs KEY SHARE).
async fn lock_groups(conn: &mut PgConnection, group_ids: &[Uuid]) -> ModelResult<()> {
    sqlx::query!(
        "
SELECT id
FROM course_language_groups
WHERE id = ANY($1)
ORDER BY id
FOR UPDATE
        ",
        group_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    sqlx::query!(
        "
SELECT id
FROM courses
WHERE course_language_group_id = ANY($1)
ORDER BY id
FOR UPDATE
        ",
        group_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(())
}

/// The base slug, or the first free `<base>-<n>`, among live course language groups.
async fn unique_group_slug(conn: &mut PgConnection, base: &str) -> ModelResult<String> {
    let taken: HashSet<String> = sqlx::query_scalar!(
        "
SELECT slug
FROM course_language_groups
WHERE starts_with(slug, $1)
  AND deleted_at IS NULL
        ",
        base
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .collect();
    Ok(first_free_suffixed(base, |slug| taken.contains(slug)))
}

/// Everything a move of one course between groups changes, worked out before changing anything
/// so that previews and the operation report the same numbers.
struct MovePlan {
    course_id: Uuid,
    from_group_id: Uuid,
    /// No live course is left in the old group: group-wide rows move instead of being copied.
    is_from_group_emptied: bool,
    live_enrolment_count: i64,
    hidden_enrolment_count: i64,
    completion_count: i64,
    enrolment_conflicts: Vec<EnrolmentConflict>,
    moved_consents: Vec<PlannedRow>,
    /// Losing consents of students with consents in both groups, from either group.
    removed_consent_ids: Vec<Uuid>,
    carried_ack_ids: Vec<Uuid>,
    carried_token_ids: Vec<Uuid>,
    /// Old-group tokens dropped because the target already has a mailing list.
    dropped_token_ids: Vec<Uuid>,
    carried_tag_ids: Vec<Uuid>,
    pages: LinkPlan,
    exercises: LinkPlan,
}

struct PlannedRow {
    id: Uuid,
    is_live: bool,
}

/// How the moved course's pages or exercises leave their old language groups.
struct LinkPlan {
    /// Groups holding no live items outside the target: they move to the target group.
    moved_groups: Vec<MovedGroup>,
    /// Items linked to live items that stay behind: each gets a new group of its own.
    unlinked: Vec<UnlinkedItem>,
}

#[derive(Serialize)]
struct MovedGroup {
    id: Uuid,
    previous_course_language_group_id: Uuid,
}

struct UnlinkedItem {
    id: Uuid,
    previous_group_id: Uuid,
    is_live: bool,
}

impl LinkPlan {
    fn unlinked_count(&self) -> i64 {
        self.unlinked.iter().filter(|i| i.is_live).count() as i64
    }
}

impl MovePlan {
    /// Every kind, zero counts included.
    fn moved_data(&self) -> Vec<StudentDataCount> {
        let count = |kind, count: i64| StudentDataCount { kind, count };
        vec![
            count(
                StudentDataKind::EnrolmentSettings,
                self.live_enrolment_count,
            ),
            count(
                StudentDataKind::HiddenFromMyCourses,
                self.hidden_enrolment_count,
            ),
            count(StudentDataKind::Completions, self.completion_count),
            count(
                StudentDataKind::MarketingConsents,
                self.moved_consents.iter().filter(|c| c.is_live).count() as i64,
            ),
            count(
                StudentDataKind::AiNoticeAcknowledgements,
                self.carried_ack_ids.len() as i64,
            ),
            count(
                StudentDataKind::MailingListAccessTokens,
                self.carried_token_ids.len() as i64,
            ),
            count(
                StudentDataKind::MailchimpTags,
                self.carried_tag_ids.len() as i64,
            ),
        ]
    }
}

/// `to_group_id` `None` stands for a new, empty group (split).
async fn plan_move(
    conn: &mut PgConnection,
    course_id: Uuid,
    from_group_id: Uuid,
    to_group_id: Option<Uuid>,
) -> ModelResult<MovePlan> {
    // The nil id matches no rows, which is what a group that doesn't exist yet holds.
    let to_id = to_group_id.unwrap_or_else(Uuid::nil);
    let is_from_group_emptied = !get_group_course_ids(&mut *conn, from_group_id)
        .await?
        .iter()
        .any(|id| *id != course_id);
    let mut target_course_ids = get_group_course_ids(&mut *conn, to_id).await?;
    target_course_ids.push(course_id);

    let enrolments = sqlx::query!(
        r#"
SELECT user_id,
  (deleted_at IS NULL) AS "is_live!",
  hidden
FROM user_course_settings
WHERE current_course_id = $1
        "#,
        course_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let moved_user_ids: Vec<Uuid> = enrolments.iter().map(|e| e.user_id).collect();
    let live_enrolment_count = enrolments.iter().filter(|e| e.is_live).count() as i64;
    let hidden_enrolment_count = enrolments.iter().filter(|e| e.is_live && e.hidden).count() as i64;
    let completion_count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM course_module_completions
WHERE course_id = $1
  AND deleted_at IS NULL
        "#,
        course_id
    )
    .fetch_one(&mut *conn)
    .await?;

    let enrolment_conflicts = get_enrolment_conflicts(&mut *conn, course_id, to_group_id).await?;
    let users_keeping_moved_course: HashSet<Uuid> = {
        let losing: HashSet<Uuid> = enrolment_conflicts
            .iter()
            .filter(|c| !c.keeps_moved_course)
            .map(|c| c.user_id)
            .collect();
        moved_user_ids
            .iter()
            .copied()
            .filter(|id| !losing.contains(id))
            .collect()
    };
    let (moved_consents, removed_consent_ids) = plan_consents(
        &mut *conn,
        course_id,
        from_group_id,
        to_id,
        is_from_group_emptied,
        &moved_user_ids,
        &users_keeping_moved_course,
    )
    .await?;

    let carried_ack_ids = sqlx::query_scalar!(
        "
SELECT a.id
FROM user_ai_usage_notice_acknowledgements a
WHERE a.course_language_group_id = $1
  AND a.deleted_at IS NULL
  AND (
    $3
    OR a.user_id = ANY($4)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM user_ai_usage_notice_acknowledgements t
    WHERE t.user_id = a.user_id
      AND t.course_language_group_id = $2
      AND t.deleted_at IS NULL
  )
        ",
        from_group_id,
        to_id,
        is_from_group_emptied,
        &moved_user_ids
    )
    .fetch_all(&mut *conn)
    .await?;

    let from_token_ids = sqlx::query_scalar!(
        "
SELECT id
FROM marketing_mailing_list_access_tokens
WHERE course_language_group_id = $1
  AND deleted_at IS NULL
        ",
        from_group_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let target_has_token = sqlx::query_scalar!(
        r#"
SELECT EXISTS (
    SELECT 1
    FROM marketing_mailing_list_access_tokens
    WHERE course_language_group_id = $1
      AND deleted_at IS NULL
  ) AS "exists!"
        "#,
        to_id
    )
    .fetch_one(&mut *conn)
    .await?;
    // A surviving old group keeps using its own tokens, so only an emptied group drops any.
    let (carried_token_ids, dropped_token_ids) = match (target_has_token, is_from_group_emptied) {
        (false, _) => (from_token_ids, vec![]),
        (true, true) => (vec![], from_token_ids),
        (true, false) => (vec![], vec![]),
    };
    let carried_tag_ids = sqlx::query_scalar!(
        "
SELECT g.id
FROM mailchimp_course_tags g
WHERE g.marketing_mailing_list_access_token_id = ANY($1)
  AND g.course_language_group_id = $2
  AND g.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM mailchimp_course_tags t
    WHERE t.course_language_group_id = $3
      AND t.tag_name = g.tag_name
  )
        ",
        &carried_token_ids,
        from_group_id,
        to_id
    )
    .fetch_all(&mut *conn)
    .await?;

    let pages = plan_links(
        &mut *conn,
        LinkedItemKind::Page,
        course_id,
        to_id,
        &target_course_ids,
    )
    .await?;
    let exercises = plan_links(
        &mut *conn,
        LinkedItemKind::Exercise,
        course_id,
        to_id,
        &target_course_ids,
    )
    .await?;

    Ok(MovePlan {
        course_id,
        from_group_id,
        is_from_group_emptied,
        live_enrolment_count,
        hidden_enrolment_count,
        completion_count,
        enrolment_conflicts,
        moved_consents,
        removed_consent_ids,
        carried_ack_ids,
        carried_token_ids,
        dropped_token_ids,
        carried_tag_ids,
        pages,
        exercises,
    })
}

/// Conflicts between the course's enrolment settings, deleted ones included, and those in the
/// target group (the primary key covers deleted rows too). Live settings beat deleted ones; then
/// the later activity wins, the target's on a tie.
async fn get_enrolment_conflicts(
    conn: &mut PgConnection,
    course_id: Uuid,
    to_group_id: Option<Uuid>,
) -> ModelResult<Vec<EnrolmentConflict>> {
    let Some(to_group_id) = to_group_id else {
        return Ok(vec![]);
    };
    let rows = sqlx::query!(
        r#"
SELECT m.user_id,
  t.current_course_id AS target_course_id,
  (m.deleted_at IS NULL) AS "moved_is_live!",
  (t.deleted_at IS NULL) AS "target_is_live!",
  GREATEST(
    m.updated_at,
    (
      SELECT MAX(s.updated_at)
      FROM user_exercise_states s
      WHERE s.user_id = m.user_id
        AND s.course_id = m.current_course_id
        AND s.deleted_at IS NULL
    )
  ) AS "moved_activity_at!",
  GREATEST(
    t.updated_at,
    (
      SELECT MAX(s.updated_at)
      FROM user_exercise_states s
      WHERE s.user_id = t.user_id
        AND s.course_id = t.current_course_id
        AND s.deleted_at IS NULL
    )
  ) AS "target_activity_at!"
FROM user_course_settings m
  JOIN user_course_settings t ON t.user_id = m.user_id
  AND t.course_language_group_id = $2
WHERE m.current_course_id = $1
  AND t.current_course_id <> $1
ORDER BY m.user_id
        "#,
        course_id,
        to_group_id
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            let keeps_moved_course = if r.moved_is_live != r.target_is_live {
                r.moved_is_live
            } else {
                r.moved_activity_at > r.target_activity_at
            };
            let moved = (course_id, r.moved_activity_at);
            let target = (r.target_course_id, r.target_activity_at);
            let (kept, removed) = if keeps_moved_course {
                (moved, target)
            } else {
                (target, moved)
            };
            EnrolmentConflict {
                user_id: r.user_id,
                kept_course_id: kept.0,
                removed_course_id: removed.0,
                kept_activity_at: kept.1,
                removed_activity_at: removed.1,
                keeps_moved_course,
            }
        })
        .collect())
}

/// Consents follow their students' enrolment settings; a consent of a student without settings in
/// the old group follows the course it was given in. One consent per student and group can exist
/// (deleted ones included), so for students with one in both groups the consent of the group
/// whose settings the student keeps wins, otherwise the live and then the newer one.
async fn plan_consents(
    conn: &mut PgConnection,
    course_id: Uuid,
    from_group_id: Uuid,
    to_id: Uuid,
    is_from_group_emptied: bool,
    moved_user_ids: &[Uuid],
    users_keeping_moved_course: &HashSet<Uuid>,
) -> ModelResult<(Vec<PlannedRow>, Vec<Uuid>)> {
    let candidates = sqlx::query!(
        r#"
SELECT umc.id,
  umc.user_id,
  (umc.deleted_at IS NULL) AS "is_live!",
  umc.updated_at
FROM user_marketing_consents umc
WHERE umc.course_language_group_id = $1
  AND (
    $3
    OR umc.user_id = ANY($4)
    OR (
      umc.course_id = $2
      AND NOT EXISTS (
        SELECT 1
        FROM user_course_settings s
        WHERE s.user_id = umc.user_id
          AND s.course_language_group_id = $1
      )
    )
  )
        "#,
        from_group_id,
        course_id,
        is_from_group_emptied,
        moved_user_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    let candidate_user_ids: Vec<Uuid> = candidates.iter().map(|c| c.user_id).collect();
    let target_consents: HashMap<Uuid, _> = sqlx::query!(
        r#"
SELECT id,
  user_id,
  (deleted_at IS NULL) AS "is_live!",
  updated_at
FROM user_marketing_consents
WHERE course_language_group_id = $1
  AND user_id = ANY($2)
        "#,
        to_id,
        &candidate_user_ids
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .map(|r| (r.user_id, r))
    .collect();
    let users_enrolled_in_target: HashSet<Uuid> = sqlx::query_scalar!(
        "
SELECT user_id
FROM user_course_settings
WHERE course_language_group_id = $1
  AND user_id = ANY($2)
        ",
        to_id,
        &candidate_user_ids
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .collect();

    let mut moved = vec![];
    let mut removed = vec![];
    for candidate in candidates {
        let Some(target) = target_consents.get(&candidate.user_id) else {
            moved.push(PlannedRow {
                id: candidate.id,
                is_live: candidate.is_live,
            });
            continue;
        };
        let keeps_moved = if users_keeping_moved_course.contains(&candidate.user_id) {
            true
        } else if users_enrolled_in_target.contains(&candidate.user_id) {
            false
        } else if candidate.is_live != target.is_live {
            candidate.is_live
        } else {
            candidate.updated_at > target.updated_at
        };
        if keeps_moved {
            removed.push(target.id);
            moved.push(PlannedRow {
                id: candidate.id,
                is_live: candidate.is_live,
            });
        } else {
            removed.push(candidate.id);
        }
    }
    Ok((moved, removed))
}

/// `target_course_ids`: the moved course and the target group's live courses.
async fn plan_links(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    course_id: Uuid,
    to_id: Uuid,
    target_course_ids: &[Uuid],
) -> ModelResult<LinkPlan> {
    let (moved_groups, unlinked) = match kind {
        LinkedItemKind::Page => {
            let moved_groups = sqlx::query_as!(
                MovedGroup,
                "
SELECT DISTINCT g.id,
  g.course_language_group_id AS previous_course_language_group_id
FROM page_language_groups g
  JOIN pages p ON p.page_language_group_id = g.id
WHERE p.course_id = $1
  AND g.course_language_group_id <> $2
  AND NOT EXISTS (
    SELECT 1
    FROM pages o
      JOIN courses oc ON oc.id = o.course_id
    WHERE o.page_language_group_id = g.id
      AND o.deleted_at IS NULL
      AND oc.deleted_at IS NULL
      AND o.course_id <> ALL($3)
  )
                ",
                course_id,
                to_id,
                target_course_ids
            )
            .fetch_all(&mut *conn)
            .await?;
            let unlinked = sqlx::query_as!(
                UnlinkedItem,
                r#"
SELECT p.id,
  p.page_language_group_id AS "previous_group_id!",
  (p.deleted_at IS NULL) AS "is_live!"
FROM pages p
WHERE p.course_id = $1
  AND EXISTS (
    SELECT 1
    FROM pages o
      JOIN courses oc ON oc.id = o.course_id
    WHERE o.page_language_group_id = p.page_language_group_id
      AND o.deleted_at IS NULL
      AND oc.deleted_at IS NULL
      AND o.course_id <> ALL($2)
  )
                "#,
                course_id,
                target_course_ids
            )
            .fetch_all(conn)
            .await?;
            (moved_groups, unlinked)
        }
        LinkedItemKind::Exercise => {
            let moved_groups = sqlx::query_as!(
                MovedGroup,
                "
SELECT DISTINCT g.id,
  g.course_language_group_id AS previous_course_language_group_id
FROM exercise_language_groups g
  JOIN exercises e ON e.exercise_language_group_id = g.id
WHERE e.course_id = $1
  AND g.course_language_group_id <> $2
  AND NOT EXISTS (
    SELECT 1
    FROM exercises o
      JOIN courses oc ON oc.id = o.course_id
    WHERE o.exercise_language_group_id = g.id
      AND o.deleted_at IS NULL
      AND oc.deleted_at IS NULL
      AND o.course_id <> ALL($3)
  )
                ",
                course_id,
                to_id,
                target_course_ids
            )
            .fetch_all(&mut *conn)
            .await?;
            let unlinked = sqlx::query_as!(
                UnlinkedItem,
                r#"
SELECT e.id,
  e.exercise_language_group_id AS "previous_group_id!",
  (e.deleted_at IS NULL) AS "is_live!"
FROM exercises e
WHERE e.course_id = $1
  AND EXISTS (
    SELECT 1
    FROM exercises o
      JOIN courses oc ON oc.id = o.course_id
    WHERE o.exercise_language_group_id = e.exercise_language_group_id
      AND o.deleted_at IS NULL
      AND oc.deleted_at IS NULL
      AND o.course_id <> ALL($2)
  )
                "#,
                course_id,
                target_course_ids
            )
            .fetch_all(conn)
            .await?;
            (moved_groups, unlinked)
        }
    };
    Ok(LinkPlan {
        moved_groups,
        unlinked,
    })
}

/// Carries out the plan and returns the operation log payload. The caller holds the locks of
/// [lock_groups] on both groups and has created `to_group_id` if it is new.
async fn apply_move(
    conn: &mut PgConnection,
    plan: &MovePlan,
    to_group_id: Uuid,
) -> ModelResult<serde_json::Value> {
    // The course and its students' settings change groups in separate statements.
    sqlx::query!("SET CONSTRAINTS user_course_settings_current_course_group_fkey DEFERRED")
        .execute(&mut *conn)
        .await?;

    let mut removed_enrolment_settings = vec![];
    let removed_target_user_ids: Vec<Uuid> = plan
        .enrolment_conflicts
        .iter()
        .filter(|c| c.keeps_moved_course)
        .map(|c| c.user_id)
        .collect();
    let removed_moved_user_ids: Vec<Uuid> = plan
        .enrolment_conflicts
        .iter()
        .filter(|c| !c.keeps_moved_course)
        .map(|c| c.user_id)
        .collect();
    removed_enrolment_settings.extend(
        sqlx::query_scalar!(
            r#"
DELETE FROM user_course_settings
WHERE course_language_group_id = $1
  AND user_id = ANY($2)
RETURNING to_jsonb(user_course_settings.*) AS "row!"
            "#,
            to_group_id,
            &removed_target_user_ids
        )
        .fetch_all(&mut *conn)
        .await?,
    );
    removed_enrolment_settings.extend(
        sqlx::query_scalar!(
            r#"
DELETE FROM user_course_settings
WHERE current_course_id = $1
  AND user_id = ANY($2)
RETURNING to_jsonb(user_course_settings.*) AS "row!"
            "#,
            plan.course_id,
            &removed_moved_user_ids
        )
        .fetch_all(&mut *conn)
        .await?,
    );
    let removed_marketing_consents = sqlx::query_scalar!(
        r#"
DELETE FROM user_marketing_consents
WHERE id = ANY($1)
RETURNING to_jsonb(user_marketing_consents.*) AS "row!"
        "#,
        &plan.removed_consent_ids
    )
    .fetch_all(&mut *conn)
    .await?;

    sqlx::query!(
        "UPDATE courses SET course_language_group_id = $2 WHERE id = $1",
        plan.course_id,
        to_group_id
    )
    .execute(&mut *conn)
    .await?;
    let moved_enrolment_user_ids = sqlx::query_scalar!(
        "
UPDATE user_course_settings
SET course_language_group_id = $2
WHERE current_course_id = $1
RETURNING user_id
        ",
        plan.course_id,
        to_group_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let moved_consent_ids: Vec<Uuid> = plan.moved_consents.iter().map(|c| c.id).collect();
    sqlx::query!(
        "
UPDATE user_marketing_consents
SET course_language_group_id = $2
WHERE id = ANY($1)
        ",
        &moved_consent_ids,
        to_group_id
    )
    .execute(&mut *conn)
    .await?;

    let carried = if plan.is_from_group_emptied {
        move_group_wide_rows(&mut *conn, plan, to_group_id).await?
    } else {
        copy_group_wide_rows(&mut *conn, plan, to_group_id).await?
    };
    if !plan.dropped_token_ids.is_empty() {
        sqlx::query!(
            "
UPDATE marketing_mailing_list_access_tokens
SET deleted_at = now()
WHERE id = ANY($1)
            ",
            &plan.dropped_token_ids
        )
        .execute(&mut *conn)
        .await?;
    }

    let page_links =
        apply_link_plan(&mut *conn, LinkedItemKind::Page, &plan.pages, to_group_id).await?;
    let exercise_links = apply_link_plan(
        &mut *conn,
        LinkedItemKind::Exercise,
        &plan.exercises,
        to_group_id,
    )
    .await?;

    if plan.is_from_group_emptied {
        sqlx::query!(
            "UPDATE course_language_groups SET deleted_at = now() WHERE id = $1",
            plan.from_group_id
        )
        .execute(&mut *conn)
        .await?;
    }

    Ok(json!({
        "course_id": plan.course_id,
        "from_course_language_group_id": plan.from_group_id,
        "to_course_language_group_id": to_group_id,
        "from_course_language_group_deleted": plan.is_from_group_emptied,
        "moved_enrolment_settings_user_ids": moved_enrolment_user_ids,
        "enrolment_conflicts": plan.enrolment_conflicts,
        "removed_enrolment_settings": removed_enrolment_settings,
        "moved_marketing_consent_ids": moved_consent_ids,
        "removed_marketing_consents": removed_marketing_consents,
        "group_wide_rows": carried,
        "dropped_mailing_list_access_token_ids": plan.dropped_token_ids,
        "pages": page_links,
        "exercises": exercise_links,
    }))
}

/// The old group is emptied: its AI notice acknowledgements, tokens and tags move.
async fn move_group_wide_rows(
    conn: &mut PgConnection,
    plan: &MovePlan,
    to_group_id: Uuid,
) -> ModelResult<serde_json::Value> {
    sqlx::query!(
        "
UPDATE user_ai_usage_notice_acknowledgements
SET course_language_group_id = $2
WHERE id = ANY($1)
        ",
        &plan.carried_ack_ids,
        to_group_id
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        "
UPDATE marketing_mailing_list_access_tokens
SET course_language_group_id = $2
WHERE id = ANY($1)
        ",
        &plan.carried_token_ids,
        to_group_id
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        "
UPDATE mailchimp_course_tags
SET course_language_group_id = $2
WHERE id = ANY($1)
        ",
        &plan.carried_tag_ids,
        to_group_id
    )
    .execute(&mut *conn)
    .await?;
    Ok(json!({
        "mode": "moved",
        "ai_usage_notice_acknowledgement_ids": plan.carried_ack_ids,
        "mailing_list_access_token_ids": plan.carried_token_ids,
        "mailchimp_course_tag_ids": plan.carried_tag_ids,
    }))
}

/// The old group stays in use: the moved students' AI notice acknowledgements and the group's
/// mailing list (tokens, tags, language code mappings) are copied. Copied tokens name the moved
/// course.
async fn copy_group_wide_rows(
    conn: &mut PgConnection,
    plan: &MovePlan,
    to_group_id: Uuid,
) -> ModelResult<serde_json::Value> {
    let copied_ack_ids = sqlx::query_scalar!(
        "
INSERT INTO user_ai_usage_notice_acknowledgements (user_id, course_language_group_id, created_at)
SELECT user_id,
  $2,
  created_at
FROM user_ai_usage_notice_acknowledgements
WHERE id = ANY($1)
RETURNING id
        ",
        &plan.carried_ack_ids,
        to_group_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let new_token_ids: Vec<Uuid> = plan
        .carried_token_ids
        .iter()
        .map(|_| Uuid::new_v4())
        .collect();
    sqlx::query!(
        "
INSERT INTO marketing_mailing_list_access_tokens (
    id,
    course_id,
    course_language_group_id,
    server_prefix,
    access_token,
    mailchimp_mailing_list_id
  )
SELECT m.new_id,
  $3,
  $4,
  t.server_prefix,
  t.access_token,
  t.mailchimp_mailing_list_id
FROM UNNEST($1::uuid [], $2::uuid []) AS m(old_id, new_id)
  JOIN marketing_mailing_list_access_tokens t ON t.id = m.old_id
        ",
        &plan.carried_token_ids,
        &new_token_ids,
        plan.course_id,
        to_group_id
    )
    .execute(&mut *conn)
    .await?;
    let copied_tag_ids = sqlx::query_scalar!(
        "
INSERT INTO mailchimp_course_tags (
    marketing_mailing_list_access_token_id,
    course_language_group_id,
    tag_name,
    tag_id
  )
SELECT m.new_id,
  $3,
  g.tag_name,
  g.tag_id
FROM UNNEST($1::uuid [], $2::uuid []) AS m(old_id, new_id)
  JOIN mailchimp_course_tags g ON g.marketing_mailing_list_access_token_id = m.old_id
WHERE g.id = ANY($4)
RETURNING id
        ",
        &plan.carried_token_ids,
        &new_token_ids,
        to_group_id,
        &plan.carried_tag_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    sqlx::query!(
        "
INSERT INTO mailchimp_language_code_mappings (
    marketing_mailing_list_access_token_id,
    our_language_code,
    mailchimp_language_code
  )
SELECT m.new_id,
  x.our_language_code,
  x.mailchimp_language_code
FROM UNNEST($1::uuid [], $2::uuid []) AS m(old_id, new_id)
  JOIN mailchimp_language_code_mappings x ON x.marketing_mailing_list_access_token_id = m.old_id
WHERE x.deleted_at IS NULL
        ",
        &plan.carried_token_ids,
        &new_token_ids
    )
    .execute(&mut *conn)
    .await?;
    let token_copies: HashMap<Uuid, Uuid> = plan
        .carried_token_ids
        .iter()
        .copied()
        .zip(new_token_ids)
        .collect();
    Ok(json!({
        "mode": "copied",
        "copied_ai_usage_notice_acknowledgement_ids": copied_ack_ids,
        "copied_mailing_list_access_token_ids_by_source_id": token_copies,
        "copied_mailchimp_course_tag_ids": copied_tag_ids,
    }))
}

async fn apply_link_plan(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    link_plan: &LinkPlan,
    to_group_id: Uuid,
) -> ModelResult<serde_json::Value> {
    let moved_group_ids: Vec<Uuid> = link_plan.moved_groups.iter().map(|g| g.id).collect();
    let unlinked_ids: Vec<Uuid> = link_plan.unlinked.iter().map(|i| i.id).collect();
    let new_group_ids: Vec<Uuid> = link_plan.unlinked.iter().map(|_| Uuid::new_v4()).collect();
    match kind {
        LinkedItemKind::Page => {
            sqlx::query!(
                "
UPDATE page_language_groups
SET course_language_group_id = $2
WHERE id = ANY($1)
                ",
                &moved_group_ids,
                to_group_id
            )
            .execute(&mut *conn)
            .await?;
            sqlx::query!(
                "
INSERT INTO page_language_groups (id, course_language_group_id)
SELECT UNNEST($1::uuid []),
  $2
                ",
                &new_group_ids,
                to_group_id
            )
            .execute(&mut *conn)
            .await?;
            sqlx::query!(
                "
UPDATE pages p
SET page_language_group_id = m.group_id
FROM UNNEST($1::uuid [], $2::uuid []) AS m(item_id, group_id)
WHERE p.id = m.item_id
                ",
                &unlinked_ids,
                &new_group_ids
            )
            .execute(&mut *conn)
            .await?;
        }
        LinkedItemKind::Exercise => {
            sqlx::query!(
                "
UPDATE exercise_language_groups
SET course_language_group_id = $2
WHERE id = ANY($1)
                ",
                &moved_group_ids,
                to_group_id
            )
            .execute(&mut *conn)
            .await?;
            sqlx::query!(
                "
INSERT INTO exercise_language_groups (id, course_language_group_id)
SELECT UNNEST($1::uuid []),
  $2
                ",
                &new_group_ids,
                to_group_id
            )
            .execute(&mut *conn)
            .await?;
            sqlx::query!(
                "
UPDATE exercises e
SET exercise_language_group_id = m.group_id
FROM UNNEST($1::uuid [], $2::uuid []) AS m(item_id, group_id)
WHERE e.id = m.item_id
                ",
                &unlinked_ids,
                &new_group_ids
            )
            .execute(&mut *conn)
            .await?;
        }
    }
    let unlinked: Vec<serde_json::Value> = link_plan
        .unlinked
        .iter()
        .zip(&new_group_ids)
        .map(|(item, group_id)| {
            json!({
                "id": item.id,
                "group_id": group_id,
                "previous_group_id": item.previous_group_id,
            })
        })
        .collect();
    Ok(json!({
        "moved_groups": link_plan.moved_groups,
        "unlinked": unlinked,
    }))
}
