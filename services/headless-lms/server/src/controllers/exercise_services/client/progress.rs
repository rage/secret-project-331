use super::*;

/// The user's progress on an exercise of the given course, with `state` their exercise state
/// (absent when they have never touched the exercise). Reads the submission counts only for an
/// exercise that limits tries.
pub(super) async fn exercise_progress(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: &models::exercises::Exercise,
    course: &models::courses::Course,
    state: Option<&UserExerciseState>,
) -> models::ModelResult<api::ExerciseProgress> {
    let course_id = course.id;
    let pending_teacher_review = pending_teacher_review(
        course.chapter_locking_enabled && exercise.teacher_reviews_answer_after_locking,
        state,
    );
    let may_be_out_of_tries =
        !has_received_full_points(state.and_then(|s| s.score_given), exercise.score_maximum)
            && !is_being_graded(state)
            && !is_in_peer_or_self_review(state)
            && pending_teacher_review.is_none();
    let (try_counts, is_out_of_tries) = match exercise.try_limit() {
        Some(max) => {
            let submission_counts = models::exercise_slide_submissions::get_exercise_slide_submission_counts_for_exercise_user(
                conn,
                exercise.id,
                CourseOrExamId::Course(course_id),
                user_id,
            )
            .await?;
            // A user who has no slide selected has not submitted to any.
            let used = state
                .and_then(|s| s.selected_exercise_slide_id)
                .and_then(|slide_id| submission_counts.get(&slide_id).copied())
                .unwrap_or(0);
            let try_counts = TryCounts {
                max: i32::try_from(max).unwrap_or(i32::MAX),
                left: i32::try_from((max - used).max(0)).unwrap_or_default(),
            };
            let is_out_of_tries = may_be_out_of_tries
                && domain::exercises::is_out_of_tries_given(
                    conn,
                    exercise.id,
                    max,
                    &submission_counts,
                )
                .await?;
            (Some(try_counts), is_out_of_tries)
        }
        None => (None, false),
    };
    let mut progress = derive_exercise_progress(
        exercise.id,
        exercise.score_maximum,
        state,
        is_out_of_tries,
        try_counts,
        pending_teacher_review,
    );
    if state.is_some_and(|s| s.activity_progress != ActivityProgress::Initialized) {
        progress.teacher_review = teacher_review(conn, user_id, exercise.id).await?;
    }
    Ok(progress)
}

/// The teacher's grading the course material shows the user for their current answer.
pub(super) async fn teacher_review(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
) -> models::ModelResult<Option<api::TeacherReview>> {
    use models::teacher_grading_decisions::TeacherDecisionType as Db;
    let Some(decision) = models::teacher_grading_decisions::try_to_get_latest_grading_decision_still_addressed_to_student(
        conn,
        user_id,
        exercise_id,
    )
    .await?
    else {
        return Ok(None);
    };
    let api_decision = match decision.teacher_decision {
        // The course material shows no decision for full points either.
        Db::FullPoints => return Ok(None),
        Db::ZeroPoints => api::TeacherDecision::ZeroPoints,
        Db::CustomPoints => api::TeacherDecision::CustomPoints,
        Db::SuspectedPlagiarism => api::TeacherDecision::SuspectedPlagiarism,
        Db::RejectAndReset => api::TeacherDecision::RejectAndReset,
        Db::UnauthorizedAiUse => api::TeacherDecision::UnauthorizedAiUse,
        Db::BadAnswer => api::TeacherDecision::BadAnswer,
        Db::Other => api::TeacherDecision::Other,
    };
    if decision.hidden == Some(true) {
        return Ok(None);
    }
    Ok(Some(api::TeacherReview {
        decision: api_decision,
        score_given: decision.score_given,
        justification: decision.justification,
        created_at: decision.created_at,
    }))
}

