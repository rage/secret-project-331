//! Per-item world-state resolution: pure functions over the working set, with `now` passed in.
//!
//! The caller resolves faults ahead of this, so per item the order is first matching fault, then here.

use chrono::{Duration, Months, NaiveDate};

use crate::prelude::*;

use super::ids;
use super::wire::{
    self, AttainmentReference, AttainmentSummary, COURSE_NOT_CARRIED, CourseAllowedResult,
    DuplicateAttainmentResult, Endpoint, EnrolmentResolutionResult, EnrolmentsListedResult,
    ExistingAttainment, ListedEnrolment, ListedPerson, NotImprovedAttainmentResult,
    RegisteredResult, ResponseItem, SubmissionPendingResult, SubmittedAttainment, iso_millis,
    sisu_midnight,
};
use super::world::{
    AttainmentState, EnrolmentState, ImporterVisibility, MockAttainment, MockCourseUnit,
    MockEnrolment, MockRealisation, MockStudyRight, MockSubmission, PENDING_WINDOW_HOURS,
    REFUSED_COURSE_CODES, SendState, WorkingSet, WorldWrite, person_course_key,
};

/// Suotar's approver violation, as its translation table words it.
const NO_ACCEPTORS_VIOLATION: &str = "Approver is required.";

pub fn resolve_person_item(
    item: &wire::ResolvePersonRequestItem,
    working: &WorkingSet,
) -> ResponseItem {
    match working.persons.get(&item.student_number) {
        Some(person) => ResponseItem::ok(
            &item.request_item_id,
            "personFound",
            wire::PersonResult {
                student_number: person.student_number.clone(),
                person_id: person.person_id.clone(),
                first_names: person.first_names.clone(),
                last_name: person.last_name.clone(),
            },
        ),
        None => ResponseItem::error(
            Endpoint::ResolvePersons,
            &item.request_item_id,
            "personNotFound",
        ),
    }
}

pub fn resolve_enrolments_item(
    item: &wire::ResolveEnrolmentRequestItem,
    working: &WorkingSet,
) -> ResponseItem {
    let endpoint = Endpoint::ResolveEnrolments;
    let id = &item.request_item_id;
    if !working.persons.contains_key(&item.student_number) {
        return ResponseItem::error(endpoint, id, "personNotFound");
    }
    let Some(course_unit) = working.course_units.get(&item.course_code) else {
        return ResponseItem::error(endpoint, id, "courseCodeNotFound");
    };

    // The importer hands over ENROLLED enrolments only, so `enrolmentNotAccepted` is unreachable.
    let mut enrolled: Vec<&MockEnrolment> =
        enrolments_for(working, &item.student_number, &item.course_code)
            .into_iter()
            .filter(|enrolment| enrolment.state == EnrolmentState::Enrolled)
            .collect();
    enrolled.sort_by_key(|enrolment| enrolment.enrolment_date_time);
    let enrolments: Vec<wire::Enrolment> = enrolled
        .into_iter()
        .filter_map(|enrolment| {
            course_unit
                .realisation(&enrolment.realisation_id)
                .map(|realisation| enrolment_dto(course_unit, enrolment, realisation))
        })
        .collect();
    if enrolments.is_empty() {
        return ResponseItem::error(endpoint, id, "enrolmentNotFound");
    }

    let mut existing: Vec<&MockAttainment> =
        attainments_for(working, &item.student_number, &item.course_code);
    existing.sort_by(|a, b| {
        a.attainment_date
            .cmp(&b.attainment_date)
            .then_with(|| a.id.cmp(&b.id))
    });

    ResponseItem::ok(
        id,
        "enrolmentFound",
        EnrolmentResolutionResult {
            enrolments,
            existing_attainments: existing.into_iter().map(existing_attainment).collect(),
        },
    )
}

/// What resolving one import item comes to before anything is written.
pub enum ImportResolution {
    Answered(ResponseItem),
    /// Survived every check; the submission to write, not yet sent.
    Write(Box<MockSubmission>),
}

