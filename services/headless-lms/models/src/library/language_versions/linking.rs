//! Links and unlinks pages and exercises across language versions by moving them between page
//! and exercise language groups. Links never change content or points.

use std::collections::{HashMap, HashSet};

use serde_json::json;

use super::invalid_request;
use super::operation_logs::{self, LanguageVersionOperation};
use super::types::{
    CounterpartLinkChange, CounterpartLinksResult, RemoveLeftoverLinksRequest,
    RemoveLeftoverLinksResult,
};
use crate::{exercise_language_groups, page_language_groups, prelude::*};

/// Whether links are between pages (page language groups) or exercises (exercise language groups).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinkedItemKind {
    Page,
    Exercise,
}

impl LinkedItemKind {
    fn link_operation(self) -> LanguageVersionOperation {
        match self {
            Self::Page => LanguageVersionOperation::LinkPages,
            Self::Exercise => LanguageVersionOperation::LinkExercises,
        }
    }

    fn unlink_operation(self) -> LanguageVersionOperation {
        match self {
            Self::Page => LanguageVersionOperation::UnlinkPages,
            Self::Exercise => LanguageVersionOperation::UnlinkExercises,
        }
    }
}

/// Applies the changes in order in one transaction and logs each change.
///
/// Fails with `InvalidRequest` (nothing changed) when an id is unknown, deleted or outside the
/// group, a link lists an id twice or two items of one course.
pub async fn apply_link_changes(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    course_language_group_id: Uuid,
    actor_user_id: Uuid,
    changes: &[CounterpartLinkChange],
) -> ModelResult<CounterpartLinksResult> {
    let mut tx = conn.begin().await?;
    let mut result = CounterpartLinksResult {
        linked_count: 0,
        unlinked_count: 0,
    };
    for change in changes {
        match change {
            CounterpartLinkChange::Link { ids } => {
                if link(&mut tx, kind, course_language_group_id, actor_user_id, ids).await? {
                    result.linked_count += 1;
                }
            }
            CounterpartLinkChange::Unlink { id } => {
                if unlink(&mut tx, kind, course_language_group_id, actor_user_id, *id).await? {
                    result.unlinked_count += 1;
                }
            }
        }
    }
    tx.commit().await?;
    Ok(result)
}

/// Makes exactly `ids` counterparts of each other; their former counterparts that are not listed
/// stay linked to one another. Returns false if they already were exactly that.
///
/// Call inside a transaction: on error the caller must roll back. Logs the change.
pub async fn link(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    course_language_group_id: Uuid,
    actor_user_id: Uuid,
    ids: &[Uuid],
) -> ModelResult<bool> {
    if ids.is_empty() {
        return Err(invalid_request("A link needs at least one item."));
    }
    if ids.iter().collect::<HashSet<_>>().len() != ids.len() {
        return Err(invalid_request("A link lists the same item twice."));
    }
    let items = lock_items(&mut *conn, kind, ids).await?;
    check_live_in_group(&items, ids, course_language_group_id)?;
    let mut courses = HashSet::new();
    if !items.iter().all(|item| courses.insert(item.course_id)) {
        return Err(invalid_request(
            "A link can have only one item from each language version.",
        ));
    }

    let listed: HashSet<Uuid> = ids.iter().copied().collect();
    let mut current_groups: Vec<Uuid> = items.iter().map(|item| item.group_id).collect();
    current_groups.sort();
    current_groups.dedup();
    // Locked before reading members so that items paired into a group concurrently are seen.
    let mut reusable: Option<(Uuid, usize)> = None;
    for group_id in &current_groups {
        lock_group(&mut *conn, kind, *group_id).await?;
        let members = group_members(&mut *conn, kind, *group_id).await?;
        let has_unlisted_live_member = members
            .iter()
            .any(|member| !member.is_deleted && !listed.contains(&member.id));
        if has_unlisted_live_member {
            continue;
        }
        let listed_count = members.iter().filter(|m| listed.contains(&m.id)).count();
        if reusable.is_none_or(|(_, best)| listed_count > best) {
            reusable = Some((*group_id, listed_count));
        }
    }

    let target_group_id = match reusable {
        Some((group_id, listed_count)) => {
            set_group_course_language_group(&mut *conn, kind, group_id, course_language_group_id)
                .await?;
            if listed_count == ids.len() {
                return Ok(false);
            }
            group_id
        }
        None => create_group(&mut *conn, kind, course_language_group_id).await?,
    };
    set_group(&mut *conn, kind, ids, target_group_id).await?;
    if group_has_several_items_of_a_course(&mut *conn, kind, target_group_id).await? {
        return Err(invalid_request(
            "Another item of the same language version was linked at the same time. Check again and retry.",
        ));
    }

    let previous_group_ids: HashMap<Uuid, Uuid> =
        items.iter().map(|item| (item.id, item.group_id)).collect();
    operation_logs::insert(
        conn,
        actor_user_id,
        kind.link_operation(),
        course_language_group_id,
        json!({
            "ids": ids,
            "group_id": target_group_id,
            "previous_group_ids": previous_group_ids,
        }),
    )
    .await?;
    Ok(true)
}

