//! Putting a course's failed registrations back on the pipeline, one row or a whole course at a time.

use headless_lms_models::course_credit_registration_consents;
use headless_lms_models::credit_registration_admin_actions::{
    COURSE_TEACHER_ROLE, CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registrations::{
    self, CreditRegistrationState, ResubmissionRefusal, ResubmissionStrictness, Transition,
};
use std::collections::{HashMap, HashSet};
use utoipa::ToSchema;

use crate::prelude::*;

/// A single call never puts more than this back on the pipeline. A course that has more says so in
/// `more_rows_remaining` and is retried by clicking again.
const MAX_ROWS_PER_BULK_RETRY: i64 = 500;

#[derive(Debug, Deserialize, ToSchema)]
pub struct RetryCreditRegistrationPayload {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct RetryCreditRegistrationResult {
    /// Why the row was left alone, or `null` when it went back on the pipeline.
    pub refusal: Option<ResubmissionRefusal>,
    /// Where the row stands after the attempt, whatever the answer.
    pub state: CreditRegistrationState,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct RetryCreditRegistrationSkip {
    pub refusal: ResubmissionRefusal,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct RetryFailedCreditRegistrationsResult {
    pub retried_count: i64,
    /// Why the rest were left alone, so a teacher can see the admin-only pile rather than wonder.
    /// Course-wide, not capped: clicking again will not work through these.
    pub skipped: Vec<RetryCreditRegistrationSkip>,
    /// How many retriable rows this call took, which is what `max_rows_per_call` bounds.
    pub considered_count: i64,
    pub max_rows_per_call: i64,
    /// The cap stopped short of the course's retriable failures; running it again takes the next batch.
    pub more_rows_remaining: bool,
}

/**
POST `/api/v0/main-frontend/course-credit-registrations/registrations/{credit_registration_id}/retry`
- Puts one failed registration back on the pipeline.

Authorized on the row's own course, which is why no course id appears in the path: a teacher of one
course must not be able to pair it with a foreign registration id.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/registrations/{credit_registration_id}/retry",
    operation_id = "retryCreditRegistration",
    tag = "course-credit-registrations",
    params(("credit_registration_id" = Uuid, Path, description = "Credit registration id")),
    request_body = RetryCreditRegistrationPayload,
    responses(
        (status = 200, description = "What the retry did", body = RetryCreditRegistrationResult),
        (status = 404, description = "No such registration")
    )
)]
pub async fn retry_credit_registration(
    user: AuthUser,
    pool: web::Data<PgPool>,
    credit_registration_id: web::Path<Uuid>,
    payload: web::Json<RetryCreditRegistrationPayload>,
) -> ControllerResult<web::Json<RetryCreditRegistrationResult>> {
    let mut conn = pool.acquire().await?;
    let id = *credit_registration_id;
    let row = models::credit_registrations::get_teacher_facing_by_id(&mut conn, id)
        .await?
        .ok_or_else(|| controller_err!(NotFound, "Not found.".to_string()))?;
    let token =
        super::authorize_credit_registration_teacher(&mut conn, user.id, row.course_id).await?;

    let reason = non_empty(payload.reason.as_deref());
    let consented = course_credit_registration_consents::get_by_user_and_course(
        &mut conn,
        row.user_id,
        row.course_id,
    )
    .await?
    .is_some_and(|consent| consent.consent_given);
    let refusal = row.state.resubmission_refusal(
        row.superseded_by_id.is_some(),
        consented,
        ResubmissionStrictness::OnlyFailedPermanent,
    );

    let mut tx = conn.begin().await?;
    let state = match refusal {
        None => requeue(&mut tx, id, row.state, user.id, reason).await?,
        Some(_) => row.state,
    };
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(id),
            actor_course_id: Some(row.course_id),
            reason: reason.map(str::to_string),
            before_state: Some(row.state),
            after_state: Some(state),
            details: Some(serde_json::json!({ "refusal": refusal })),
            affected_row_count: Some(i32::from(refusal.is_none())),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::RetryItem,
                CreditRegistrationAdminActionTarget::CreditRegistration,
                user.id,
                COURSE_TEACHER_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(RetryCreditRegistrationResult { refusal, state }))
}

/**
POST `/api/v0/main-frontend/course-credit-registrations/courses/{course_id}/retry-failed` - Puts this
course's failed registrations back on the pipeline.

Refuses the same rows the single-row retry refuses and reports how many of each it left alone rather
than failing the whole call over them. The cap applies to the rows a retry can actually move: the
refused ones are counted across the whole course, because they would otherwise sit in the batch
forever and a course that accumulated a capful of them could never retry anything again.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/courses/{course_id}/retry-failed",
    operation_id = "retryFailedCreditRegistrationsForCourse",
    tag = "course-credit-registrations",
    params(("course_id" = Uuid, Path, description = "Course id")),
    request_body = RetryCreditRegistrationPayload,
    responses(
        (status = 200, description = "How many were retried and why the rest were not", body = RetryFailedCreditRegistrationsResult)
    )
)]
pub async fn retry_failed_credit_registrations_for_course(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<RetryCreditRegistrationPayload>,
) -> ControllerResult<web::Json<RetryFailedCreditRegistrationsResult>> {
    let mut conn = pool.acquire().await?;
    let token =
        super::authorize_credit_registration_teacher(&mut conn, user.id, *course_id).await?;

    let reason = non_empty(payload.reason.as_deref());
    // One over the cap, so "there is more" is answered without a second count query.
    let mut candidate_ids = models::credit_registrations::get_retryable_ids_by_course_id(
        &mut conn,
        *course_id,
        MAX_ROWS_PER_BULK_RETRY + 1,
    )
    .await?;
    let more_rows_remaining = candidate_ids.len() as i64 > MAX_ROWS_PER_BULK_RETRY;
    candidate_ids.truncate(MAX_ROWS_PER_BULK_RETRY as usize);
    // The permanent refusals are counted over the whole course rather than walked: they are the rows
    // the query above leaves out, so clicking again will never reach them either.
    let unretryable =
        models::credit_registrations::count_unretryable_by_course_id(&mut conn, *course_id).await?;

    let mut retried_count = 0;
    let mut skipped: HashMap<ResubmissionRefusal, i64> = unretryable.into_iter().collect();

    let mut tx = conn.begin().await?;
    // Locked, and read inside the transaction: each row's refusal is judged here and acted on below,
    // so a row the pipeline moves in between would make `requeue` refuse it and roll back every row
    // already retried, which is what two teachers clicking at once would otherwise do to each other.
    let candidates =
        models::credit_registrations::get_by_ids_for_update(&mut tx, &candidate_ids).await?;
    let consenting: HashSet<Uuid> =
        course_credit_registration_consents::get_consenting_user_ids_for_course(
            &mut tx, *course_id,
        )
        .await?
        .into_iter()
        .collect();
    let mut retried_ids = Vec::new();
    for row in &candidates {
        // Re-judged rather than trusted from the query above, which ran before the lock: consent can
        // be withdrawn and the row moved on in between, and both are ordinary refusals. Same
        // precedence as the single-row endpoint, so one row gets one answer whichever way it is asked.
        let refusal = row.state.resubmission_refusal(
            row.superseded_by_id.is_some(),
            consenting.contains(&row.user_id),
            ResubmissionStrictness::OnlyFailedPermanent,
        );
        match refusal {
            Some(refusal) => *skipped.entry(refusal).or_insert(0) += 1,
            None => {
                transition_to_ready_to_submit(&mut tx, row.id, row.state, user.id, reason).await?;
                retried_ids.push(row.id);
                retried_count += 1;
            }
        }
    }
    // Batched rather than one `UPDATE` per row inside the loop above: the row transition needs its
    // own audit event per row, but making it due now does not.
    credit_registrations::make_due_now_batch(&mut tx, &retried_ids).await?;
    let mut skipped: Vec<RetryCreditRegistrationSkip> = skipped
        .into_iter()
        .map(|(refusal, count)| RetryCreditRegistrationSkip { refusal, count })
        .collect();
    skipped.sort_by_key(|skip| std::cmp::Reverse(skip.count));

    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(*course_id),
            actor_course_id: Some(*course_id),
            reason: reason.map(str::to_string),
            details: Some(serde_json::json!({ "skipped": skipped })),
            affected_row_count: Some(i32::try_from(retried_count).unwrap_or(i32::MAX)),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::RetryFailedForCourse,
                CreditRegistrationAdminActionTarget::Course,
                user.id,
                COURSE_TEACHER_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(RetryFailedCreditRegistrationsResult {
        retried_count,
        skipped,
        considered_count: candidates.len() as i64,
        max_rows_per_call: MAX_ROWS_PER_BULK_RETRY,
        more_rows_remaining,
    }))
}

/// Moves one row back to `ready_to_submit`, in the caller's transaction.
///
/// `from_state` is the state the refusals above were judged against; the transition refuses to
/// overwrite the row if the pipeline has since moved it on. Does not make the row due: the
/// single-row caller does that itself right after, and the bulk caller batches it over every row it
/// retried instead of one `UPDATE` per row.
async fn transition_to_ready_to_submit(
    tx: &mut PgConnection,
    id: Uuid,
    from_state: CreditRegistrationState,
    actor_user_id: Uuid,
    reason: Option<&str>,
) -> Result<CreditRegistrationState, ControllerError> {
    let after = credit_registrations::transition(
        tx,
        id,
        &Transition {
            needs_admin_attention: Some(false),
            event_kind: CreditRegistrationEventKind::AdminAction,
            event_message: Some(
                reason
                    .map(str::to_string)
                    .unwrap_or_else(|| "Retried by a teacher of the course.".to_string()),
            ),
            actor_user_id: Some(actor_user_id),
            expected_from_state: Some(from_state),
            ..Transition::by_hand(CreditRegistrationState::ReadyToSubmit)
        },
    )
    .await?;
    Ok(after.state)
}

/// [`transition_to_ready_to_submit`] plus making the row due now, for the single-row endpoint.
async fn requeue(
    tx: &mut PgConnection,
    id: Uuid,
    from_state: CreditRegistrationState,
    actor_user_id: Uuid,
    reason: Option<&str>,
) -> Result<CreditRegistrationState, ControllerError> {
    let state = transition_to_ready_to_submit(tx, id, from_state, actor_user_id, reason).await?;
    // Nothing else brings the row forward, so without this the retry sits out whatever backoff the
    // last failure set.
    credit_registrations::make_due_now_batch(tx, &[id]).await?;
    Ok(state)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/registrations/{credit_registration_id}/retry",
        web::post().to(retry_credit_registration),
    )
    .route(
        "/courses/{course_id}/retry-failed",
        web::post().to(retry_failed_credit_registrations_for_course),
    );
}
