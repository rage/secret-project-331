use super::*;

/// Slugs of the exercise services this API can serve: exactly those declaring
/// `supports_native_client`.
///
/// Reads the `exercise_service_info` cache, which `service-info-fetcher` refreshes about once a
/// minute; fetching live would fan every request out to every exercise service. An empty set
/// therefore usually means that fetcher is down or cold, which the client sees only as empty
/// course and exercise lists — hence the warning.
pub(super) async fn native_client_capable_slugs(
    conn: &mut PgConnection,
) -> ModelResult<Vec<String>> {
    let slugs = models::exercise_services::get_native_client_capable_slugs(conn).await?;
    if slugs.is_empty() {
        warn!(
            "No exercise service declares supports_native_client, so the client API can serve nothing. Check that service-info-fetcher is running."
        );
    }
    Ok(slugs)
}

/// Whether a task of the given exercise service can be served to this client; the one rule
/// behind which exercises the client API serves.
fn is_client_capable(exercise_type: &str, capable_slugs: &[String]) -> bool {
    capable_slugs.iter().any(|slug| slug == exercise_type)
}

/// Whether the client can answer a slide with tasks of these types: a slide submission answers
/// every task, so each one must be client-capable.
fn is_slide_client_answerable<'a>(
    task_exercise_types: impl IntoIterator<Item = &'a str>,
    capable_slugs: &[String],
) -> bool {
    task_exercise_types
        .into_iter()
        .all(|exercise_type| is_client_capable(exercise_type, capable_slugs))
}

/// A slide's tasks in the client shape, or none when the client cannot answer the slide. Shared by
/// the list and single-exercise views so their visibility rules cannot drift apart. Model solutions
/// are stripped unless `reveal_model_solution`; the list view never reveals them.
pub(super) fn client_tasks_from_slide(
    tasks: Vec<models::exercise_tasks::CourseMaterialExerciseTask>,
    capable_slugs: &[String],
    reveal_model_solution: bool,
) -> Vec<api::ExerciseTask> {
    if !is_slide_client_answerable(
        tasks.iter().map(|et| et.exercise_service_slug.as_str()),
        capable_slugs,
    ) {
        return Vec::new();
    }
    tasks
        .into_iter()
        .map(|et| api::ExerciseTask {
            task_id: et.id,
            order_number: et.order_number,
            assignment: et.assignment,
            public_spec: et.public_spec,
            model_solution_spec: if reveal_model_solution {
                et.model_solution_spec
            } else {
                None
            },
            exercise_service_slug: et.exercise_service_slug,
        })
        .collect()
}

/// The given exercises with a slide all of whose tasks are client-capable, the slides
/// `client_tasks_from_slide` serves. Unlike that, this selects no slide for the user, so it also
/// answers for exercises whose chapter has not opened.
pub(super) async fn client_capable_exercise_ids(
    conn: &mut PgConnection,
    exercise_ids: &[Uuid],
    capable_slugs: &[String],
) -> ModelResult<HashSet<Uuid>> {
    let exercise_by_slide: HashMap<Uuid, Uuid> =
        models::exercise_slides::get_exercise_slides_by_exercise_ids(conn, exercise_ids)
            .await?
            .into_iter()
            .map(|slide| (slide.id, slide.exercise_id))
            .collect();
    let slide_ids: Vec<Uuid> = exercise_by_slide.keys().copied().collect();
    let mut task_types_by_slide: HashMap<Uuid, Vec<String>> = HashMap::new();
    for task in
        models::exercise_tasks::get_exercise_tasks_by_exercise_slide_ids(conn, &slide_ids).await?
    {
        task_types_by_slide
            .entry(task.exercise_slide_id)
            .or_default()
            .push(task.exercise_type);
    }
    Ok(task_types_by_slide
        .into_iter()
        .filter(|(_, types)| {
            is_slide_client_answerable(types.iter().map(String::as_str), capable_slugs)
        })
        .filter_map(|(slide_id, _)| exercise_by_slide.get(&slide_id).copied())
        .collect())
}