/// Suotar's checks in its own order, first failure wins.
pub fn resolve_import_item(
    item: &wire::ImportAttainmentRequestItem,
    working: &WorkingSet,
    now: DateTime<Utc>,
) -> ImportResolution {
    let endpoint = Endpoint::ImportAttainments;
    let id = &item.request_item_id;
    let error = |code: &str| ImportResolution::Answered(ResponseItem::error(endpoint, id, code));
    let error_with_message = |code: &str, message: String| {
        ImportResolution::Answered(ResponseItem::error_with_message(id, code, message))
    };

    let course_unit = working.course_units.get(&item.course_code);
    if let Some(reason) = course_not_allowed_reason(&item.course_code, course_unit) {
        return error_with_message("courseNotAllowed", reason);
    }
    let Some(course_unit) = course_unit else {
        return error_with_message("courseNotAllowed", COURSE_NOT_CARRIED.to_string());
    };
    let Some(person) = working.persons.get(&item.student_number) else {
        return error("personNotFound");
    };
    let enrolment = working
        .enrolments
        .get(&item.enrolment_id)
        .filter(|enrolment| {
            enrolment.student_number == item.student_number
                && enrolment.course_code == item.course_code
                && enrolment.state == EnrolmentState::Enrolled
        });
    let Some((enrolment, realisation)) = enrolment.and_then(|enrolment| {
        course_unit
            .realisation(&enrolment.realisation_id)
            .map(|realisation| (enrolment, realisation))
    }) else {
        return error("enrolmentNotFound");
    };

    let Some(credits) = &course_unit.credits else {
        return error_with_message(
            "invalidCredits",
            format!(
                "Sisu gives no credit range for course {}.",
                item.course_code
            ),
        );
    };
    // An open maximum refuses every positive amount, as JavaScript's `credits <= null` does.
    if item.credits < credits.min || credits.max.is_none_or(|max| item.credits > max) {
        return error_with_message(
            "invalidCredits",
            format!(
                "Credits must be between {} and {} for course {}.",
                credits.min,
                credits
                    .max
                    .map_or_else(|| "null".to_string(), |max| max.to_string()),
                item.course_code
            ),
        );
    }

    let grade_scale_id = course_unit.grade_scale_for(realisation);
    if let Some(expected) = &grade_scale_id
        && &item.grade_scale_id != expected
    {
        return error_with_message(
            "gradeScaleMismatch",
            format!(
                "Grade scale {} was sent, but the enrolment is graded on {expected}.",
                item.grade_scale_id
            ),
        );
    }
    let is_known_grade = grade_scale_id
        .as_deref()
        .and_then(|scale_id| working.defaults.scale(scale_id))
        .is_some_and(|scale| scale.grade(&item.grade_id).is_some());
    if !is_known_grade {
        return error("invalidGradeForGradeScale");
    }

    let incoming = IncomingGrade::of(&item.grade_scale_id, &item.grade_id);
    let mut earlier: Vec<&MockAttainment> =
        attainments_for(working, &item.student_number, &item.course_code)
            .into_iter()
            .filter(|attainment| attainment.state != AttainmentState::Misregistered)
            .collect();
    earlier.sort_by_key(|attainment| std::cmp::Reverse(attainment.attainment_date));
    // Suotar reports the newest attainment on the course, not necessarily the one that decided.
    if let Some(newest) = earlier.first() {
        if earlier
            .iter()
            .any(|attainment| is_identical(attainment, incoming, item, working))
        {
            return ImportResolution::Answered(ResponseItem::ok(
                id,
                "duplicateAttainment",
                DuplicateAttainmentResult {
                    attainment: attainment_summary(newest),
                },
            ));
        }
        if !earlier
            .iter()
            .all(|attainment| beats(incoming, attainment, item, working))
        {
            return ImportResolution::Answered(ResponseItem::ok(
                id,
                "notImprovedAttainment",
                NotImprovedAttainmentResult {
                    previous_attainment: attainment_summary(newest),
                },
            ));
        }
    }

    let adjusted_attainment_date = match &enrolment.study_right {
        Some(study_right) => clamp_into_study_right(item.attainment_date, study_right),
        None if person.behaviour.study_right_unresolvable => return error("studyRightNotValid"),
        None => item.attainment_date,
    };

    ImportResolution::Write(Box::new(MockSubmission {
        submitted_attainment_id: ids::submitted_attainment_id(),
        request_item_id: id.clone(),
        student_number: item.student_number.clone(),
        course_code: item.course_code.clone(),
        enrolment_id: enrolment.id.clone(),
        realisation_id: realisation.id.clone(),
        person_id: person.person_id.clone(),
        course_unit_id: course_unit.course_unit_id.clone(),
        assessment_item_id: realisation.assessment_item_id.clone(),
        attainment_date: item.attainment_date,
        adjusted_attainment_date,
        attainment_language: item.attainment_language.clone(),
        grade_scale_id: item.grade_scale_id.clone(),
        grade_id: item.grade_id.clone(),
        credits: item.credits,
        send_state: SendState::NotSent,
        violations: Vec::new(),
        importer: ImporterVisibility::None,
        created_at: now,
    }))
}