/// The client form of an answer's review stage; `None` while the user can still answer.
pub(super) fn to_api_reviewing_stage(stage: ReviewingStage) -> Option<api::ReviewingStage> {
    match stage {
        ReviewingStage::NotStarted => None,
        ReviewingStage::PeerReview => Some(api::ReviewingStage::PeerReview),
        ReviewingStage::SelfReview => Some(api::ReviewingStage::SelfReview),
        ReviewingStage::WaitingForPeerReviews => Some(api::ReviewingStage::WaitingForPeerReviews),
        ReviewingStage::WaitingForManualGrading => Some(api::ReviewingStage::WaitingForTeacher),
        ReviewingStage::ReviewedAndLocked => Some(api::ReviewingStage::ReviewedAndLocked),
        ReviewingStage::Locked => Some(api::ReviewingStage::Locked),
        ReviewingStage::NotAnsweredAndLocked => Some(api::ReviewingStage::NotAnsweredAndLocked),
    }
}

/// What the user's points wait for, if a teacher must review their answer before awarding any.
/// `is_held_for_review_after_chapter_lock` withholds the automatic points from the first graded
/// answer on. An answer that already has points awaits nothing, even in a teacher's review queue:
/// points awarded before the course turned chapter locking on stay awarded.
pub(super) fn pending_teacher_review(
    is_held_for_review_after_chapter_lock: bool,
    state: Option<&UserExerciseState>,
) -> Option<api::PendingTeacherReview> {
    let state = state.filter(|s| s.score_given.is_none())?;
    match state.reviewing_stage {
        ReviewingStage::WaitingForManualGrading => Some(api::PendingTeacherReview::AwaitsTeacher),
        ReviewingStage::NotStarted
            if is_held_for_review_after_chapter_lock
                && state.activity_progress != ActivityProgress::Initialized =>
        {
            Some(api::PendingTeacherReview::AwaitsChapterLock)
        }
        _ => None,
    }
}

/// A try-limited exercise's per-slide limit and how much of it is left on the user's slide.
#[derive(Debug, Clone, Copy)]
pub(super) struct TryCounts {
    max: i32,
    left: i32,
}

/// Derives the client-facing per-exercise progress from an exercise's maximum score and the
/// user's exercise state. `try_counts` is `None` when tries are unlimited.
pub(super) fn derive_exercise_progress(
    exercise_id: Uuid,
    score_maximum: i32,
    state: Option<&UserExerciseState>,
    is_out_of_tries: bool,
    try_counts: Option<TryCounts>,
    pending_teacher_review: Option<api::PendingTeacherReview>,
) -> api::ExerciseProgress {
    let score_given = state.and_then(|s| s.score_given);
    let activity_progress = state.map(|s| s.activity_progress).unwrap_or_default();
    let attempted = activity_progress != ActivityProgress::Initialized;
    let standing = if has_received_full_points(score_given, score_maximum) {
        api::ExerciseStanding::Passed
    } else if is_out_of_tries
        && !is_being_graded(state)
        && !is_in_peer_or_self_review(state)
        && pending_teacher_review.is_none()
    {
        api::ExerciseStanding::OutOfTries
    } else if attempted {
        api::ExerciseStanding::Attempted
    } else {
        api::ExerciseStanding::NotAttempted
    };
    api::ExerciseProgress {
        exercise_id,
        score_given: score_given.unwrap_or(0.0),
        score_maximum,
        completed: activity_progress == ActivityProgress::Completed,
        attempted,
        standing: Some(standing),
        max_tries: try_counts.map(|t| t.max),
        tries_left: try_counts.map(|t| t.left),
        pending_teacher_review,
        exercise_locked: state.is_some_and(|s| !s.reviewing_stage.accepts_submissions()),
        reviewing_stage: state.and_then(|s| to_api_reviewing_stage(s.reviewing_stage)),
        teacher_review: None,
    }
}

/// A grading still in progress can award full points, so the score is not final even when the
/// last try is spent.
pub(super) fn is_being_graded(state: Option<&UserExerciseState>) -> bool {
    state.is_some_and(|s| !s.grading_progress.is_complete())
}

/// Peer and self review can still award points, so the score is not final even when the last try
/// is spent.
pub(super) fn is_in_peer_or_self_review(state: Option<&UserExerciseState>) -> bool {
    state.is_some_and(|s| {
        matches!(
            s.reviewing_stage,
            ReviewingStage::PeerReview
                | ReviewingStage::SelfReview
                | ReviewingStage::WaitingForPeerReviews
        )
    })
}

