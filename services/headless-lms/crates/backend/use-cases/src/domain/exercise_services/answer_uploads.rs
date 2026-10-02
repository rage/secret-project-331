//! Deciding whether a submit may name the host-stored uploads it names.
//!
//! Two submit paths reach here: a native client names its uploads in the request body, and a
//! course-material IFrame answer names them inside its `current-state`. Both are equally
//! student-controlled, so the checks live here rather than in either caller — a second copy would
//! be a second thing to keep in step.

use crate::domain::error::{BadRequestReason, bad_request_with_reason};
use crate::prelude::*;
use models::exercise_answer_uploads::AnswerUpload;
use std::collections::HashSet;

/// Rejects a file-typed answer that names no files at all.
///
/// The named files are the answer, so an empty list is a claim with no content rather than an
/// answer that happens to need no files.
pub fn verify_answer_names_uploads(requested: &[Uuid]) -> Result<(), ControllerError> {
    if requested.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "A file answer must name at least one uploaded file.".to_string()
        ));
    }
    Ok(())
}

/// Rejects a submit naming a file the host has no usable upload record of.
///
/// Ownership alone would not be enough: without the exercise binding, any of the user's uploads
/// could be replayed into any other exercise's submission. A reaped upload is reported distinctly
/// from an unrecognised one, because only the former is a race a client can recover from by
/// uploading again.
pub fn verify_uploads_are_usable(
    requested: &[Uuid],
    found: &[AnswerUpload],
) -> Result<(), ControllerError> {
    for id in requested {
        match found.iter().find(|upload| &upload.file_upload_id == id) {
            Some(upload) if upload.deleted => {
                return Err(bad_request_with_reason(
                    BadRequestReason::UploadExpired,
                    format!("Uploaded file {id} is no longer available; upload it again"),
                ));
            }
            Some(_) => {}
            None => {
                return Err(bad_request_with_reason(
                    BadRequestReason::UnknownUpload,
                    format!("Uploaded file {id} was not uploaded for this exercise by this user"),
                ));
            }
        }
    }
    Ok(())
}

/// Rejects a submit naming the same upload twice.
///
/// Deduplicating instead would record the file twice under one submission and list it twice in a
/// download, and would hide a client defect while doing so. There is no answer a duplicate could
/// sensibly mean, so it is reported rather than repaired.
pub fn verify_uploads_are_distinct(requested: &[Uuid]) -> Result<(), ControllerError> {
    let mut seen = HashSet::with_capacity(requested.len());
    for id in requested {
        if !seen.insert(id) {
            return Err(bad_request_with_reason(
                BadRequestReason::DuplicateUpload,
                format!("Uploaded file {id} was named more than once"),
            ));
        }
    }
    Ok(())
}

/// Checks every id a submit names against the uploads recorded for this exercise and user.
///
/// Unlocked, so a caller that goes on to record the association must follow this with
/// [`lock_and_verify_uploads_are_usable`] inside that transaction.
pub async fn verify_uploads_belong_to_exercise(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    user_id: Uuid,
    requested: &[Uuid],
) -> Result<(), ControllerError> {
    verify_uploads_are_distinct(requested)?;
    let recorded = models::exercise_answer_uploads::get_for_exercise_and_user(
        conn,
        exercise_id,
        user_id,
        requested,
    )
    .await?;
    verify_uploads_are_usable(requested, &recorded)
}

