use std::collections::HashMap;

use serde_json::Value;
use sqlx::Postgres;
use sqlx::Transaction;

use crate::course_instances;
use crate::course_instances::NewCourseInstance;
use crate::course_instances::VariantStatus;
use crate::course_language_groups;
use crate::courses::get_course;
use crate::courses::Course;
use crate::courses::NewCourse;
use crate::prelude::*;

use crate::ModelResult;

pub async fn copy_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    new_course: &NewCourse,
    same_language_group: bool,
) -> ModelResult<Course> {
    let parent_course = get_course(conn, course_id).await?;

    let mut tx = conn.begin().await?;

    let course_language_group_id = if same_language_group {
        parent_course.course_language_group_id
    } else {
        course_language_groups::insert(&mut tx).await?
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
    course_language_group_id
  )
VALUES ($1, $2, $3, $4::regconfig, $5, $6, $7)
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
  description;
    ",
        new_course.name,
        new_course.organization_id,
        new_course.slug,
        parent_course.content_search_language as _,
        new_course.language_code,
        parent_course.id,
        course_language_group_id,
    )
    .fetch_one(&mut tx)
    .await?;

    copy_course_chapters(&mut tx, copied_course.id, course_id).await?;

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
                            ModelError::Generic("Invalid exercise id in content.".to_string())
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
            .execute(&mut tx)
            .await?;
        }
    }

    copy_exercise_slides(&mut tx, copied_course.id, course_id).await?;

    copy_exercise_tasks(&mut tx, copied_course.id, course_id).await?;
    // Create default instance for copied course.
    course_instances::insert(
        &mut tx,
        NewCourseInstance {
            id: Uuid::new_v4(),
            course_id: copied_course.id,
            name: None,
            description: None,
            variant_status: Some(VariantStatus::Draft),
            support_email: None,
            teacher_in_charge_name: &new_course.teacher_in_charge_name,
            teacher_in_charge_email: &new_course.teacher_in_charge_email,
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;

    tx.commit().await?;
    Ok(copied_course)
}

pub async fn copy_exam() {}

async fn copy_course_pages_and_return_contents(
    tx: &mut Transaction<'_, Postgres>,
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
    WHERE (course_id = $2)
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

#[allow(dead_code)]
async fn copy_exam_pages_and_return_contents(
    tx: &mut Transaction<'_, Postgres>,
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
    WHERE (course_id = $2)
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

async fn set_chapter_front_pages(
    tx: &mut Transaction<'_, Postgres>,
    namespace_id: Uuid,
) -> ModelResult<()> {
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
    .execute(tx)
    .await?;

    Ok(())
}

async fn copy_course_chapters(
    tx: &mut Transaction<'_, Postgres>,
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
    copied_from
  )
SELECT uuid_generate_v5($1, id::text),
  name,
  $1,
  chapter_number,
  front_page_id,
  opens_at,
  chapter_image_path,
  id
FROM chapters
WHERE (course_id = $2);
    ",
        namespace_id,
        parent_course_id
    )
    .execute(tx)
    .await?;

    Ok(())
}

async fn map_old_exr_ids_to_new_exr_ids_for_courses(
    tx: &mut Transaction<'_, Postgres>,
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
            copied_from
          )
        SELECT uuid_generate_v5($1, id::text),
          $1,
          name,
          deadline,
          uuid_generate_v5($1, page_id::text),
          score_maximum,
          order_number,
          chapter_id,
          id
        FROM exercises
        WHERE course_id = $2
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
                    ModelError::Generic("Query failed to return valid data.".to_string())
                })?
                .to_string(),
            record.id.to_string(),
        ))
    })
    .collect::<ModelResult<HashMap<String, String>>>()?;

    Ok(old_to_new_exercise_ids)
}

#[allow(dead_code)]
async fn map_old_exr_ids_to_new_exr_ids_for_exams(
    tx: &mut Transaction<'_, Postgres>,
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
            copied_from
          )
        SELECT uuid_generate_v5($1, id::text),
          $1,
          name,
          deadline,
          uuid_generate_v5($1, page_id::text),
          score_maximum,
          order_number,
          chapter_id,
          id
        FROM exercises
        WHERE exam_id = $2
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
                    ModelError::Generic("Query failed to return valid data.".to_string())
                })?
                .to_string(),
            record.id.to_string(),
        ))
    })
    .collect::<ModelResult<HashMap<String, String>>>()?;

    Ok(old_to_new_exercise_ids)
}

async fn copy_exercise_slides(
    tx: &mut Transaction<'_, Postgres>,
    namespace_id: Uuid,
    parent_course_id: Uuid,
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
    WHERE exercise_id IN (SELECT id FROM exercises WHERE course_id = $2);
            ",
        namespace_id,
        parent_course_id
    )
    .execute(tx)
    .await?;

    Ok(())
}

async fn copy_exercise_tasks(
    tx: &mut Transaction<'_, Postgres>,
    namespace_id: Uuid,
    parent_course_id: Uuid,
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
    spec_file_id,
    public_spec,
    model_solution_spec,
    copied_from
  )
SELECT uuid_generate_v5($1, id::text),
  uuid_generate_v5($1, exercise_slide_id::text),
  exercise_type,
  assignment,
  private_spec,
  spec_file_id,
  public_spec,
  model_solution_spec,
  id
FROM exercise_tasks
WHERE exercise_slide_id IN (
    SELECT s.id
    FROM exercise_slides s
      JOIN exercises e ON (e.id = s.exercise_id)
    WHERE e.course_id = $2
  );
    ",
        namespace_id,
        parent_course_id,
    )
    .execute(tx)
    .await?;
    Ok(())
}
