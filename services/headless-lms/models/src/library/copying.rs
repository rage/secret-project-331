use std::collections::HashMap;

use serde_json::Value;

use crate::course_instances;
use crate::course_instances::NewCourseInstance;
use crate::course_language_groups;
use crate::courses::Course;
use crate::courses::NewCourse;
use crate::courses::get_course;
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
    let mut tx = conn.begin().await?;
    let parent_course = get_course(&mut tx, course_id).await?;
    let course_language_group_id = if same_language_group {
        parent_course.course_language_group_id
    } else {
        course_language_groups::insert(&mut tx, PKeyPolicy::Generate).await?
    };

    let copied_course = copy_course_with_language_group(
        &mut tx,
        course_id,
        course_language_group_id,
        new_course,
        user_id,
    )
    .await?;

    tx.commit().await?;

    Ok(copied_course)
}

pub async fn copy_course_with_language_group(
    conn: &mut PgConnection,
    src_course_id: Uuid,
    target_clg_id: Uuid,
    new_course: &NewCourse,
    user_id: Uuid,
) -> ModelResult<Course> {
    let parent_course = get_course(conn, src_course_id).await?;
    let same_clg = target_clg_id == parent_course.course_language_group_id;

    let mut tx = conn.begin().await?;

    let copied_course = sqlx::query_as!(
        Course,
        r#"
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
    ask_marketing_consent,
    description,
    flagged_answers_threshold
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14,
    $15,
    $16
  )
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
  ask_marketing_consent,
  flagged_answers_threshold,
  closed_at,
  closed_additional_message,
  closed_course_successor_id
        "#,
        new_course.name,
        new_course.organization_id,
        new_course.slug,
        parent_course.content_search_language as _,
        new_course.language_code,
        parent_course.id,
        target_clg_id,
        new_course.is_draft,
        parent_course.base_module_completion_requires_n_submodule_completions,
        parent_course.can_add_chatbot,
        new_course.is_unlisted,
        new_course.is_joinable_by_code_only,
        new_course.join_code,
        new_course.ask_marketing_consent,
        parent_course.description,
        parent_course.flagged_answers_threshold
    )
    .fetch_one(&mut *tx)
    .await?;

    copy_course_modules(&mut tx, copied_course.id, src_course_id).await?;
    copy_course_chapters(&mut tx, copied_course.id, src_course_id).await?;

    if new_course.copy_user_permissions {
        copy_user_permissions(&mut tx, copied_course.id, src_course_id, user_id).await?;
    }

    let contents_iter =
        copy_course_pages_and_return_contents(&mut tx, copied_course.id, src_course_id).await?;

    set_chapter_front_pages(&mut tx, copied_course.id).await?;

    let old_to_new_exercise_ids = map_old_exr_ids_to_new_exr_ids_for_courses(
        &mut tx,
        copied_course.id,
        src_course_id,
        target_clg_id,
        same_clg,
    )
    .await?;

    // update page contents exercise IDs
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
                r#"