/// A course's chapters, split by whether they are open to the user. Shared by the exercise list and
/// progress views so their visibility rules cannot drift apart: only exercises of `open` chapters
/// are served.
pub(super) struct CourseChapters {
    pub(super) open: HashMap<Uuid, DatabaseChapter>,
    pub(super) closed: Vec<DatabaseChapter>,
}

/// The course's chapters, split into the ones open to the user and the ones that have not opened.
/// A user who may view the course's material before it opens, such as its staff, gets every chapter
/// as open, as the single-exercise and submit routes already let them answer those.
pub(super) async fn course_chapters(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<CourseChapters, ControllerError> {
    let can_view_unopened = can_view_unopened_chapters(conn, user_id, course_id).await?;
    let (open, closed): (Vec<_>, Vec<_>) = models::chapters::get_course_chapters(conn, course_id)
        .await?
        .into_iter()
        .partition(|chapter| can_view_unopened || chapter.has_opened());
    Ok(CourseChapters {
        open: open.into_iter().map(|c| (c.id, c)).collect(),
        closed,
    })
}

/// Whether the user may see a course's chapters before they open, as `can_user_view_chapter` lets
/// them.
async fn can_view_unopened_chapters(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<bool, ControllerError> {
    user_may_act_on_course(conn, user_id, Act::ViewMaterial, course_id).await
}

/// Whether the user teaches or assists on the course.
pub(super) async fn is_course_staff(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<bool, ControllerError> {
    user_may_act_on_course(conn, user_id, Act::Teach, course_id).await
}

/// Whether the user's roles permit `action` on the course. A check that cannot be completed
/// permits nothing.
async fn user_may_act_on_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    action: Act,
    course_id: Uuid,
) -> Result<bool, ControllerError> {
    let roles = crate::domain::authorization::fetch_user_roles(conn, Some(user_id)).await?;
    Ok(
        crate::domain::authorization::is_permitted(conn, action, Res::Course(course_id), &roles)
            .await
            .unwrap_or(false),
    )
}

/// Answers an access check's plain `403` with the `no_access` key, so a client can tell it apart
/// from a token that lacks the scope.
pub(super) fn keyed_no_access(err: impl Into<ControllerError>) -> ControllerError {
    err.into().with_forbidden_reason(ForbiddenReason::NoAccess)
}

/// Rejects a user who may not view the course's material, a draft or code-only course among them.
pub(super) async fn authorize_course_access(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<crate::domain::authorization::AuthorizationToken, ControllerError> {
    authorize_access_to_course_material(conn, Some(user_id), course_id)
        .await
        .map_err(keyed_no_access)
}

/// The user's chapter locking status by chapter id; empty when the course does not lock chapters.
/// A newcomer's first chapters read as unlocked, as in the course material, without storing
/// anything.
pub(super) async fn chapter_locking_statuses(
    conn: &mut PgConnection,
    user_id: Uuid,
    course: &models::courses::Course,
) -> ModelResult<HashMap<Uuid, api::ChapterLockingStatus>> {
    if !course.chapter_locking_enabled {
        return Ok(HashMap::new());
    }
    Ok(
        models::user_chapter_locking_statuses::get_or_derive_all_for_course(
            conn, user_id, course.id,
        )
        .await?
        .into_iter()
        .map(|(chapter_id, status)| (chapter_id, to_api_chapter_locking_status(status)))
        .collect(),
    )
}

/// The client API's form of a stored chapter locking status.
fn to_api_chapter_locking_status(
    status: models::user_chapter_locking_statuses::ChapterLockingStatus,
) -> api::ChapterLockingStatus {
    use models::user_chapter_locking_statuses::ChapterLockingStatus as Db;
    match status {
        Db::Unlocked => api::ChapterLockingStatus::Unlocked,
        Db::CompletedAndLocked => api::ChapterLockingStatus::CompletedAndLocked,
        Db::NotUnlockedYet => api::ChapterLockingStatus::NotUnlockedYet,
    }
}

/// The chapter an exercise is in, with the user's locking status in it, as the client is told it.
pub(super) fn exercise_chapter(
    chapter: &DatabaseChapter,
    locking_statuses: &HashMap<Uuid, api::ChapterLockingStatus>,
) -> api::ExerciseChapter {
    api::ExerciseChapter {
        id: chapter.id,
        name: chapter.name.clone(),
        chapter_number: chapter.chapter_number,
        locking_status: locking_statuses.get(&chapter.id).copied(),
    }
}

/// Rejects a user to whom the course material or the exercise's chapter is not open. A chapter
/// that has not opened yet gets its own `chapter_not_open_yet` key, so a client can tell it apart
/// from a token that lacks the scope.
pub(super) async fn authorize_access_to_exercise_chapter(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    chapter_id: Option<Uuid>,
) -> Result<(), ControllerError> {
    authorize_course_access(conn, user_id, course_id).await?;
    if !crate::domain::authorization::can_user_view_chapter(
        conn,
        Some(user_id),
        Some(course_id),
        chapter_id,
    )
    .await?
    {
        return Err(controller_err!(
            ForbiddenWithReason(ForbiddenReason::ChapterNotOpenYet),
            "This exercise's chapter is not open yet.".to_string()
        ));
    }
    Ok(())
}

/// Rejects a user without a live enrollment on the exercise's course, before a graded submission.
///
/// The shared submit domain fn reports a not-enrolled user as 401 Unauthorized, but the editor
/// client treats 401 as an invalid token and deletes the stored credentials, logging the student
/// out on their first submit. 422 `not_enrolled` lets the client prompt for enrollment instead.
/// The domain fn only checks course settings, which outlive a removed enrollment.
pub(super) async fn verify_enrolled(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<(), ControllerError> {
    verify_was_enrolled(conn, user_id, course_id).await?;
    if models::course_instance_enrollments::get_by_user_id_and_course_ids(
        conn,
        user_id,
        &[course_id],
    )
    .await?
    .is_empty()
    {
        return Err(not_enrolled_error());
    }
    Ok(())
}

/// Rejects a user who never enrolled on the exercise's course. Unlike [verify_enrolled], passes a
/// user whose enrollment was removed, who may still keep ungraded snapshots of their own work.
pub(super) async fn verify_was_enrolled(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<(), ControllerError> {
    if models::user_course_settings::get_user_course_settings_by_course_id(conn, user_id, course_id)
        .await?
        .is_some()
    {
        return Ok(());
    }
    Err(not_enrolled_error())
}

/// The refusal both enrollment checks report, with the `not_enrolled` key clients branch on.
pub(super) fn not_enrolled_error() -> ControllerError {
    bad_request_with_reason(
        BadRequestReason::NotEnrolled,
        "User is not enrolled to this exercise's course".to_string(),
    )
}

/// Rejects a user who may not answer the exercise here: a course exercise needs an enrollment (one
/// that once existed, for a snapshot) and an open chapter, an exam exercise an exam the user can
/// still answer, and takes no snapshots. Returns whose the answers are.
pub(super) async fn verify_can_answer(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: &models::exercises::Exercise,
    is_for_snapshot: bool,
) -> Result<CourseOrExamId, ControllerError> {
    match (exercise.course_id, exercise.exam_id) {
        (Some(course_id), _) => {
            if is_for_snapshot {
                verify_was_enrolled(conn, user_id, course_id).await?;
            } else {
                verify_enrolled(conn, user_id, course_id).await?;
            }
            authorize_access_to_exercise_chapter(conn, user_id, course_id, exercise.chapter_id)
                .await?;
            Ok(CourseOrExamId::Course(course_id))
        }
        (None, Some(exam_id)) if !is_for_snapshot => {
            answerable_exam_or_not_found(conn, exam_id, user_id).await?;
            Ok(CourseOrExamId::Exam(exam_id))
        }
        _ => Err(controller_err!(
            NotFound,
            "Exam exercises take no snapshots".to_string()
        )),
    }
}

/// The URL path authorizes `exercise_id`; the slide/task ids come from the request body,
/// so without this check a caller could submit into an unrelated exercise's slide/task.
pub(super) fn verify_slide_and_task_belong(
    exercise_id: Uuid,
    slide_id: Uuid,
    slide_exercise_id: Uuid,
    task_id: Uuid,
    task_slide_id: Uuid,
) -> Result<(), ControllerError> {
    if slide_exercise_id != exercise_id {
        return Err(controller_err!(
            BadRequest,
            format!("Exercise slide {slide_id} does not belong to exercise {exercise_id}")
        ));
    }
    if task_slide_id != slide_id {
        return Err(controller_err!(
            BadRequest,
            format!("Exercise task {task_id} does not belong to exercise slide {slide_id}")
        ));
    }
    Ok(())
}

/// Rejects access to a submission owned by a different user.
pub(super) fn verify_submission_owner(
    submission_user_id: Uuid,
    user_id: Uuid,
    forbidden_message: String,
) -> Result<(), ControllerError> {
    if submission_user_id != user_id {
        return Err(controller_err!(
            ForbiddenWithReason(ForbiddenReason::NoAccess),
            forbidden_message
        ));
    }
    Ok(())
}

/// Whether the exam's automatic gradings are hidden from the user: while they can still answer it,
/// and always in a manually graded exam, whose results are the teacher's decisions.
pub(super) async fn exam_hides_gradings(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
) -> Result<bool, ControllerError> {
    if models::exams::get(conn, exam_id).await?.grade_manually {
        return Ok(true);
    }
    Ok(answerable_exam(conn, exam_id, user_id).await?.is_some())
}

/// Answers an exam submission as not found where this API offers nothing for exams.
pub(super) fn verify_not_exam_submission(
    slide_submission: &models::exercise_slide_submissions::ExerciseSlideSubmission,
) -> Result<(), ControllerError> {
    if slide_submission.exam_id.is_some() {
        return Err(controller_err!(
            NotFound,
            "This submission belongs to an exam, which the client API does not serve".to_string()
        ));
    }
    Ok(())
}

/// Rejects a submission to a task whose exercise service cannot serve a native client.
///
/// The slide/task ids come from the request body, so without this a caller holding any task id
/// could persist an answer to a service that will never understand it, and grading would fail
/// deep inside that service instead of at the edge.
pub(super) fn verify_task_is_client_capable(
    task_id: Uuid,
    exercise_type: &str,
    capable_slugs: &[String],
) -> Result<(), ControllerError> {
    if is_client_capable(exercise_type, capable_slugs) {
        return Ok(());
    }
    Err(controller_err!(
        BadRequest,
        format!(
            "Exercise task {task_id} belongs to the exercise service '{exercise_type}', which cannot be served to this client"
        )
    ))
}

/// Rejects a submit to a slide that also has a task this client cannot answer: the submission would
/// leave that task unanswered, and the slide could never reach full points.
pub(super) async fn verify_slide_is_client_answerable(
    conn: &mut PgConnection,
    slide_id: Uuid,
    capable_slugs: &[String],
) -> Result<(), ControllerError> {
    let tasks =
        models::exercise_tasks::get_exercise_tasks_by_exercise_slide_ids(conn, &[slide_id]).await?;
    if is_slide_client_answerable(
        tasks.iter().map(|task| task.exercise_type.as_str()),
        capable_slugs,
    ) {
        return Ok(());
    }
    Err(controller_err!(
        BadRequest,
        format!(
            "Exercise slide {slide_id} has a task this client cannot answer, so it must be answered in the course material"
        )
    ))
}