/// Whether the batch's acceptor lookup would fail for any of these submissions' course units.
pub fn acceptor_lookup_fails(working: &WorkingSet, submissions: &[MockSubmission]) -> bool {
    submissions.iter().any(|submission| {
        working
            .course_units
            .get(&submission.course_code)
            .is_some_and(|unit| unit.behaviour.acceptor_lookup_fails)
    })
}

/// Writes the submission and sends it: refused by Sisu when the world holds violations for it, accepted
/// otherwise.
pub fn write_and_send(working: &mut WorkingSet, mut submission: MockSubmission) -> ResponseItem {
    let mut violations = working
        .sisu_violations
        .get(&person_course_key(
            &submission.student_number,
            &submission.course_code,
        ))
        .cloned()
        .unwrap_or_default();
    if working
        .course_units
        .get(&submission.course_code)
        .is_some_and(|unit| unit.behaviour.no_acceptors)
    {
        violations.push(NO_ACCEPTORS_VIOLATION.to_string());
    }
    submission.send_state = if violations.is_empty() {
        SendState::Accepted
    } else {
        SendState::Rejected
    };
    submission.violations = violations;
    let outcome = import_outcome(&submission);
    record_submission(working, submission);
    outcome
}

/// Read back from the submission, the way Suotar answers after its send.
pub fn import_outcome(submission: &MockSubmission) -> ResponseItem {
    let id = &submission.request_item_id;
    match submission.send_state {
        SendState::Rejected => {
            let message = if submission.violations.is_empty() {
                "Sisu rejected the attainment.".to_string()
            } else {
                format!(
                    "Sisu rejected the attainment: {}",
                    submission.violations.join("; ")
                )
            };
            ResponseItem::error_with_message(id, "sisuValidationFailed", message)
        }
        SendState::Accepted => ResponseItem::ok(
            id,
            "sent",
            SubmittedAttainment::new(&submission.submitted_attainment_id),
        ),
        SendState::Attempted | SendState::NotSent => {
            ResponseItem::error(Endpoint::ImportAttainments, id, "sisuTimeout").with_result(
                SubmittedAttainment::new(&submission.submitted_attainment_id),
            )
        }
    }
}

pub fn verify_item(
    item: &wire::VerifyAttainmentRequestItem,
    working: &WorkingSet,
    now: DateTime<Utc>,
) -> ResponseItem {
    let endpoint = Endpoint::VerifyAttainments;
    let id = &item.request_item_id;
    let registered = |attainment_id: &str, attainment_type: &str| {
        ResponseItem::ok(
            id,
            "registered",
            RegisteredResult {
                attainment: AttainmentReference {
                    id: attainment_id.to_string(),
                    attainment_type: attainment_type.to_string(),
                },
            },
        )
    };

    if let Some(submission) = working.submissions.get(&item.submitted_attainment_id) {
        return match &submission.importer {
            ImporterVisibility::Misregistered { .. } => {
                ResponseItem::error(endpoint, id, "misregistered")
            }
            ImporterVisibility::Partial { attainment_id } => {
                registered(attainment_id, wire::ASSESSMENT_ITEM_ATTAINMENT)
            }
            ImporterVisibility::Final { attainment_id } => {
                registered(attainment_id, wire::COURSE_UNIT_ATTAINMENT)
            }
            ImporterVisibility::None if is_pending(submission, now) => {
                ResponseItem::error(endpoint, id, "submissionPending").with_result(
                    SubmissionPendingResult {
                        submitted_attainment_id: submission.submitted_attainment_id.clone(),
                        submitted_attainment_type: wire::ASSESSMENT_ITEM_ATTAINMENT.to_string(),
                        retry_after: iso_millis(retry_after(submission, now)),
                    },
                )
            }
            ImporterVisibility::None => ResponseItem::error(endpoint, id, "notRegistered"),
        };
    }
    match working.attainments.get(&item.submitted_attainment_id) {
        Some(attainment) if attainment.state == AttainmentState::Misregistered => {
            ResponseItem::error(endpoint, id, "misregistered")
        }
        Some(attainment) => registered(&attainment.id, &attainment.attainment_type),
        None => ResponseItem::error(endpoint, id, "notRegistered"),
    }
}

