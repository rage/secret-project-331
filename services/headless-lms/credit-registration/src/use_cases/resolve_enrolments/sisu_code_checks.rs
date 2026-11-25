//! Asks Sisu, through the enrolment lookup's existing attainments, whether students hold course
//! codes no ledger row of theirs is under: the equivalent older codes of a mooc.fi row's code,
//! which the enrolment lookup then settles the row against, and the prerequisite of a row waiting
//! for it, with that code's equivalents. Runs after the enrolment lookup, which takes up a row it
//! skipped for unasked equivalents on a later tick.

use headless_lms_models::credit_registration_sisu_code_checks::{self, get_due};
use headless_lms_models::library::credit_registration::enrolment_selection::attained_candidates;
use secrecy::ExposeSecret;
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::registry::{
    BatchEntry, BatchOptions, BatchReply, CourseCode, EnrolmentLookup, RegistryOperation,
    StudentNumber, StudyRegistry,
};
use crate::use_cases::batch_flow::BatchFlowContext;
use crate::workflow::Counts;

/// The student and code one lookup is about.
struct CodeCheck {
    user_id: Uuid,
    course_code: String,
}

pub(super) async fn run<R: StudyRegistry>(
    ctx: &BatchFlowContext<'_>,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    let limit = registry.allowance(RegistryOperation::ResolveEnrolments);
    if limit == 0 {
        return Ok(Counts::default());
    }
    let due = {
        let mut conn = ctx.pool.acquire().await?;
        get_due(
            &mut conn,
            ctx.scope,
            i64::try_from(limit).unwrap_or(i64::MAX),
        )
        .await?
    };
    let mut registration_ids = Vec::new();
    let mut entries = Vec::new();
    for check in due {
        // A code Suotar could not be asked about is left unasked, and its rows wait.
        let Some(course_code) = CourseCode::parse(&check.course_code) else {
            continue;
        };
        registration_ids.extend(check.credit_registration_ids);
        entries.push(BatchEntry {
            row: CodeCheck {
                user_id: check.user_id,
                course_code: check.course_code,
            },
            request: EnrolmentLookup {
                student_number: StudentNumber::new(
                    check.student_number.expose_secret().to_string(),
                ),
                course_code,
            },
        });
    }
    if entries.is_empty() {
        return Ok(Counts::default());
    }
    let options = BatchOptions {
        may_split: false,
        is_resent_half: false,
        all_unavailable_error: "Every Sisu course code check came back unavailable.",
        registration_ids,
    };
    let BatchReply::Answered(rows) = registry.resolve_enrolments(entries, options).await else {
        // Unrecorded, so the same pairs are due again next tick.
        return Ok(Counts::default());
    };
    let mut conn = ctx.pool.acquire().await?;
    let mut recorded = 0;
    for row in rows {
        // Any answer settles the question for now, a refusal such as an unknown old code included.
        let Some(answer) = row.answer else {
            continue;
        };
        let is_attained = !attained_candidates(&answer.existing_attainments).is_empty();
        credit_registration_sisu_code_checks::record(
            &mut conn,
            row.row.user_id,
            &row.row.course_code,
            is_attained,
        )
        .await?;
        recorded += 1;
    }
    Ok(Counts::processed(recorded))
}