/// `None` (never graded) is not full points even when the exercise is worth 0.
pub(super) fn has_received_full_points(score_given: Option<f32>, score_maximum: i32) -> bool {
    score_given.is_some_and(|score| models::exercises::is_full_points(score, score_maximum))
}

/**
 * GET /api/v0/exercise-services/client/courses/:id/progress
 *
 * Returns the current user's progress on every exercise of the course that lives in an
 * open chapter (the same visibility and order as `courses/:id/exercises`): its awarded and maximum
 * points, completed/attempted signals, standing and tries. Exercises of chapters that have not
 * opened yet come separately, under their chapter. One round-trip; course totals are derivable
 * by summing the returned entries.
 */
#[utoipa::path(
    get,
    path = "/courses/{id}/progress",
    operation_id = "getClientCourseProgress",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Course id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The user's per-exercise progress for the course's open chapters", body = api::CourseProgress),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`), or the user may not view this course (`no_access`)", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No course with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
pub(super) async fn get_course_progress(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    course: web::Path<Uuid>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::CourseProgress>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_course_access(&mut conn, user.id, *course).await?;

    let course = models::courses::get_course(&mut conn, *course).await?;
    let chapters = course_chapters(&mut conn, user.id, course.id).await?;

    // One read for the whole course instead of a query per exercise.
    let states = models::user_exercise_states::get_all_for_user_and_course_or_exam(
        &mut conn,
        user.id,
        CourseOrExamId::Course(course.id),
    )
    .await?;
    let mut state_by_exercise = std::collections::HashMap::new();
    for state in &states {
        state_by_exercise.insert(state.exercise_id, state);
    }

    let mut course_exercises =
        models::exercises::get_exercises_by_course_id(&mut conn, course.id).await?;
    let page_order_numbers: HashMap<Uuid, i32> =
        models::pages::get_pages_by_course_id(&mut conn, course.id)
            .await?
            .into_iter()
            .map(|page| (page.id, page.order_number))
            .collect();
    let all_chapters: HashMap<Uuid, DatabaseChapter> = chapters
        .open
        .values()
        .chain(chapters.closed.iter())
        .map(|chapter| (chapter.id, chapter.clone()))
        .collect();
    sort_in_material_order(&mut course_exercises, &all_chapters, &page_order_numbers);
    let closed_chapter_ids: HashSet<Uuid> = chapters.closed.iter().map(|c| c.id).collect();
    let chaptered_exercise_ids: Vec<Uuid> = course_exercises
        .iter()
        .filter(|e| {
            e.chapter_id.is_some_and(|id| {
                chapters.open.contains_key(&id) || closed_chapter_ids.contains(&id)
            })
        })
        .map(|e| e.id)
        .collect();
    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    let capable_exercise_ids =
        client_capable_exercise_ids(&mut conn, &chaptered_exercise_ids, &capable_slugs).await?;

    let mut exercises = Vec::new();
    let mut closed_chapter_exercises: HashMap<Uuid, Vec<api::ExerciseProgress>> = HashMap::new();
    for exercise in course_exercises {
        let Some(chapter_id) = exercise.chapter_id else {
            continue;
        };
        if !capable_exercise_ids.contains(&exercise.id) {
            continue;
        }
        let is_open = chapters.open.contains_key(&chapter_id);
        let progress = exercise_progress(
            &mut conn,
            user.id,
            &exercise,
            &course,
            state_by_exercise.get(&exercise.id).copied(),
        )
        .await?;
        if is_open {
            exercises.push(progress);
        } else {
            closed_chapter_exercises
                .entry(chapter_id)
                .or_default()
                .push(progress);
        }
    }
    let mut closed_chapters: Vec<api::ClosedChapter> = chapters
        .closed
        .into_iter()
        .filter_map(|chapter| {
            Some(api::ClosedChapter {
                exercises: closed_chapter_exercises.remove(&chapter.id)?,
                opens_at: chapter.opens_at?,
                id: chapter.id,
                name: chapter.name,
                chapter_number: chapter.chapter_number,
            })
        })
        .collect();
    closed_chapters.sort_by_key(|c| c.chapter_number);

    token.authorized_ok(web::Json(api::CourseProgress {
        course_id: course.id,
        exercises,
        closed_chapters,
    }))
}