/// An accepted send stays pending for good: Sisu took it, so `notRegistered` would invite a second.
fn is_pending(submission: &MockSubmission, now: DateTime<Utc>) -> bool {
    match submission.send_state {
        SendState::Accepted => true,
        SendState::Attempted => submission.created_at > now - Duration::hours(PENDING_WINDOW_HOURS),
        SendState::NotSent | SendState::Rejected => false,
    }
}

fn retry_after(submission: &MockSubmission, now: DateTime<Utc>) -> DateTime<Utc> {
    let scheduled = submission.created_at + Duration::hours(PENDING_WINDOW_HOURS);
    if scheduled > now {
        scheduled
    } else {
        now + Duration::hours(PENDING_WINDOW_HOURS)
    }
}

/// Only realisations whose activity period ends after two months ago are listed; one with no end
/// date never is.
pub fn list_by_course_item(
    item: &wire::CourseCodeRequestItem,
    working: &WorkingSet,
    now: DateTime<Utc>,
) -> ResponseItem {
    let id = &item.request_item_id;
    let not_found = || ResponseItem::error(Endpoint::ListByCourse, id, "courseCodeNotFound");
    let Some(course_unit) = working.course_units.get(&item.course_code) else {
        return not_found();
    };
    let cutoff = (now - Months::new(2)).date_naive();
    let current: Vec<&MockRealisation> = course_unit
        .realisations
        .iter()
        .filter(|realisation| {
            realisation
                .activity_period
                .as_ref()
                .is_some_and(|period| period.end_date.is_some_and(|end| end > cutoff))
        })
        .collect();
    if current.is_empty() {
        return not_found();
    }

    let people = current
        .into_iter()
        .flat_map(|realisation| {
            let mut enrolments: Vec<&MockEnrolment> = working
                .enrolments_by_realisation
                .get(&realisation.id)
                .into_iter()
                .flatten()
                .filter_map(|enrolment_id| working.enrolments.get(enrolment_id))
                .filter(|enrolment| enrolment.state == EnrolmentState::Enrolled)
                .collect();
            enrolments.sort_by(|a, b| a.student_number.cmp(&b.student_number));
            enrolments
        })
        .filter_map(|enrolment| {
            let person = working.persons.get(&enrolment.student_number)?;
            Some(ListedPerson {
                student_number: person.student_number.clone(),
                person_id: person.person_id.clone(),
                first_names: person.first_names.clone(),
                last_name: person.last_name.clone(),
                primary_email: person.primary_email.clone(),
                secondary_email: person.secondary_email.clone(),
                enrolment: ListedEnrolment {
                    id: enrolment.id.clone(),
                    course_unit_realisation_id: enrolment.realisation_id.clone(),
                    state: "ENROLLED".to_string(),
                    enrolment_date_time: iso_millis(enrolment.enrolment_date_time),
                },
            })
        })
        .collect();

    ResponseItem::ok(id, "enrolmentsListed", EnrolmentsListedResult { people })
}

pub fn validate_course_code_item(
    item: &wire::CourseCodeRequestItem,
    working: &WorkingSet,
) -> ResponseItem {
    let course_unit = working.course_units.get(&item.course_code);
    match (
        course_not_allowed_reason(&item.course_code, course_unit),
        course_unit.and_then(|unit| unit.suotar_course.as_ref()),
    ) {
        (None, Some(course)) => ResponseItem::ok(
            &item.request_item_id,
            "courseAllowed",
            CourseAllowedResult {
                course_code: item.course_code.clone(),
                name: course.name.clone(),
            },
        ),
        (reason, _) => ResponseItem::error_with_message(
            &item.request_item_id,
            "courseNotAllowed",
            reason.unwrap_or_else(|| COURSE_NOT_CARRIED.to_string()),
        ),
    }
}