UPDATE pages
SET content = $1
WHERE id = $2;
"#,
                Value::Array(blocks),
                page_id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    let pages_contents = pages::get_all_by_course_id_and_visibility(
        tx.as_mut(),
        copied_course.id,
        pages::PageVisibility::Any,
    )
    .await?
    .into_iter()
    .map(|page| (page.id, page.content))
    .collect::<HashMap<_, _>>();

    for (page_id, content) in pages_contents {
        if let Value::Array(mut blocks) = content {
            for block in blocks.iter_mut() {
                if let Some(content) = block["attributes"]["content"].as_str() {
                    if content.contains("<a href=") {
                        block["attributes"]["content"] =
                            Value::String(content.replace(&parent_course.slug, &new_course.slug));
                    }
                }
            }
            sqlx::query!(
                r#"
UPDATE pages
SET content = $1
WHERE id = $2;
"#,
                Value::Array(blocks),
                page_id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    copy_exercise_slides(&mut tx, copied_course.id, src_course_id).await?;
    copy_exercise_tasks(&mut tx, copied_course.id, src_course_id).await?;

    // We don't copy course instances at the moment because they are not related to the course content, and someone might want to take the content without the instances. We could add an option to copy them in the future.
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

    copy_peer_or_self_review_configs(&mut tx, copied_course.id, src_course_id).await?;
    copy_peer_or_self_review_questions(&mut tx, copied_course.id, src_course_id).await?;
    copy_material_references(&mut tx, copied_course.id, src_course_id).await?;
    copy_glossary_entries(&mut tx, copied_course.id, src_course_id).await?;

    // Copy course configurations and optional content
    copy_certificate_configurations_and_requirements(&mut tx, copied_course.id, src_course_id)
        .await?;
    copy_chatbot_configurations(&mut tx, copied_course.id, src_course_id).await?;
    copy_cheater_thresholds(&mut tx, copied_course.id, src_course_id).await?;
    copy_course_custom_privacy_policy_checkbox_texts(&mut tx, copied_course.id, src_course_id)
        .await?;
    copy_exercise_repositories(&mut tx, copied_course.id, src_course_id).await?;
    copy_partners_blocks(&mut tx, copied_course.id, src_course_id).await?;
    copy_privacy_links(&mut tx, copied_course.id, src_course_id).await?;
    copy_research_consent_forms_and_questions(&mut tx, copied_course.id, src_course_id).await?;

    tx.commit().await?;

    Ok(copied_course)
}

pub async fn copy_exam(
    conn: &mut PgConnection,
    parent_exam_id: &Uuid,
    new_exam: &NewExam,
) -> ModelResult<Exam> {
    let mut tx = conn.begin().await?;
    let copied_exam = copy_exam_content(&mut tx, parent_exam_id, new_exam, None).await?;
    tx.commit().await?;
    Ok(copied_exam)
}

async fn copy_exam_content(
    tx: &mut PgConnection,
    parent_exam_id: &Uuid,
    new_exam: &NewExam,
    new_exam_id: Option<Uuid>,
) -> ModelResult<Exam> {
    let parent_exam = exams::get(tx, *parent_exam_id).await?;

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

    let final_exam_id = new_exam_id.unwrap_or_else(Uuid::new_v4);

    // create new exam
    let copied_exam = sqlx::query!(
        "
INSERT INTO exams(
    id,
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
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
        ",
        final_exam_id,
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
        copy_exam_pages_and_return_contents(&mut *tx, copied_exam.id, parent_exam.id).await?;

    // Copy exam exercises
    let old_to_new_exercise_ids =
        map_old_exr_ids_to_new_exr_ids_for_exams(&mut *tx, copied_exam.id, parent_exam.id).await?;

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

    copy_exercise_slides(&mut *tx, copied_exam.id, parent_exam.id).await?;
    copy_exercise_tasks(&mut *tx, copied_exam.id, parent_exam.id).await?;

    let get_page_id = sqlx::query!(
        "SELECT id AS page_id FROM pages WHERE exam_id = $1;",
        copied_exam.id
    )
    .fetch_one(&mut *tx)
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
        language: copied_exam
            .language
            .unwrap_or_else(|| parent_exam_fields.language.unwrap_or("en-US".to_string())),
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
    page_language_group_id,
    hidden
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
  page_language_group_id,
  hidden
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
    content_search_language,
    hidden
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  content,
  url_path,
  title,
  NULL,
  order_number,
  id,
  content_search_language,
  hidden
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
    copied_from,
    automatic_completion,
    automatic_completion_number_of_exercises_attempted_treshold,
    automatic_completion_number_of_points_treshold,
    automatic_completion_requires_exam,
    certification_enabled,
    completion_registration_link_override,
    ects_credits,
    enable_registering_completion_to_uh_open_university,
    uh_course_code
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  name,
  order_number,
  id,
  automatic_completion,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  automatic_completion_requires_exam,
  certification_enabled,
  completion_registration_link_override,
  ects_credits,
  enable_registering_completion_to_uh_open_university,
  uh_course_code
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
    course_module_id,
    color,
    deadline
  )
SELECT uuid_generate_v5($1, id::text),
  name,
  $1,
  chapter_number,
  front_page_id,
  opens_at,
  chapter_image_path,
  id,
  uuid_generate_v5($1, course_module_id::text),
  color,
  deadline
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
    new_course_id: Uuid,
    src_course_id: Uuid,
    target_clg_id: Uuid,
    same_clg: bool,
) -> ModelResult<HashMap<String, String>> {
    let rows = sqlx::query!(
        r#"
WITH src AS (
  SELECT e.*,
    CASE
      WHEN $4 THEN e.exercise_language_group_id
      ELSE uuid_generate_v5($3, e.id::text)
    END AS tgt_elg_id
  FROM exercises e
  WHERE e.course_id = $2
    AND e.deleted_at IS NULL
),
ins_elg AS (
  INSERT INTO exercise_language_groups (id, course_language_group_id)
  SELECT DISTINCT tgt_elg_id,
    $3
  FROM src
  WHERE NOT $4 ON CONFLICT (id) DO NOTHING
),
ins_exercises AS (
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
      use_course_default_peer_or_self_review_config,
      needs_self_review
    )
  SELECT uuid_generate_v5($1, src.id::text),
    $1,
    src.name,
    src.deadline,
    uuid_generate_v5($1, src.page_id::text),
    src.score_maximum,
    src.order_number,
    uuid_generate_v5($1, src.chapter_id::text),
    src.id,
    src.tgt_elg_id,
    src.max_tries_per_slide,
    src.limit_number_of_tries,
    src.needs_peer_review,
    src.use_course_default_peer_or_self_review_config,
    src.needs_self_review
  FROM src
  RETURNING id,
    copied_from
)
SELECT id,
  copied_from
FROM ins_exercises;
        "#,
        new_course_id,
        src_course_id,
        target_clg_id,
        same_clg,
    )
    .fetch_all(tx)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| (r.copied_from.unwrap().to_string(), r.id.to_string()))
        .collect())
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
    use_course_default_peer_or_self_review_config,
    needs_self_review
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  name,
  deadline,
  uuid_generate_v5($1, page_id::text),
  score_maximum,
  order_number,
  NULL,
  id,
  max_tries_per_slide,
  limit_number_of_tries,
  needs_peer_review,
  use_course_default_peer_or_self_review_config,
  needs_self_review
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
    sqlx::query!(
        "
INSERT INTO peer_or_self_review_configs (
    id,
    course_id,
    exercise_id,
    peer_reviews_to_give,
    peer_reviews_to_receive,
    processing_strategy,
    accepting_threshold,
    manual_review_cutoff_in_days,
    points_are_all_or_nothing,
    review_instructions
  )
SELECT uuid_generate_v5($1, posrc.id::text),
  $1,
  uuid_generate_v5($1, posrc.exercise_id::text),
  posrc.peer_reviews_to_give,
  posrc.peer_reviews_to_receive,
  posrc.processing_strategy,
  posrc.accepting_threshold,
  posrc.manual_review_cutoff_in_days,
  posrc.points_are_all_or_nothing,
  posrc.review_instructions
FROM peer_or_self_review_configs posrc
  LEFT JOIN exercises e ON (e.id = posrc.exercise_id)
WHERE posrc.course_id = $2
  AND posrc.deleted_at IS NULL
  AND e.deleted_at IS NULL;
    ",
        namespace_id,
        parent_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_peer_or_self_review_questions(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO peer_or_self_review_questions (
    id,
    peer_or_self_review_config_id,
    order_number,
    question,
    question_type,
    answer_required,
    weight
  )
SELECT uuid_generate_v5($1, q.id::text),
  uuid_generate_v5($1, q.peer_or_self_review_config_id::text),
  q.order_number,
  q.question,
  q.question_type,
  q.answer_required,
  q.weight
FROM peer_or_self_review_questions q
  JOIN peer_or_self_review_configs posrc ON (posrc.id = q.peer_or_self_review_config_id)
  JOIN exercises e ON (e.id = posrc.exercise_id)
WHERE peer_or_self_review_config_id IN (
    SELECT id
    FROM peer_or_self_review_configs
    WHERE course_id = $2
      AND deleted_at IS NULL
  )
  AND q.deleted_at IS NULL
  AND e.deleted_at IS NULL
  AND posrc.deleted_at IS NULL;
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

async fn copy_glossary_entries(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO glossary (
    id,
    course_id,
    term,
    definition
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  term,
  definition
FROM glossary
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_certificate_configurations_and_requirements(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO certificate_configurations (
    id,
    background_svg_file_upload_id,
    background_svg_path,
    certificate_date_font_size,
    certificate_date_text_anchor,
    certificate_date_text_color,
    certificate_date_x_pos,
    certificate_date_y_pos,
    certificate_grade_font_size,
    certificate_grade_text_anchor,
    certificate_grade_text_color,
    certificate_grade_x_pos,
    certificate_grade_y_pos,
    certificate_locale,
    certificate_owner_name_font_size,
    certificate_owner_name_text_anchor,
    certificate_owner_name_text_color,
    certificate_owner_name_x_pos,
    certificate_owner_name_y_pos,
    certificate_validate_url_font_size,
    certificate_validate_url_text_anchor,
    certificate_validate_url_text_color,
    certificate_validate_url_x_pos,
    certificate_validate_url_y_pos,
    overlay_svg_file_upload_id,
    overlay_svg_path,
    paper_size,
    render_certificate_grade
  )
SELECT uuid_generate_v5($1, id::text),
  background_svg_file_upload_id,
  background_svg_path,
  certificate_date_font_size,
  certificate_date_text_anchor,
  certificate_date_text_color,
  certificate_date_x_pos,
  certificate_date_y_pos,
  certificate_grade_font_size,
  certificate_grade_text_anchor,
  certificate_grade_text_color,
  certificate_grade_x_pos,
  certificate_grade_y_pos,
  certificate_locale,
  certificate_owner_name_font_size,
  certificate_owner_name_text_anchor,
  certificate_owner_name_text_color,
  certificate_owner_name_x_pos,
  certificate_owner_name_y_pos,
  certificate_validate_url_font_size,
  certificate_validate_url_text_anchor,
  certificate_validate_url_text_color,
  certificate_validate_url_x_pos,
  certificate_validate_url_y_pos,
  overlay_svg_file_upload_id,
  overlay_svg_path,
  paper_size,
  render_certificate_grade
FROM certificate_configurations
WHERE id IN (
    SELECT certificate_configuration_id
    FROM certificate_configuration_to_requirements cctr
      JOIN course_modules cm ON cctr.course_module_id = cm.id
    WHERE cm.course_id = $2
      AND cctr.deleted_at IS NULL
      AND cm.deleted_at IS NULL
  )
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "
INSERT INTO certificate_configuration_to_requirements (
    id,
    certificate_configuration_id,
    course_module_id
  )
SELECT uuid_generate_v5($1, cctr.id::text),
  uuid_generate_v5($1, cctr.certificate_configuration_id::text),
  uuid_generate_v5($1, cctr.course_module_id::text)
FROM certificate_configuration_to_requirements cctr
  JOIN course_modules cm ON cctr.course_module_id = cm.id
WHERE cm.course_id = $2
  AND cctr.deleted_at IS NULL
  AND cm.deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

async fn copy_chatbot_configurations(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO chatbot_configurations (
    id,
    course_id,
    chatbot_name,
    initial_message,
    prompt,
    use_azure_search,
    maintain_azure_search_index,
    use_semantic_reranking,
    hide_citations,
    temperature,
    top_p,
    presence_penalty,
    frequency_penalty,
    response_max_tokens,
    daily_tokens_per_user,
    weekly_tokens_per_user,
    default_chatbot,
    enabled_to_students,
    model_id,
    thinking_model,
    use_tools
  )
SELECT
  uuid_generate_v5($1, id::text),
  $1,
  chatbot_name,
  initial_message,
  prompt,
  use_azure_search,
  maintain_azure_search_index,
  use_semantic_reranking,
  hide_citations,
  temperature,
  top_p,
  presence_penalty,
  frequency_penalty,
  response_max_tokens,
  daily_tokens_per_user,
  weekly_tokens_per_user,
  default_chatbot,
  enabled_to_students,
  model_id,
  thinking_model,
  use_tools
FROM chatbot_configurations
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_cheater_thresholds(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    let old_default_module =
        crate::course_modules::get_default_by_course_id(tx, old_course_id).await?;
    let new_default_module =
        crate::course_modules::get_default_by_course_id(tx, new_course_id).await?;

    sqlx::query!(
        "
INSERT INTO cheater_thresholds (id, course_module_id, duration_seconds)
SELECT
  uuid_generate_v5($1, id::text),
  $2,
  duration_seconds
FROM cheater_thresholds
WHERE course_module_id = $3
  AND deleted_at IS NULL;
        ",
        new_course_id,
        new_default_module.id,
        old_default_module.id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_course_custom_privacy_policy_checkbox_texts(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_custom_privacy_policy_checkbox_texts (id, course_id, text_slug, text_html)
SELECT uuid_generate_v5($1, id::text),
  $1,
  text_slug,
  text_html
FROM course_custom_privacy_policy_checkbox_texts
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_exercise_repositories(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exercise_repositories (
    id,
    course_id,
    url,
    deploy_key,
    public_key,
    STATUS,
    error_message
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  url,
  deploy_key,
  public_key,
  STATUS,
  error_message
FROM exercise_repositories
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_partners_blocks(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO partners_blocks (id, course_id, content)
SELECT uuid_generate_v5($1, id::text),
  $1,
  content
FROM partners_blocks
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_privacy_links(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO privacy_links (id, course_id, url, title)
SELECT uuid_generate_v5($1, id::text),
  $1,
  url,
  title
FROM privacy_links
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_research_consent_forms_and_questions(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_specific_research_consent_forms (id, course_id, content)
SELECT uuid_generate_v5($1, id::text),
  $1,
  content
FROM course_specific_research_consent_forms
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "
INSERT INTO course_specific_consent_form_questions (
    id,
    course_id,
    research_consent_form_id,
    question
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  uuid_generate_v5($1, research_consent_form_id::text),
  question
FROM course_specific_consent_form_questions
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{exercise_tasks::ExerciseTask, pages::Page, test_helper::*};
    use pretty_assertions::assert_eq;

    #[tokio::test]
    async fn elg_preserved_when_same_course_language_group() {
        insert_data!(:tx, :user, :org, :course, instance: _i, course_module: _m,
                     :chapter, :page, :exercise);
        let original_ex = crate::exercises::get_by_id(tx.as_mut(), exercise)
            .await
            .unwrap();

        /* copy into THE SAME CLG via same_language_group = true */
        let new_meta = create_new_course(org, "fi-FI".into());
        let copied_course = copy_course(tx.as_mut(), course, &new_meta, true, user)
            .await
            .unwrap();

        let copied_ex = crate::exercises::get_exercises_by_course_id(tx.as_mut(), copied_course.id)
            .await
            .unwrap()
            .pop()
            .unwrap();

        assert_eq!(
            original_ex.exercise_language_group_id, copied_ex.exercise_language_group_id,
            "ELG must stay identical when CLG is unchanged"
        );
    }

    /// 2.  When we copy to a *different* CLG twice **with the same target id**,
    ///     every exercise must get the SAME deterministic ELG each time.
    #[tokio::test]
    async fn elg_deterministic_when_reusing_target_clg() {
        insert_data!(:tx, :user, :org, :course, instance: _i, course_module: _m,
                     :chapter, :page, exercise: _e);

        // Pre-create a brand-new CLG that both copies will use
        let reusable_clg = course_language_groups::insert(tx.as_mut(), PKeyPolicy::Generate)
            .await
            .unwrap();

        let meta1 = create_new_course(org, "en-US".into());
        let copy1 =
            copy_course_with_language_group(tx.as_mut(), course, reusable_clg, &meta1, user)
                .await
                .unwrap();

        let meta2 = {
            let mut nc = create_new_course(org, "pt-BR".into());
            nc.slug = "copied-course-2".into(); // ensure uniqueness
            nc
        };
        let copy2 =
            copy_course_with_language_group(tx.as_mut(), course, reusable_clg, &meta2, user)
                .await
                .unwrap();

        let ex1 = crate::exercises::get_exercises_by_course_id(tx.as_mut(), copy1.id)
            .await
            .unwrap()
            .pop()
            .unwrap();
        let ex2 = crate::exercises::get_exercises_by_course_id(tx.as_mut(), copy2.id)
            .await
            .unwrap()
            .pop()
            .unwrap();

        assert_ne!(ex1.course_id, ex2.course_id); // different copies
        assert_eq!(
            ex1.exercise_language_group_id, ex2.exercise_language_group_id,
            "ELG must be deterministic for the same (target CLG, src exercise)"
        );
    }

    #[tokio::test]
    async fn copies_course_as_different_course_language_group() {
        insert_data!(:tx, :user, :org, :course);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let new_course = create_new_course(org, "en-US".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, false, user)
            .await
            .unwrap();
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
        let new_course = create_new_course(org, "fi-FI".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();
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
        let new_course = create_new_course(org, "en-GB".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();
        let copied_instances =
            crate::course_instances::get_course_instances_for_course(tx.as_mut(), copied_course.id)
                .await
                .unwrap();
        assert_eq!(copied_instances.len(), 1);
    }

    #[tokio::test]
    async fn copies_course_modules() {
        insert_data!(:tx, :user, :org, :course);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let new_course = create_new_course(org, "pt-BR".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();

        let original_modules = crate::course_modules::get_by_course_id(tx.as_mut(), course.id)
            .await
            .unwrap();
        let copied_modules = crate::course_modules::get_by_course_id(tx.as_mut(), copied_course.id)
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
        let new_course = create_new_course(org, "sv-SV".into());
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
        let new_course = create_new_course(org, "fr-CA".into());
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
        let new_course = create_new_course(org, "es-US".into());
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
        assert_eq!(copied_pages.len(), 3);
        copied_pages.into_iter().for_each(|copied_page| {
            assert!(
                original_pages_by_id
                    .remove(&copied_page.copied_from.unwrap())
                    .is_some()
            );
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
                    "content": format!("Internal link <a href=\"http://project-331.local/org/uh-cs/courses/{slug2}\">http://project-331.local/org/uh-cs/courses/{slug1}</a>", slug2 = course.slug, slug1 = course.slug),
                    "dropCap":false
                },
                "innerBlocks": []
            }]),
        )
        .await.unwrap();

        let new_course = create_new_course(org, "fi-FI".into());
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
        let content_with_updated_course_slug = "Internal link <a href=\"http://project-331.local/org/uh-cs/courses/copied-course\">http://project-331.local/org/uh-cs/courses/copied-course</a>";
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
        let new_course = create_new_course(org, "es-MX".into());
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
            Uuid::parse_str(copied_page.content[0]["attributes"]["id"].as_str().unwrap()).unwrap();
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
        let new_course = create_new_course(org, "fi-SV".into());
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
            flagged_answers_threshold: Some(3),
            can_add_chatbot: false,
        }
    }
}