/// Re-checks the named uploads under a row lock the reaper honours.
///
/// Must be called inside the transaction that records the association, and before anything that
/// depends on the uploads still being live. Repeating the unlocked check is the point: real time
/// passes between it and the commit, so only a locked re-check can stop a reap from landing in
/// between and returning 200 for a submission whose files are gone.
pub async fn lock_and_verify_uploads_are_usable(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    exercise_id: Uuid,
    user_id: Uuid,
    requested: &[Uuid],
) -> Result<(), ControllerError> {
    let locked = models::exercise_answer_uploads::lock_for_exercise_and_user(
        tx,
        exercise_id,
        user_id,
        requested,
    )
    .await?;
    verify_uploads_are_usable(requested, &locked)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::message_key_of;

    #[test]
    fn a_submission_naming_no_files_is_accepted() {
        assert!(verify_uploads_are_usable(&[], &[]).is_ok());
    }

    #[test]
    fn a_file_answer_must_name_at_least_one_upload() {
        assert!(verify_answer_names_uploads(&[Uuid::new_v4()]).is_ok());
        use actix_web::ResponseError;
        use actix_web::http::StatusCode;
        let error = verify_answer_names_uploads(&[])
            .expect_err("a file answer naming nothing must be rejected");
        assert_eq!(error.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[test]
    fn a_submission_naming_its_own_uploads_is_accepted() {
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let found = vec![
            AnswerUpload {
                file_upload_id: second,
                deleted: false,
            },
            AnswerUpload {
                file_upload_id: first,
                deleted: false,
            },
        ];
        // Lookup order must not matter; the client's order is what the caller preserves.
        assert!(verify_uploads_are_usable(&[first, second], &found).is_ok());
    }

    /// An upload bound to another exercise, or to another user, is not returned by the lookup at
    /// all, so it must be indistinguishable from an id that was never uploaded.
    #[test]
    fn a_submission_naming_a_foreign_upload_is_rejected_as_unknown() {
        use actix_web::ResponseError;
        use actix_web::http::StatusCode;
        let foreign = Uuid::new_v4();
        let error = verify_uploads_are_usable(&[foreign], &[])
            .expect_err("an upload not bound to this exercise and user must be rejected");
        assert_eq!(error.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(message_key_of(&error), "unknown_upload");
    }

    /// The reaper soft-deletes precisely so this stays distinguishable from `unknown_upload`: only
    /// this case is a race a client can recover from by uploading again.
    #[test]
    fn a_submission_naming_a_reaped_upload_is_rejected_as_expired() {
        use actix_web::ResponseError;
        use actix_web::http::StatusCode;
        let reaped = Uuid::new_v4();
        let error = verify_uploads_are_usable(
            &[reaped],
            &[AnswerUpload {
                file_upload_id: reaped,
                deleted: true,
            }],
        )
        .expect_err("a reaped upload must be rejected");
        assert_eq!(error.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(message_key_of(&error), "upload_expired");
    }

    /// One bad id among good ones must fail the whole submit rather than being dropped, or the
    /// exercise service would silently grade a partial answer.
    #[test]
    fn one_unusable_upload_rejects_the_whole_submission() {
        let good = Uuid::new_v4();
        let reaped = Uuid::new_v4();
        let found = vec![
            AnswerUpload {
                file_upload_id: good,
                deleted: false,
            },
            AnswerUpload {
                file_upload_id: reaped,
                deleted: true,
            },
        ];
        let error = verify_uploads_are_usable(&[good, reaped], &found).expect_err("must reject");
        assert_eq!(message_key_of(&error), "upload_expired");
    }

    #[test]
    fn a_submission_naming_distinct_uploads_is_accepted() {
        assert!(verify_uploads_are_distinct(&[]).is_ok());
        assert!(verify_uploads_are_distinct(&[Uuid::new_v4(), Uuid::new_v4()]).is_ok());
    }

    /// Deduplicating would record one file twice under a submission and list it twice in a
    /// download, so a duplicate is reported as the client bug it is.
    #[test]
    fn a_submission_naming_the_same_upload_twice_is_rejected() {
        use actix_web::ResponseError;
        use actix_web::http::StatusCode;
        let repeated = Uuid::new_v4();
        let error = verify_uploads_are_distinct(&[repeated, Uuid::new_v4(), repeated])
            .expect_err("a repeated upload id must be rejected");
        assert_eq!(error.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(message_key_of(&error), "duplicate_upload");
    }
}