fn course_not_allowed_reason(
    course_code: &str,
    course_unit: Option<&MockCourseUnit>,
) -> Option<String> {
    if REFUSED_COURSE_CODES.contains(&course_code) {
        return Some(format!(
            "{course_code} cannot be registered through this API yet."
        ));
    }
    if course_unit
        .and_then(|unit| unit.suotar_course.as_ref())
        .is_none()
    {
        return Some(COURSE_NOT_CARRIED.to_string());
    }
    None
}

pub fn record_submission(working: &mut WorkingSet, submission: MockSubmission) {
    let id = submission.submitted_attainment_id.clone();
    let key = person_course_key(&submission.student_number, &submission.course_code);
    let write = WorldWrite::IndexSubmission {
        student_number: submission.student_number.clone(),
        course_code: submission.course_code.clone(),
    };
    working.submissions.insert(id.clone(), submission);
    let index = working.submissions_by_person_course.entry(key).or_default();
    if !index.contains(&id) {
        index.push(id.clone());
    }
    working.writes.push(WorldWrite::UpsertSubmission(id));
    working.writes.push(write);
}

/// A date on or before the start moves to the start, one on or after the end to the day before it,
/// and nothing may precede a grant date that falls inside the validity.
fn clamp_into_study_right(date: NaiveDate, study_right: &MockStudyRight) -> NaiveDate {
    let validity = &study_right.validity;
    let mut adjusted = match validity.end_date {
        _ if date <= validity.start_date => validity.start_date,
        Some(end_date) if date >= end_date => end_date - Duration::days(1),
        _ => date,
    };
    if let Some(grant_date) = study_right.grant_date
        && grant_date > validity.start_date
        && validity
            .end_date
            .is_none_or(|end_date| grant_date < end_date)
        && adjusted < grant_date
    {
        adjusted = grant_date;
    }
    adjusted
}

/// The Finnish grade string Suotar ranks by: 1–5, "Hyv." or a fail.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum IncomingGrade {
    Numeric(i32),
    Pass,
    Fail,
}

impl IncomingGrade {
    fn of(grade_scale_id: &str, grade_id: &str) -> Self {
        match (grade_scale_id, grade_id.parse::<i32>().ok()) {
            ("sis-0-5", Some(value @ 1..=5)) => Self::Numeric(value),
            ("sis-hyl-hyv", Some(1)) => Self::Pass,
            _ => Self::Fail,
        }
    }
}

/// A pass/fail attainment has no numeric correspondence, which Suotar compares as zero.
fn numeric_grade(attainment: &MockAttainment) -> i32 {
    if attainment.grade_scale_id == "sis-0-5" {
        attainment.grade_id.parse().unwrap_or(0)
    } else {
        0
    }
}

fn is_passed(attainment: &MockAttainment, working: &WorkingSet) -> bool {
    attainment.passed.unwrap_or_else(|| {
        working
            .defaults
            .scale(&attainment.grade_scale_id)
            .and_then(|scale| scale.grade(&attainment.grade_id))
            .is_some_and(|grade| grade.passed)
    })
}

fn credits_of(attainment: &MockAttainment, item: &wire::ImportAttainmentRequestItem) -> f64 {
    attainment.credits.unwrap_or(item.credits)
}

fn is_identical(
    attainment: &MockAttainment,
    incoming: IncomingGrade,
    item: &wire::ImportAttainmentRequestItem,
    working: &WorkingSet,
) -> bool {
    let same_grade = match incoming {
        IncomingGrade::Numeric(value) => {
            attainment.grade_scale_id == "sis-0-5" && numeric_grade(attainment) == value
        }
        IncomingGrade::Pass => {
            attainment.grade_scale_id == "sis-hyl-hyv" && attainment.grade_id == "1"
        }
        IncomingGrade::Fail => !is_passed(attainment, working),
    };
    same_grade
        && attainment.attainment_date == item.attainment_date
        && credits_of(attainment, item) == item.credits
}