/// Leaves the item without counterparts by giving it a group of its own. Returns false if it had
/// none.
///
/// Call inside a transaction: on error the caller must roll back. Logs the change.
pub async fn unlink(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    course_language_group_id: Uuid,
    actor_user_id: Uuid,
    id: Uuid,
) -> ModelResult<bool> {
    let items = lock_items(&mut *conn, kind, &[id]).await?;
    check_live_in_group(&items, &[id], course_language_group_id)?;
    let previous_group_id = items[0].group_id;
    lock_group(&mut *conn, kind, previous_group_id).await?;
    let members = group_members(&mut *conn, kind, previous_group_id).await?;
    if members.iter().all(|member| member.id == id) {
        return Ok(false);
    }
    let group_id = create_group(&mut *conn, kind, course_language_group_id).await?;
    set_group(&mut *conn, kind, &[id], group_id).await?;
    operation_logs::insert(
        conn,
        actor_user_id,
        kind.unlink_operation(),
        course_language_group_id,
        json!({
            "id": id,
            "group_id": group_id,
            "previous_group_id": previous_group_id,
        }),
    )
    .await?;
    Ok(true)
}

/// Removes the links of the named deleted pages and exercises to the group's live ones, in one
/// transaction, and logs the change.
///
/// Fails with `InvalidRequest` (nothing changed) for an id that is unknown, not deleted or not
/// linked to a live item of the group.
pub async fn remove_leftover_links(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    actor_user_id: Uuid,
    request: &RemoveLeftoverLinksRequest,
) -> ModelResult<RemoveLeftoverLinksResult> {
    let mut tx = conn.begin().await?;
    let pages = detach_leftovers(
        &mut tx,
        LinkedItemKind::Page,
        course_language_group_id,
        &request.deleted_page_ids,
    )
    .await?;
    let exercises = detach_leftovers(
        &mut tx,
        LinkedItemKind::Exercise,
        course_language_group_id,
        &request.deleted_exercise_ids,
    )
    .await?;
    let removed_count = (pages.len() + exercises.len()) as i64;
    if removed_count > 0 {
        operation_logs::insert(
            &mut tx,
            actor_user_id,
            LanguageVersionOperation::RemoveLeftoverLinks,
            course_language_group_id,
            json!({ "pages": pages, "exercises": exercises }),
        )
        .await?;
    }
    tx.commit().await?;
    Ok(RemoveLeftoverLinksResult { removed_count })
}

#[derive(Debug, Serialize)]
struct DetachedLeftover {
    id: Uuid,
    group_id: Uuid,
    previous_group_id: Uuid,
}

async fn detach_leftovers(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    course_language_group_id: Uuid,
    ids: &[Uuid],
) -> ModelResult<Vec<DetachedLeftover>> {
    let mut ids = ids.to_vec();
    ids.sort();
    ids.dedup();
    let items = lock_items(&mut *conn, kind, &ids).await?;
    if items.len() != ids.len() {
        return Err(invalid_request("Some of the items don't exist."));
    }
    let mut detached = Vec::with_capacity(items.len());
    for item in items {
        if !item.is_deleted {
            return Err(invalid_request(
                "Only links to deleted items can be removed.",
            ));
        }
        lock_group(&mut *conn, kind, item.group_id).await?;
        if !group_has_live_item_in(&mut *conn, kind, item.group_id, course_language_group_id)
            .await?
        {
            return Err(invalid_request(
                "The deleted item is not linked to these language versions.",
            ));
        }
        let group_id = create_group(&mut *conn, kind, item.course_language_group_id).await?;
        set_group(&mut *conn, kind, &[item.id], group_id).await?;
        detached.push(DetachedLeftover {
            id: item.id,
            group_id,
            previous_group_id: item.group_id,
        });
    }
    Ok(detached)
}

