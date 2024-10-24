use std::collections::HashMap;

use serde_json::Value;

use crate::course_instances;
use crate::course_instances::NewCourseInstance;
use crate::course_language_groups;
use crate::courses::get_course;
use crate::courses::Course;
use crate::courses::NewCourse;
use crate::exams;
use crate::exams::Exam;
use crate::exams::NewExam;
use crate::pages;
use crate::prelude::*;

use crate::ModelResult;

pub async fn copy_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    new_course: &NewCourse,
    same_language_group: bool,
    user_id: Uuid,
) -> ModelResult<Course> {
    let parent_course = get_course(conn, course_id).await?;

    let mut tx = conn.begin().await?;

    let course_language_group_id = if same_language_group {
        parent_course.course_language_group_id
    } else {
        course_language_groups::insert(&mut tx, PKeyPolicy::Generate).await?
    };

    // Create new course.
    let copied_course = sqlx::query_as!(
        Course,
        "
INSERT INTO courses (
    name,
    organization_id,
    slug,
    content_search_language,
    language_code,
    copied_from,
    course_language_group_id,
    is_draft,
    base_module_completion_requires_n_submodule_completions,
    can_add_chatbot,
    is_unlisted,
    is_joinable_by_code_only,
    join_code,
    ask_marketing_consent
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language::text,
  language_code,
  copied_from,
  course_language_group_id,
  description,
  is_draft,
  is_test_mode,
  base_module_completion_requires_n_submodule_completions,
  can_add_chatbot,
  is_unlisted,
  is_joinable_by_code_only,
  join_code,
  ask_marketing_consent
    ",
        new_course.name,
        new_course.organization_id,
        new_course.slug,
        parent_course.content_search_language as _,
        new_course.language_code,
        parent_course.id,
        course_language_group_id,
        new_course.is_draft,
        parent_course.base_module_completion_requires_n_submodule_completions,
        parent_course.can_add_chatbot,
        new_course.is_unlisted,
        new_course.is_joinable_by_code_only,
        new_course.join_code,
        new_course.ask_marketing_consent
    )
    .fetch_one(&mut *tx)
    .await?;

    copy_course_modules(&mut tx, copied_course.id, course_id).await?;

    copy_course_chapters(&mut tx, copied_course.id, course_id).await?;

    if new_course.copy_user_permissions {
        copy_user_permissions(&mut tx, copied_course.id, course_id, user_id).await?;
    }

    // Copy course pages. At this point, exercise ids in content will point to old course's exercises.
    let contents_iter =
        copy_course_pages_and_return_contents(&mut tx, copied_course.id, course_id).await?;

    set_chapter_front_pages(&mut tx, copied_course.id).await?;

    // Copy course exercises
    let old_to_new_exercise_ids =
        map_old_exr_ids_to_new_exr_ids_for_courses(&mut tx, copied_course.id, course_id).await?;

    // Replace exercise ids in page contents.
    for (page_id, content) in contents_iter {
        if let Value::Array(mut blocks) = content {
            for block in blocks.iter_mut() {
                if block["name"] != Value::String("moocfi/exercise".to_string()) {
                    continue;
                }
                if let Value::String(old_id) = &block["attributes"]["id"] {
                    let new_id = old_to_new_exercise_ids
                        .get(old_id)
                        .ok_or_else(|| {
                            ModelError::new(
                                ModelErrorType::Generic,
                                "Invalid exercise id in content.".to_string(),
                                None,
                            )
                        })?
                        .to_string();
                    block["attributes"]["id"] = Value::String(new_id);
                }
            }
            sqlx::query!(
                "
UPDATE pages
SET content = $1
WHERE id = $2;
                ",
                Value::Array(blocks),
                page_id,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    let pages_contents: HashMap<Uuid, Value> = crate::pages::get_all_by_course_id_and_visibility(
        tx.as_mut(),
        copied_course.id,
        pages::PageVisibility::Any,
    )
    .await
    .unwrap()
    .into_iter()
    .map(|page| (page.id, page.content))
    .collect();

    // Replace course slugs from internal links in page contents
    for (page_id, content) in pages_contents {
        if let Value::Array(mut blocks) = content {
            for block in blocks.iter_mut() {
                let content = block["attributes"]["content"].as_str();

                if let Some(content) = content {
                    if content.contains("<a href=") {
                        let content_with_new_slug = content.replace(
                            &parent_course.slug.to_string(),
                            &new_course.slug.to_string(),
                        );
                        block["attributes"]["content"] = Value::String(content_with_new_slug);
                    }
                }
            }
            sqlx::query!(
                "
UPDATE pages
SET content = $1
WHERE id = $2;
                ",
                Value::Array(blocks),
                page_id,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    copy_exercise_slides(&mut tx, copied_course.id, course_id).await?;

    copy_exercise_tasks(&mut tx, copied_course.id, course_id).await?;
    // Create default instance for copied course.
    course_instances::insert(
        &mut tx,
        PKeyPolicy::Generate,
        NewCourseInstance {
            course_id: copied_course.id,
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: &new_course.teacher_in_charge_name,
            teacher_in_charge_email: &new_course.teacher_in_charge_email,
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;

    copy_peer_or_self_review_configs(&mut tx, copied_course.id, course_id).await?;

    copy_material_references(&mut tx, copied_course.id, course_id).await?;

    tx.commit().await?;
    Ok(copied_course)
}

pub async fn copy_exam(
    conn: &mut PgConnection,
    parent_exam_id: &Uuid,
    new_exam: &NewExam,
) -> ModelResult<Exam> {
    let parent_exam = exams::get(conn, *parent_exam_id).await?;

    let mut tx = conn.begin().await?;

    let parent_exam_fields = sqlx::query!(
        "
SELECT language,
  organization_id,
  minimum_points_treshold
FROM exams
WHERE id = $1
        ",
        parent_exam.id
    )
    .fetch_one(&mut *tx)
    .await?;

    // create new exam
    let copied_exam = sqlx::query!(
        "
INSERT INTO exams(
    name,
    organization_id,
    instructions,
    starts_at,
    ends_at,
    language,
    time_minutes,
    minimum_points_treshold,
    grade_manually
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *
        ",
        new_exam.name,
        parent_exam_fields.organization_id,
        parent_exam.instructions,
        new_exam.starts_at,
        new_exam.ends_at,
        parent_exam_fields.language,
        new_exam.time_minutes,
        parent_exam_fields.minimum_points_treshold,
        new_exam.grade_manually,
    )
    .fetch_one(&mut *tx)
    .await?;

    let contents_iter =
        copy_exam_pages_and_return_contents(&mut tx, copied_exam.id, parent_exam.id).await?;

    // Copy exam exercises
    let old_to_new_exercise_ids =
        map_old_exr_ids_to_new_exr_ids_for_exams(&mut tx, copied_exam.id, parent_exam.id).await?;

    // Replace exercise ids in page contents.
    for (page_id, content) in contents_iter {
        if let Value::Array(mut blocks) = content {
            for block in blocks.iter_mut() {
                if block["name"] != Value::String("moocfi/exercise".to_string()) {
                    continue;
                }
                if let Value::String(old_id) = &block["attributes"]["id"] {
                    let new_id = old_to_new_exercise_ids
                        .get(old_id)
                        .ok_or_else(|| {
                            ModelError::new(
                                ModelErrorType::Generic,
                                "Invalid exercise id in content.".to_string(),
                                None,
                            )
                        })?
                        .to_string();
                    block["attributes"]["id"] = Value::String(new_id);
                }
            }
            sqlx::query!(
                "
UPDATE pages
SET content = $1
WHERE id = $2;
                ",
                Value::Array(blocks),
                page_id,
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    copy_exercise_slides(&mut tx, copied_exam.id, parent_exam.id).await?;

    copy_exercise_tasks(&mut tx, copied_exam.id, parent_exam.id).await?;

    tx.commit().await?;

    let get_page_id = sqlx::query!(
        "SELECT id AS page_id FROM pages WHERE exam_id = $1;",
        copied_exam.id
    )
    .fetch_one(conn)
    .await?;

    Ok(Exam {
        courses: vec![], // no related courses on newly copied exam
        ends_at: copied_exam.ends_at,
        starts_at: copied_exam.starts_at,
        id: copied_exam.id,
        instructions: copied_exam.instructions,
        name: copied_exam.name,
        time_minutes: copied_exam.time_minutes,
        page_id: get_page_id.page_id,
        minimum_points_treshold: copied_exam.minimum_points_treshold,
        language: copied_exam.language.unwrap_or("en-US".to_string()),
        grade_manually: copied_exam.grade_manually,
    })
}

async fn copy_course_pages_and_return_contents(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_course_id: Uuid,
) -> ModelResult<HashMap<Uuid, Value>> {
    // Copy course pages. At this point, exercise ids in content will point to old course's exercises.
    let contents = sqlx::query!(
        "
    INSERT INTO pages (
        id,
        course_id,
        content,
        url_path,
        title,
        chapter_id,
        order_number,
        copied_from,
        content_search_language,
        page_language_group_id
      )
    SELECT uuid_generate_v5($1, id::text),
      $1,
      content,
      url_path,
      title,
      uuid_generate_v5($1, chapter_id::text),
      order_number,
      id,
      content_search_language,
      page_language_group_id
    FROM pages
    WHERE (course_id = $2)
    AND deleted_at IS NULL
    RETURNING id,
      content;
        ",
        namespace_id,
        parent_course_id
    )
    .fetch_all(tx)
    .await?
    .into_iter()
    .map(|record| (record.id, record.content))
    .collect();

    Ok(contents)
}

async fn copy_exam_pages_and_return_contents(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_exam_id: Uuid,
) -> ModelResult<HashMap<Uuid, Value>> {
    let contents = sqlx::query!(
        "
    INSERT INTO pages (
        id,
        exam_id,
        content,
        url_path,
        title,
        chapter_id,
        order_number,
        copied_from,
        content_search_language
      )
    SELECT uuid_generate_v5($1, id::text),
      $1,
      content,
      url_path,
      title,
      uuid_generate_v5($1, chapter_id::text),
      order_number,
      id,
      content_search_language
    FROM pages
    WHERE (exam_id = $2)
    AND deleted_at IS NULL
    RETURNING id,
      content;
        ",
        namespace_id,
        parent_exam_id
    )
    .fetch_all(tx)
    .await?
    .into_iter()
    .map(|record| (record.id, record.content))
    .collect();

    Ok(contents)
}

async fn set_chapter_front_pages(tx: &mut PgConnection, namespace_id: Uuid) -> ModelResult<()> {
    // Update front_page_id of chapters now that new pages exist.
    sqlx::query!(
        "
    UPDATE chapters
    SET front_page_id = uuid_generate_v5(course_id, front_page_id::text)
    WHERE course_id = $1
        AND front_page_id IS NOT NULL;
            ",
        namespace_id,
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

async fn copy_course_modules(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_modules (
    id,
    course_id,
    name,
    order_number,
    copied_from
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  name,
  order_number,
  id
FROM course_modules
WHERE course_id = $2
  AND deleted_at IS NULL
        ",
        new_course_id,
        old_course_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

/// After this one `set_chapter_front_pages` needs to be called to get these to point to the correct front pages.
async fn copy_course_chapters(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO chapters (
    id,
    name,
    course_id,
    chapter_number,
    front_page_id,
    opens_at,
    chapter_image_path,
    copied_from,
    course_module_id
  )
SELECT uuid_generate_v5($1, id::text),
  name,
  $1,
  chapter_number,
  front_page_id,
  opens_at,
  chapter_image_path,
  id,
  uuid_generate_v5($1, course_module_id::text)
FROM chapters
WHERE (course_id = $2)
AND deleted_at IS NULL;
    ",
        namespace_id,
        parent_course_id
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

async fn map_old_exr_ids_to_new_exr_ids_for_courses(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_course_id: Uuid,
) -> ModelResult<HashMap<String, String>> {
    let old_to_new_exercise_ids = sqlx::query!(
        "
INSERT INTO exercises (
    id,
    course_id,
    name,
    deadline,
    page_id,
    score_maximum,
    order_number,
    chapter_id,
    copied_from,
    exercise_language_group_id,
    max_tries_per_slide,
    limit_number_of_tries,
    needs_peer_review,
    use_course_default_peer_or_self_review_config
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  name,
  deadline,
  uuid_generate_v5($1, page_id::text),
  score_maximum,
  order_number,
  uuid_generate_v5($1, chapter_id::text),
  id,
  exercise_language_group_id,
  max_tries_per_slide,
  limit_number_of_tries,
  needs_peer_review,
  use_course_default_peer_or_self_review_config
FROM exercises
WHERE course_id = $2
  AND deleted_at IS NULL
RETURNING id,
  copied_from;
            ",
        namespace_id,
        parent_course_id
    )
    .fetch_all(tx)
    .await?
    .into_iter()
    .map(|record| {
        Ok((
            record
                .copied_from
                .ok_or_else(|| {
                    ModelError::new(
                        ModelErrorType::Generic,
                        "Query failed to return valid data.".to_string(),
                        None,
                    )
                })?
                .to_string(),
            record.id.to_string(),
        ))
    })
    .collect::<ModelResult<HashMap<String, String>>>()?;

    Ok(old_to_new_exercise_ids)
}

async fn map_old_exr_ids_to_new_exr_ids_for_exams(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_exam_id: Uuid,
) -> ModelResult<HashMap<String, String>> {
    let old_to_new_exercise_ids = sqlx::query!(
        "
INSERT INTO exercises (
    id,
    exam_id,
    name,
    deadline,
    page_id,
    score_maximum,
    order_number,
    chapter_id,
    copied_from,
    max_tries_per_slide,
    limit_number_of_tries,
    needs_peer_review,
    use_course_default_peer_or_self_review_config
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  name,
  deadline,
  uuid_generate_v5($1, page_id::text),
  score_maximum,
  order_number,
  uuid_generate_v5($1, chapter_id::text),
  id,
  max_tries_per_slide,
  limit_number_of_tries,
  needs_peer_review,
  use_course_default_peer_or_self_review_config
FROM exercises
WHERE exam_id = $2
  AND deleted_at IS NULL
RETURNING id,
  copied_from;
            ",
        namespace_id,
        parent_exam_id
    )
    .fetch_all(tx)
    .await?
    .into_iter()
    .map(|record| {
        Ok((
            record
                .copied_from
                .ok_or_else(|| {
                    ModelError::new(
                        ModelErrorType::Generic,
                        "Query failed to return valid data.".to_string(),
                        None,
                    )
                })?
                .to_string(),
            record.id.to_string(),
        ))
    })
    .collect::<ModelResult<HashMap<String, String>>>()?;

    Ok(old_to_new_exercise_ids)
}

async fn copy_exercise_slides(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    // Copy exercise slides
    sqlx::query!(
        "
    INSERT INTO exercise_slides (
        id, exercise_id, order_number
    )
    SELECT uuid_generate_v5($1, id::text),
        uuid_generate_v5($1, exercise_id::text),
        order_number
    FROM exercise_slides
    WHERE exercise_id IN (SELECT id FROM exercises WHERE course_id = $2 OR exam_id = $2 AND deleted_at IS NULL)
    AND deleted_at IS NULL;
            ",
        namespace_id,
        parent_id
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

async fn copy_exercise_tasks(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    // Copy exercise tasks
    sqlx::query!(
        "
INSERT INTO exercise_tasks (
    id,
    exercise_slide_id,
    exercise_type,
    assignment,
    private_spec,
    public_spec,
    model_solution_spec,
    order_number,
    copied_from
  )
SELECT uuid_generate_v5($1, id::text),
  uuid_generate_v5($1, exercise_slide_id::text),
  exercise_type,
  assignment,
  private_spec,
  public_spec,
  model_solution_spec,
  order_number,
  id
FROM exercise_tasks
WHERE exercise_slide_id IN (
    SELECT s.id
    FROM exercise_slides s
      JOIN exercises e ON (e.id = s.exercise_id)
    WHERE e.course_id = $2 OR e.exam_id = $2
    AND e.deleted_at IS NULL
    AND s.deleted_at IS NULL
  )
AND deleted_at IS NULL;
    ",
        namespace_id,
        parent_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

pub async fn copy_user_permissions(
    conn: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO roles (
    id,
    user_id,
    organization_id,
    course_id,
    role
  )
SELECT uuid_generate_v5($2, id::text),
  user_id,
  organization_id,
  $2,
  role
FROM roles
WHERE (course_id = $1)
AND NOT (user_id = $3)
AND deleted_at IS NULL;
    ",
        old_course_id,
        new_course_id,
        user_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

async fn copy_peer_or_self_review_configs(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    // Copy exercise tasks
    sqlx::query!(
        "
INSERT INTO peer_or_self_review_configs (
    id,
    course_id,
    exercise_id,
    peer_reviews_to_give,
    peer_reviews_to_receive,
    processing_strategy,
    accepting_threshold
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  uuid_generate_v5($1, exercise_id::text),
  peer_reviews_to_give,
  peer_reviews_to_receive,
  processing_strategy,
  accepting_threshold
FROM peer_or_self_review_configs
WHERE course_id = $2
AND deleted_at IS NULL;
    ",
        namespace_id,
        parent_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_material_references(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    // Copy material references
    sqlx::query!(
        "
INSERT INTO material_references (
    citation_key,
    course_id,
    id,
    reference
)
SELECT citation_key,
  $1,
  uuid_generate_v5($1, id::text),
  reference
FROM material_references
WHERE course_id = $2
AND deleted_at IS NULL;
    ",
        namespace_id,
        parent_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    mod course_copying {
        use pretty_assertions::assert_eq;

        use super::*;
        use crate::{exercise_tasks::ExerciseTask, pages::Page, test_helper::*};

        #[tokio::test]
        async fn copies_course_as_different_course_language_group() {
            insert_data!(:tx, :user, :org, :course);
            let course = crate::courses::get_course(tx.as_mut(), course)
                .await
                .unwrap();
            let new_course = create_new_course(org, "en-US".to_string());
            let copied_course = copy_course(tx.as_mut(), course.id, &new_course, false, user)
                .await
                .unwrap();
            assert_eq!(copied_course.name, "Copied course".to_string());
            assert_eq!(copied_course.copied_from, Some(course.id));
            assert_ne!(course.id, copied_course.id);
            assert_ne!(
                course.course_language_group_id,
                copied_course.course_language_group_id
            );
        }

        #[tokio::test]
        async fn copies_course_as_same_course_language_group() {
            insert_data!(:tx, :user, :org, :course);
            let course = crate::courses::get_course(tx.as_mut(), course)
                .await
                .unwrap();
            let new_course = create_new_course(org, "fi-FI".to_string());
            let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
                .await
                .unwrap();
            assert_eq!(copied_course.name, "Copied course".to_string());
            assert_eq!(copied_course.copied_from, Some(course.id));
            assert_ne!(course.id, copied_course.id);
            assert_eq!(
                course.course_language_group_id,
                copied_course.course_language_group_id
            );
        }

        #[tokio::test]
        async fn copies_course_instances() {
            insert_data!(:tx, :user, :org, :course, instance: _instance);
            let course = crate::courses::get_course(tx.as_mut(), course)
                .await
                .unwrap();
            let new_course = create_new_course(org, "en-GB".to_string());
            let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
                .await
                .unwrap();
            let copied_instances = crate::course_instances::get_course_instances_for_course(
                tx.as_mut(),
                copied_course.id,
            )
            .await
            .unwrap();
            assert_eq!(copied_instances.len(), 1);
            // Instances are missing the copied_from record.
        }

        #[tokio::test]
        async fn copies_course_modules() {
            insert_data!(:tx, :user, :org, :course);
            let course = crate::courses::get_course(tx.as_mut(), course)
                .await
                .unwrap();
            let new_course = create_new_course(org, "pt-BR".to_string());
            let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
                .await
                .unwrap();

            let original_modules = crate::course_modules::get_by_course_id(tx.as_mut(), course.id)
                .await
                .unwrap();
            let copied_modules =
                crate::course_modules::get_by_course_id(tx.as_mut(), copied_course.id)
                    .await
                    .unwrap();
            assert_eq!(
                original_modules.first().unwrap().id,
                copied_modules.first().unwrap().copied_from.unwrap(),
            )
        }

        #[tokio::test]
        async fn copies_course_chapters() {
            insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter);
            let course = crate::courses::get_course(tx.as_mut(), course)
                .await
                .unwrap();
            let new_course = create_new_course(org, "sv-SV".to_string());
            let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
                .await
                .unwrap();
            let copied_chapters = crate::chapters::course_chapters(tx.as_mut(), copied_course.id)
                .await
                .unwrap();
            assert_eq!(copied_chapters.len(), 1);
            assert_eq!(copied_chapters.first().unwrap().copied_from, Some(chapter));
        }

        #[tokio::test]
        async fn updates_chapter_front_pages() {
            insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, chapter: _chapter);
            let course = crate::courses::get_course(tx.as_mut(), course)
                .await
                .unwrap();
            let new_course = create_new_course(org, "fr-CA".to_string());
            let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
                .await
                .unwrap();
            let copied_chapters = crate::chapters::course_chapters(tx.as_mut(), copied_course.id)
                .await
                .unwrap();
            let copied_chapter = copied_chapters.first().unwrap();
            let copied_chapter_front_page =
                crate::pages::get_page(tx.as_mut(), copied_chapter.front_page_id.unwrap())
                    .await
                    .unwrap();
            assert_eq!(copied_chapter_front_page.course_id, Some(copied_course.id));
        }

        #[tokio::test]
        async fn copies_course_pages() {
            insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter, page: _page);
            let course = crate::courses::get_course(tx.as_mut(), course)
                .await
                .unwrap();
            let new_course = create_new_course(org, "es-US".to_string());
            let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
                .await
                .unwrap();
            let mut original_pages_by_id: HashMap<Uuid, Page> =
                crate::pages::get_all_by_course_id_and_visibility(
                    tx.as_mut(),
                    course.id,
                    crate::pages::PageVisibility::Any,
                )
                .await
                .unwrap()
                .into_iter()
                .map(|page| (page.id, page))
                .collect();
            assert_eq!(original_pages_by_id.len(), 3);
            let copied_pages = crate::pages::get_all_by_course_id_and_visibility(
                tx.as_mut(),
                copied_course.id,
                crate::pages::PageVisibility::Any,
            )
            .await
            .unwrap();
            // Creating a course and a chapter both lead to an additional page being created.
            assert_eq!(copied_pages.len(), 3);
            copied_pages.into_iter().for_each(|copied_page| {
                assert!(original_pages_by_id
                    .remove(&copied_page.copied_from.unwrap())
                    .is_some());
            });
            assert!(original_pages_by_id.is_empty());
        }

        #[tokio::test]
        async fn updates_course_slugs_in_internal_links_in_pages_contents() {
            insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter, :page);
            let course = crate::courses::get_course(tx.as_mut(), course)
                .await
                .unwrap();
            crate::pages::update_page_content(
                tx.as_mut(),
                page,
                &serde_json::json!([{
                    "name": "core/paragraph",
                    "isValid": true,
                    "clientId": "b2ecb473-38cc-4df1-84f7-45709cc63e95",
                    "attributes": {
                        "content": format!("Internal link <a href=\"http://project-331.local/org/uh-cs/courses/{slug2}\">http://project-331.local/org/uh-cs/courses/{slug1}</a>", slug2 = course.slug, slug1 = course.slug)
                        ,
                        "dropCap":false
                    },
                    "innerBlocks": []
                }]),
            )
            .await
            .unwrap();

            let new_course = create_new_course(org, "fi-FI".to_string());
            let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
                .await
                .unwrap();

            let copied_pages = crate::pages::get_all_by_course_id_and_visibility(
                tx.as_mut(),
                copied_course.id,
                crate::pages::PageVisibility::Any,
            )
            .await
            .unwrap();
            let copied_page = copied_pages
                .into_iter()
                .find(|copied_page| copied_page.copied_from == Some(page))
                .unwrap();
            let copied_content_in_page = copied_page.content[0]["attributes"]["content"]
                .as_str()
                .unwrap();
            let content_with_updated_course_slug =
            "Internal link <a href=\"http://project-331.local/org/uh-cs/courses/copied-course\">http://project-331.local/org/uh-cs/courses/copied-course</a>";
            assert_eq!(copied_content_in_page, content_with_updated_course_slug);
        }
        #[tokio::test]
        async fn updates_exercise_id_in_content() {
            insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter, :page, :exercise);
            let course = crate::courses::get_course(tx.as_mut(), course)
                .await
                .unwrap();
            crate::pages::update_page_content(
                tx.as_mut(),
                page,
                &serde_json::json!([{
                    "name": "moocfi/exercise",
                    "isValid": true,
                    "clientId": "b2ecb473-38cc-4df1-84f7-06709cc63e95",
                    "attributes": {
                        "id": exercise,
                        "name": "Exercise"
                    },
                    "innerBlocks": []
                }]),
            )
            .await
            .unwrap();
            let new_course = create_new_course(org, "es-MX".to_string());
            let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
                .await
                .unwrap();
            let copied_pages = crate::pages::get_all_by_course_id_and_visibility(
                tx.as_mut(),
                copied_course.id,
                crate::pages::PageVisibility::Any,
            )
            .await
            .unwrap();
            let copied_page = copied_pages
                .into_iter()
                .find(|copied_page| copied_page.copied_from == Some(page))
                .unwrap();
            let copied_exercise_id_in_content =
                Uuid::parse_str(copied_page.content[0]["attributes"]["id"].as_str().unwrap())
                    .unwrap();
            let copied_exercise =
                crate::exercises::get_by_id(tx.as_mut(), copied_exercise_id_in_content)
                    .await
                    .unwrap();
            assert_eq!(copied_exercise.course_id.unwrap(), copied_course.id);
        }

        #[tokio::test]
        async fn copies_exercises_tasks_and_slides() {
            insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter, :page, :exercise, :slide, :task);
            let course = crate::courses::get_course(tx.as_mut(), course)
                .await
                .unwrap();
            let new_course = create_new_course(org, "fi-SV".to_string());
            let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
                .await
                .unwrap();
            let copied_exercises =
                crate::exercises::get_exercises_by_course_id(tx.as_mut(), copied_course.id)
                    .await
                    .unwrap();
            assert_eq!(copied_exercises.len(), 1);
            let copied_exercise = copied_exercises.first().unwrap();
            assert_eq!(copied_exercise.copied_from, Some(exercise));
            let original_exercise = crate::exercises::get_by_id(tx.as_mut(), exercise)
                .await
                .unwrap();
            // Assert some important fields are copied correctly.
            assert_eq!(
                copied_exercise.max_tries_per_slide,
                original_exercise.max_tries_per_slide
            );
            assert_eq!(
                copied_exercise.limit_number_of_tries,
                original_exercise.limit_number_of_tries
            );
            assert_eq!(
                copied_exercise.needs_peer_review,
                original_exercise.needs_peer_review
            );
            assert_eq!(
                copied_exercise.use_course_default_peer_or_self_review_config,
                original_exercise.use_course_default_peer_or_self_review_config
            );
            let copied_slides = crate::exercise_slides::get_exercise_slides_by_exercise_id(
                tx.as_mut(),
                copied_exercise.id,
            )
            .await
            .unwrap();
            assert_eq!(copied_slides.len(), 1);
            let copied_slide = copied_slides.first().unwrap();
            // Exercise slides don't have copied_from field
            let copied_tasks: Vec<ExerciseTask> =
                crate::exercise_tasks::get_exercise_tasks_by_exercise_slide_id(
                    tx.as_mut(),
                    &copied_slide.id,
                )
                .await
                .unwrap();
            assert_eq!(copied_tasks.len(), 1);
            let copied_task = copied_tasks.first().unwrap();
            assert_eq!(copied_task.copied_from, Some(task));

            // Make sure we don't have the bug where the chapter id pointed to the old chapter in the exercises.
            let original_course_chapters = crate::chapters::course_chapters(tx.as_mut(), course.id)
                .await
                .unwrap();
            for original_chapter in original_course_chapters {
                for copied_exercise in &copied_exercises {
                    assert_ne!(original_chapter.id, copied_exercise.id);
                }
            }
        }

        fn create_new_course(organization_id: Uuid, language_code: String) -> NewCourse {
            NewCourse {
                name: "Copied course".to_string(),
                slug: "copied-course".to_string(),
                organization_id,
                language_code,
                teacher_in_charge_name: "Teacher".to_string(),
                teacher_in_charge_email: "teacher@example.com".to_string(),
                description: "".to_string(),
                is_draft: true,
                is_test_mode: false,
                is_unlisted: false,
                copy_user_permissions: false,
                is_joinable_by_code_only: false,
                join_code: None,
                ask_marketing_consent: false,
            }
        }
    }
}