/// Higher grade wins; with equal grades more credits win; with those equal too a later date wins,
/// by more than a day on the 0–5 scale. A fail never beats a pass.
fn beats(
    incoming: IncomingGrade,
    attainment: &MockAttainment,
    item: &wire::ImportAttainmentRequestItem,
    working: &WorkingSet,
) -> bool {
    let credits = credits_of(attainment, item);
    let later_than =
        |days: i64| item.attainment_date - Duration::days(days) > attainment.attainment_date;
    let tie_break = |days: i64| {
        if credits != item.credits {
            credits < item.credits
        } else {
            later_than(days)
        }
    };
    match incoming {
        IncomingGrade::Numeric(value) => {
            let existing = numeric_grade(attainment);
            if existing != value {
                existing < value
            } else {
                tie_break(1)
            }
        }
        IncomingGrade::Pass => !is_passed(attainment, working) || tie_break(0),
        IncomingGrade::Fail => !is_passed(attainment, working) && tie_break(0),
    }
}

fn attainments_for<'a>(
    working: &'a WorkingSet,
    student_number: &str,
    course_code: &str,
) -> Vec<&'a MockAttainment> {
    working
        .attainments_by_person_course
        .get(&person_course_key(student_number, course_code))
        .into_iter()
        .flatten()
        .filter_map(|id| working.attainments.get(id))
        .collect()
}

fn existing_attainment(attainment: &MockAttainment) -> ExistingAttainment {
    ExistingAttainment {
        id: attainment.id.clone(),
        attainment_type: attainment.attainment_type.clone(),
        state: attainment.state.wire_state().to_string(),
        person_id: attainment.person_id.clone(),
        course_unit_id: attainment.course_unit_id.clone(),
        assessment_item_id: attainment.assessment_item_id.clone(),
        course_unit_realisation_id: attainment.course_unit_realisation_id.clone(),
        attainment_date: sisu_midnight(attainment.attainment_date),
        registration_date: sisu_midnight(attainment.registration_date),
        grade_scale_id: attainment.grade_scale_id.clone(),
        grade_id: attainment.grade_id.clone(),
        passed: attainment.passed,
    }
}

fn attainment_summary(attainment: &MockAttainment) -> AttainmentSummary {
    AttainmentSummary {
        id: attainment.id.clone(),
        attainment_type: attainment.attainment_type.clone(),
        state: attainment.state.wire_state().to_string(),
        attainment_date: sisu_midnight(attainment.attainment_date),
        registration_date: sisu_midnight(attainment.registration_date),
        grade_scale_id: attainment.grade_scale_id.clone(),
        grade_id: attainment.grade_id.clone(),
    }
}

fn enrolments_for<'a>(
    working: &'a WorkingSet,
    student_number: &str,
    course_code: &str,
) -> Vec<&'a MockEnrolment> {
    working
        .enrolments_by_person
        .get(student_number)
        .into_iter()
        .flatten()
        .filter_map(|id| working.enrolments.get(id))
        .filter(|enrolment| enrolment.course_code == course_code)
        .collect()
}

fn enrolment_dto(
    course_unit: &MockCourseUnit,
    enrolment: &MockEnrolment,
    realisation: &MockRealisation,
) -> wire::Enrolment {
    wire::Enrolment {
        id: enrolment.id.clone(),
        state: "ENROLLED".to_string(),
        kind: enrolment.kind().to_string(),
        course_unit_id: course_unit.course_unit_id.clone(),
        assessment_item_id: realisation.assessment_item_id.clone(),
        course_unit_realisation_id: realisation.id.clone(),
        course_unit_realisation_name: realisation.name.clone(),
        activity_period: realisation.activity_period.clone(),
        grade_scale_id: course_unit.grade_scale_for(realisation),
        credits: course_unit.credits.clone(),
        study_right_id: enrolment.study_right_id.clone(),
        study_right_validity_period: enrolment
            .study_right
            .as_ref()
            .map(|study_right| study_right.validity.clone()),
        enrolment_date_time: iso_millis(enrolment.enrolment_date_time),
    }
}