fn check_live_in_group(
    items: &[LockedItem],
    ids: &[Uuid],
    course_language_group_id: Uuid,
) -> ModelResult<()> {
    if items.len() != ids.len() {
        return Err(invalid_request("Some of the items don't exist."));
    }
    if items.iter().any(|item| item.is_deleted) {
        return Err(invalid_request(
            "Deleted items can't be linked or unlinked.",
        ));
    }
    if items
        .iter()
        .any(|item| item.course_language_group_id != course_language_group_id)
    {
        return Err(invalid_request(
            "Some of the items are not in these language versions.",
        ));
    }
    Ok(())
}

struct LockedItem {
    id: Uuid,
    course_id: Uuid,
    /// Of the item's course.
    course_language_group_id: Uuid,
    group_id: Uuid,
    /// The item or its course is deleted.
    is_deleted: bool,
}

/// Locks the course pages or exercises with the ids, in id order. Unknown ids and exam items are
/// left out.
async fn lock_items(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    ids: &[Uuid],
) -> ModelResult<Vec<LockedItem>> {
    let items = match kind {
        LinkedItemKind::Page => {
            sqlx::query_as!(
                LockedItem,
                r#"
SELECT p.id,
  c.id AS course_id,
  c.course_language_group_id,
  p.page_language_group_id AS "group_id!",
  (
    p.deleted_at IS NOT NULL
    OR c.deleted_at IS NOT NULL
  ) AS "is_deleted!"
FROM pages p
  JOIN courses c ON c.id = p.course_id
WHERE p.id = ANY($1)
ORDER BY p.id
FOR UPDATE OF p
            "#,
                ids
            )
            .fetch_all(conn)
            .await?
        }
        LinkedItemKind::Exercise => {
            sqlx::query_as!(
                LockedItem,
                r#"
SELECT e.id,
  c.id AS course_id,
  c.course_language_group_id,
  e.exercise_language_group_id AS "group_id!",
  (
    e.deleted_at IS NOT NULL
    OR c.deleted_at IS NOT NULL
  ) AS "is_deleted!"
FROM exercises e
  JOIN courses c ON c.id = e.course_id
WHERE e.id = ANY($1)
ORDER BY e.id
FOR UPDATE OF e
            "#,
                ids
            )
            .fetch_all(conn)
            .await?
        }
    };
    Ok(items)
}

/// Not FOR UPDATE: items inserted into the group concurrently hold KEY SHARE on it through their
/// foreign key; see [page_language_groups::course_has_other_page].
async fn lock_group(conn: &mut PgConnection, kind: LinkedItemKind, id: Uuid) -> ModelResult<()> {
    match kind {
        LinkedItemKind::Page => {
            sqlx::query!(
                "SELECT id FROM page_language_groups WHERE id = $1 FOR NO KEY UPDATE",
                id
            )
            .fetch_optional(conn)
            .await?;
        }
        LinkedItemKind::Exercise => {
            sqlx::query!(
                "SELECT id FROM exercise_language_groups WHERE id = $1 FOR NO KEY UPDATE",
                id
            )
            .fetch_optional(conn)
            .await?;
        }
    }
    Ok(())
}

struct GroupMember {
    id: Uuid,
    is_deleted: bool,
}

/// Every course item in the group, of any course, deleted ones included.
async fn group_members(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    group_id: Uuid,
) -> ModelResult<Vec<GroupMember>> {
    let members = match kind {
        LinkedItemKind::Page => {
            sqlx::query_as!(
                GroupMember,
                r#"
SELECT p.id,
  (
    p.deleted_at IS NOT NULL
    OR c.deleted_at IS NOT NULL
  ) AS "is_deleted!"
FROM pages p
  JOIN courses c ON c.id = p.course_id
WHERE p.page_language_group_id = $1
            "#,
                group_id
            )
            .fetch_all(conn)
            .await?
        }
        LinkedItemKind::Exercise => {
            sqlx::query_as!(
                GroupMember,
                r#"
SELECT e.id,
  (
    e.deleted_at IS NOT NULL
    OR c.deleted_at IS NOT NULL
  ) AS "is_deleted!"
FROM exercises e
  JOIN courses c ON c.id = e.course_id
WHERE e.exercise_language_group_id = $1
            "#,
                group_id
            )
            .fetch_all(conn)
            .await?
        }
    };
    Ok(members)
}