#[cfg(test)]
mod tests {
    use super::super::world::{
        CourseBehaviour, CreditRange, DatePeriod, LocalizedName, MockPerson, PersonBehaviour,
        RealisationKind, SuotarCourse,
    };
    use super::*;

    const STUDENT_NUMBER: &str = "900000101";
    const COURSE_CODE: &str = "CRS-101";

    fn world() -> WorkingSet {
        let now = Utc::now();
        let period = DatePeriod {
            start_date: (now - Duration::days(30)).date_naive(),
            end_date: Some((now + Duration::days(30)).date_naive()),
        };
        let name = LocalizedName {
            fi: COURSE_CODE.to_string(),
            sv: COURSE_CODE.to_string(),
            en: COURSE_CODE.to_string(),
        };
        let realisation = MockRealisation {
            id: ids::realisation_id(COURSE_CODE, RealisationKind::Degree),
            name: Some(name.clone()),
            assessment_item_id: ids::assessment_item_id(COURSE_CODE, RealisationKind::Degree),
            kind: RealisationKind::Degree,
            activity_period: Some(period.clone()),
            grade_scale_id: None,
        };
        let enrolment = MockEnrolment {
            id: ids::enrolment_id(STUDENT_NUMBER, RealisationKind::Degree),
            student_number: STUDENT_NUMBER.to_string(),
            course_code: COURSE_CODE.to_string(),
            realisation_id: realisation.id.clone(),
            state: EnrolmentState::Enrolled,
            study_right_id: Some(ids::study_right_id(STUDENT_NUMBER, RealisationKind::Degree)),
            study_right: Some(MockStudyRight {
                validity: period,
                grant_date: None,
            }),
            enrolment_date_time: now,
        };
        WorkingSet {
            persons: [(
                STUDENT_NUMBER.to_string(),
                MockPerson {
                    student_number: STUDENT_NUMBER.to_string(),
                    person_id: ids::person_id(STUDENT_NUMBER),
                    first_names: Some("Zzyzx".to_string()),
                    last_name: Some("Happypath".to_string()),
                    primary_email: Some("zzyzx.happypath@helsinki.example".to_string()),
                    secondary_email: None,
                    behaviour: PersonBehaviour::default(),
                    owner_user_email: None,
                },
            )]
            .into(),
            course_units: [(
                COURSE_CODE.to_string(),
                MockCourseUnit {
                    course_code: COURSE_CODE.to_string(),
                    course_unit_id: ids::course_unit_id(COURSE_CODE),
                    name,
                    credits: Some(CreditRange {
                        min: 5.0,
                        max: Some(5.0),
                    }),
                    grade_scale_id: Some("sis-hyl-hyv".to_string()),
                    realisations: vec![realisation],
                    suotar_course: Some(SuotarCourse {
                        name: COURSE_CODE.to_string(),
                    }),
                    behaviour: CourseBehaviour::default(),
                    owner_course_slug: None,
                },
            )]
            .into(),
            enrolments: [(enrolment.id.clone(), enrolment)].into(),
            ..Default::default()
        }
    }

    /// The write is queued before the response is shaped, which is what makes "timed out, but it
    /// landed" different from "timed out, nothing landed".
    #[test]
    fn an_import_queues_its_submission_before_any_response_shaping() {
        let mut working = world();
        let item = wire::ImportAttainmentRequestItem {
            request_item_id: "item-1".to_string(),
            student_number: STUDENT_NUMBER.to_string(),
            course_code: COURSE_CODE.to_string(),
            enrolment_id: ids::enrolment_id(STUDENT_NUMBER, RealisationKind::Degree),
            attainment_date: Utc::now().date_naive(),
            attainment_language: "en".to_string(),
            grade_scale_id: "sis-hyl-hyv".to_string(),
            grade_id: "1".to_string(),
            credits: 5.0,
        };
        let ImportResolution::Write(submission) = resolve_import_item(&item, &working, Utc::now())
        else {
            panic!("a well-formed import resolves to a write");
        };
        let id = submission.submitted_attainment_id.clone();
        let response = write_and_send(&mut working, *submission);
        assert_eq!(response.code, "sent");
        assert!(working.submissions.contains_key(&id));
        assert!(
            working
                .writes
                .contains(&WorldWrite::UpsertSubmission(id.clone()))
        );
    }
}