async fn create_group(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    course_language_group_id: Uuid,
) -> ModelResult<Uuid> {
    match kind {
        LinkedItemKind::Page => {
            page_language_groups::insert(conn, PKeyPolicy::Generate, course_language_group_id).await
        }
        LinkedItemKind::Exercise => {
            exercise_language_groups::insert(conn, PKeyPolicy::Generate, course_language_group_id)
                .await
        }
    }
}

async fn set_group(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    ids: &[Uuid],
    group_id: Uuid,
) -> ModelResult<()> {
    match kind {
        LinkedItemKind::Page => {
            sqlx::query!(
                "UPDATE pages SET page_language_group_id = $2 WHERE id = ANY($1)",
                ids,
                group_id
            )
            .execute(conn)
            .await?;
        }
        LinkedItemKind::Exercise => {
            sqlx::query!(
                "UPDATE exercises SET exercise_language_group_id = $2 WHERE id = ANY($1)",
                ids,
                group_id
            )
            .execute(conn)
            .await?;
        }
    }
    Ok(())
}

async fn set_group_course_language_group(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    group_id: Uuid,
    course_language_group_id: Uuid,
) -> ModelResult<()> {
    match kind {
        LinkedItemKind::Page => {
            sqlx::query!(
                "
UPDATE page_language_groups
SET course_language_group_id = $2
WHERE id = $1
  AND course_language_group_id <> $2
                ",
                group_id,
                course_language_group_id
            )
            .execute(conn)
            .await?;
        }
        LinkedItemKind::Exercise => {
            sqlx::query!(
                "
UPDATE exercise_language_groups
SET course_language_group_id = $2
WHERE id = $1
  AND course_language_group_id <> $2
                ",
                group_id,
                course_language_group_id
            )
            .execute(conn)
            .await?;
        }
    }
    Ok(())
}

/// The one-item-per-course-per-group rule, which the database doesn't enforce yet.
async fn group_has_several_items_of_a_course(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    group_id: Uuid,
) -> ModelResult<bool> {
    let res = match kind {
        LinkedItemKind::Page => {
            sqlx::query_scalar!(
                r#"
SELECT EXISTS (
    SELECT 1
    FROM pages
    WHERE page_language_group_id = $1
      AND course_id IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY course_id
    HAVING COUNT(*) > 1
  ) AS "exists!"
            "#,
                group_id
            )
            .fetch_one(conn)
            .await?
        }
        LinkedItemKind::Exercise => {
            sqlx::query_scalar!(
                r#"
SELECT EXISTS (
    SELECT 1
    FROM exercises
    WHERE exercise_language_group_id = $1
      AND course_id IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY course_id
    HAVING COUNT(*) > 1
  ) AS "exists!"
            "#,
                group_id
            )
            .fetch_one(conn)
            .await?
        }
    };
    Ok(res)
}

async fn group_has_live_item_in(
    conn: &mut PgConnection,
    kind: LinkedItemKind,
    group_id: Uuid,
    course_language_group_id: Uuid,
) -> ModelResult<bool> {
    let res = match kind {
        LinkedItemKind::Page => {
            sqlx::query_scalar!(
                r#"
SELECT EXISTS (
    SELECT 1
    FROM pages p
      JOIN courses c ON c.id = p.course_id
    WHERE p.page_language_group_id = $1
      AND c.course_language_group_id = $2
      AND p.deleted_at IS NULL
      AND c.deleted_at IS NULL
  ) AS "exists!"
            "#,
                group_id,
                course_language_group_id
            )
            .fetch_one(conn)
            .await?
        }
        LinkedItemKind::Exercise => {
            sqlx::query_scalar!(
                r#"
SELECT EXISTS (
    SELECT 1
    FROM exercises e
      JOIN courses c ON c.id = e.course_id
    WHERE e.exercise_language_group_id = $1
      AND c.course_language_group_id = $2
      AND e.deleted_at IS NULL
      AND c.deleted_at IS NULL
  ) AS "exists!"
            "#,
                group_id,
                course_language_group_id
            )
            .fetch_one(conn)
            .await?
        }
    };
    Ok(res)
}
