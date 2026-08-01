//! Per-item world-state resolution, as pure functions over the working set.
//!
//! No HTTP and no Redis; every `now` is passed in. Faults are resolved by the caller, ahead of this
//! — per item the whole order is the first matching fault, then what is here.

use headless_lms_models::suotar_api_calls::SuotarEndpoint;

use crate::prelude::*;

use super::ids;
use super::wire::{self, ResponseItem};
use super::world::{
    AttainmentState, DuplicateDetection, EnrolmentState, MockAttainment, MockCourseUnit,
    MockEnrolment, MockRealisation, MockSubmission, Ripeness, SubmissionLifecycle, WorkingSet,
    WorldWrite, person_course_key,
};

pub fn resolve_person_item(item: &wire::ResolvePersonsItem, working: &WorkingSet) -> ResponseItem {
    let endpoint = SuotarEndpoint::ResolvePersons;
    match working.persons.get(&item.student_number) {
        Some(person) => ok(
            &item.request_item_id,
            "personFound",
            &wire::PersonResult {
                // Echoed verbatim rather than re-derived, so a client that mismatches numbers shows.
                student_number: item.student_number.clone(),
                person_id: person.person_id.clone(),
                first_names: person.first_names.clone(),
                last_name: person.last_name.clone(),
            },
        ),
        None => ResponseItem::error(endpoint, &item.request_item_id, "personNotFound"),
    }
}

pub fn resolve_enrolments_item(
    item: &wire::ResolveEnrolmentsItem,
    working: &mut WorkingSet,
    now: DateTime<Utc>,
) -> ResponseItem {
    let endpoint = SuotarEndpoint::ResolveEnrolments;
    let id = &item.request_item_id;
    if !working.persons.contains_key(&item.student_number) {
        return ResponseItem::error(endpoint, id, "personNotFound");
    }
    let Some(course_unit) = working.course_units.get(&item.course_code).cloned() else {
        return ResponseItem::error(endpoint, id, "courseCodeNotFound");
    };
    // Ripening here as well as in verify is what keeps the two from contradicting each other: a real
    // Sisu does not show an attainment on one read and hide it on another.
    ripen_person_course(working, &item.student_number, &item.course_code, now);

    let matching: Vec<MockEnrolment> =
        enrolments_for(working, &item.student_number, &item.course_code);
    if matching.is_empty() {
        return ResponseItem::error(endpoint, id, "enrolmentNotFound");
    }
    if !matching
        .iter()
        .any(|enrolment| enrolment.state == EnrolmentState::Enrolled)
    {
        return ResponseItem::error(endpoint, id, "enrolmentNotAccepted");
    }

    let mut listed: Vec<&MockEnrolment> = matching
        .iter()
        .filter(|enrolment| {
            working.defaults.include_non_enrolled_in_result
                || enrolment.state == EnrolmentState::Enrolled
        })
        .collect();
    listed.sort_by_key(|enrolment| enrolment.enrolment_date_time);

    let enrolments = listed
        .into_iter()
        .filter_map(|enrolment| {
            course_unit
                .realisation(&enrolment.realisation_id)
                .map(|realisation| enrolment_dto(&course_unit, enrolment, realisation))
        })
        .collect();

    ok(
        id,
        "enrolmentFound",
        &wire::EnrolmentsResult {
            enrolments,
            existing_attainments: existing_attainments(
                working,
                &item.student_number,
                &item.course_code,
            ),
        },
    )
}

pub fn import_item(
    item: &wire::ImportItem,
    working: &mut WorkingSet,
    now: DateTime<Utc>,
) -> ResponseItem {
    let endpoint = SuotarEndpoint::ImportAttainments;
    let id = &item.request_item_id;
    let Some(person) = working.persons.get(&item.student_number).cloned() else {
        return ResponseItem::error(endpoint, id, "personNotFound");
    };
    // Import's error list has no `courseCodeNotFound`, so an unknown course code degrades here.
    let Some(course_unit) = working.course_units.get(&item.course_code).cloned() else {
        return ResponseItem::error(endpoint, id, "enrolmentNotFound");
    };
    let enrolment = working
        .enrolments
        .get(&item.enrolment_id)
        .filter(|enrolment| {
            enrolment.student_number == item.student_number
                && enrolment.course_code == item.course_code
                && enrolment.state == EnrolmentState::Enrolled
        })
        .cloned();
    let Some(enrolment) = enrolment else {
        return ResponseItem::error(endpoint, id, "enrolmentNotFound");
    };
    if !course_unit.behaviour.import_allowed {
        return ResponseItem::error(endpoint, id, "courseNotAllowed");
    }
    let Some(realisation) = course_unit.realisation(&enrolment.realisation_id).cloned() else {
        return ResponseItem::error(endpoint, id, "enrolmentNotFound");
    };

    let scale = working.defaults.scale(&realisation.grade_scale_id);
    let grade_matches_scale = working
        .defaults
        .scale(&item.grade_scale_id)
        .zip(scale)
        .is_some_and(|(requested, expected)| requested.id == expected.id);
    let grade = scale.and_then(|scale| scale.grade(&item.grade_id));
    if !grade_matches_scale || grade.is_none() {
        return ResponseItem::error(endpoint, id, "invalidGradeForGradeScale");
    }
    if item.credits < realisation.credits.min || item.credits > realisation.credits.max {
        return ResponseItem::error(endpoint, id, "invalidCredits");
    }
    if !enrolment
        .study_right_validity_period
        .contains(item.attainment_date)
    {
        return ResponseItem::error(endpoint, id, "studyRightNotValid");
    }
    if realisation.acceptor_person_id.is_none() {
        return ResponseItem::error(endpoint, id, "acceptorNotFound");
    }
    if !realisation.activity_period.contains(item.attainment_date) {
        return ResponseItem::error(endpoint, id, "sisuValidationFailed");
    }

    ripen_person_course(working, &item.student_number, &item.course_code, now);

    if working.duplicate_detection_for(&item.student_number) == DuplicateDetection::Detect
        && let Some(outcome) = duplicate_outcome(item, working, &realisation)
    {
        return outcome;
    }

    let attempt = working
        .submissions_by_person_course
        .get(&person_course_key(&item.student_number, &item.course_code))
        .map_or(0, |ids| ids.len()) as u32
        + 1;
    let submitted_attainment_id = ids::submitted_attainment_id(
        &item.student_number,
        &item.course_code,
        &item.enrolment_id,
        item.attainment_date,
        &realisation.grade_scale_id,
        &item.grade_id,
        item.credits,
        attempt,
    );
    let ripeness = working.ripeness_for(&item.student_number);
    let submission = MockSubmission {
        submitted_attainment_id: submitted_attainment_id.clone(),
        submitted_attainment_type: "AssessmentItemAttainment".to_string(),
        student_number: item.student_number.clone(),
        course_code: item.course_code.clone(),
        enrolment_id: item.enrolment_id.clone(),
        realisation_id: realisation.id.clone(),
        person_id: person.person_id.clone(),
        course_unit_id: course_unit.course_unit_id.clone(),
        assessment_item_id: realisation.assessment_item_id.clone(),
        attainment_date: item.attainment_date,
        attainment_language: item.attainment_language.clone(),
        grade_scale_id: realisation.grade_scale_id.clone(),
        grade_id: item.grade_id.clone(),
        credits: item.credits,
        lifecycle: SubmissionLifecycle::Pending { ripeness },
        verify_calls: 0,
        id_disclosed_to_client: false,
        created_at: now,
    };
    record_submission(working, submission);

    if ripen(working, &submitted_attainment_id, now)
        && let Some(SubmissionLifecycle::Registered { attainment_id, .. }) = working
            .submissions
            .get(&submitted_attainment_id)
            .map(|submission| submission.lifecycle.clone())
    {
        return ok(
            id,
            "registered",
            &wire::RegisteredResult {
                attainment: wire::AttainmentRef {
                    id: attainment_id,
                    attainment_type: "CourseUnitAttainment".to_string(),
                },
            },
        );
    }

    ok(
        id,
        "sent",
        &wire::SentResult {
            submitted_attainment_id,
            submitted_attainment_type: "AssessmentItemAttainment".to_string(),
        },
    )
}

pub fn verify_item(
    item: &wire::VerifyItem,
    working: &mut WorkingSet,
    now: DateTime<Utc>,
) -> ResponseItem {
    let endpoint = SuotarEndpoint::VerifyAttainments;
    let id = &item.request_item_id;
    // An unknown id is the "no registration evidence found" case; answering anything else would let
    // a client tell a typo from a not-yet, which real Sisu cannot.
    let Some(submission) = working.submissions.get_mut(&item.submitted_attainment_id) else {
        return ResponseItem::error(endpoint, id, "notRegistered");
    };
    submission.verify_calls += 1;
    working.writes.push(WorldWrite::UpsertSubmission(
        item.submitted_attainment_id.clone(),
    ));

    ripen(working, &item.submitted_attainment_id, now);

    let Some(submission) = working.submissions.get(&item.submitted_attainment_id) else {
        return ResponseItem::error(endpoint, id, "notRegistered");
    };
    match &submission.lifecycle {
        SubmissionLifecycle::Registered { attainment_id, .. } => ok(
            id,
            "registered",
            &wire::RegisteredResult {
                attainment: wire::AttainmentRef {
                    id: attainment_id.clone(),
                    attainment_type: "CourseUnitAttainment".to_string(),
                },
            },
        ),
        SubmissionLifecycle::Misregistered { .. } => {
            ResponseItem::error(endpoint, id, "misregistered")
        }
        _ => ResponseItem::error(endpoint, id, "notRegistered"),
    }
}

pub fn product_access_token_item(
    item: &wire::ProductAccessTokenItem,
    working: &WorkingSet,
) -> ResponseItem {
    let endpoint = SuotarEndpoint::ProductAccessTokens;
    match working.product_tokens.get(&item.open_university_product_id) {
        // A disabled or draft token is still `found`: refusing to build an enrolment link from one
        // is our side's job, not Suotar's.
        Some(token) => ok(
            &item.request_item_id,
            "found",
            &wire::ProductAccessTokenResult {
                id: token.id.clone(),
                access_token: token.access_token.clone(),
                state: serde_plain(&token.state),
                document_state: serde_plain(&token.document_state),
            },
        ),
        None => ResponseItem::error(
            endpoint,
            &item.request_item_id,
            "productAccessTokenNotFound",
        ),
    }
}

pub fn list_by_course_item(item: &wire::ListByCourseItem, working: &WorkingSet) -> ResponseItem {
    let endpoint = SuotarEndpoint::ListByCourse;
    let id = &item.request_item_id;
    let Some(course_unit) = working.course_units.get(&item.course_code) else {
        return ResponseItem::error(endpoint, id, "courseCodeNotFound");
    };
    // There is no `realisationNotFound` code, so a realisation of another course folds into this one.
    let realisation_ids: Vec<String> = match &item.course_unit_realisation_id {
        Some(realisation_id) => {
            if course_unit.realisation(realisation_id).is_none() {
                return ResponseItem::error(endpoint, id, "courseCodeNotFound");
            }
            vec![realisation_id.clone()]
        }
        None => course_unit
            .realisations
            .iter()
            .map(|realisation| realisation.id.clone())
            .collect(),
    };

    let mut people: Vec<wire::ListedPerson> = realisation_ids
        .iter()
        .filter_map(|realisation_id| working.enrolments_by_realisation.get(realisation_id))
        .flatten()
        .filter_map(|enrolment_id| working.enrolments.get(enrolment_id))
        .filter(|enrolment| enrolment.state == EnrolmentState::Enrolled)
        .filter_map(|enrolment| {
            let person = working.persons.get(&enrolment.student_number)?;
            Some(wire::ListedPerson {
                student_number: person.student_number.clone(),
                person_id: person.person_id.clone(),
                first_names: person.first_names.clone(),
                last_name: person.last_name.clone(),
                primary_email: person.primary_email.clone(),
                secondary_email: person.secondary_email.clone(),
                enrolment: wire::ListedEnrolment {
                    id: enrolment.id.clone(),
                    course_unit_realisation_id: enrolment.realisation_id.clone(),
                    state: "ENROLLED".to_string(),
                    enrolment_date_time: enrolment.enrolment_date_time,
                },
            })
        })
        .collect();
    people.sort_by(|a, b| a.student_number.cmp(&b.student_number));

    ok(id, "enrolmentsListed", &wire::PeopleResult { people })
}

/// Moves every submission of this person and course that has become ripe. The transition is
/// persisted wherever it is evaluated, or the next read contradicts this one.
pub fn ripen_person_course(
    working: &mut WorkingSet,
    student_number: &str,
    course_code: &str,
    now: DateTime<Utc>,
) {
    let ids = working
        .submissions_by_person_course
        .get(&person_course_key(student_number, course_code))
        .cloned()
        .unwrap_or_default();
    for id in ids {
        ripen(working, &id, now);
    }
}

/// Returns whether the submission moved to `Registered` in this call.
pub fn ripen(working: &mut WorkingSet, submitted_attainment_id: &str, now: DateTime<Utc>) -> bool {
    let Some(submission) = working.submissions.get(submitted_attainment_id) else {
        return false;
    };
    let ripeness = match &submission.lifecycle {
        SubmissionLifecycle::Pending { ripeness }
        | SubmissionLifecycle::TimedOutButLanded { ripeness } => *ripeness,
        _ => return false,
    };
    let ripe = match ripeness {
        Ripeness::AtImport => true,
        Ripeness::Manual => false,
        Ripeness::AutoAfterVerifyCalls { calls } => submission.verify_calls > calls,
    };
    if !ripe {
        return false;
    }
    register(working, submitted_attainment_id, now);
    true
}

/// Turns a submission into the Sisu attainment it becomes, and indexes it.
pub fn register(working: &mut WorkingSet, submitted_attainment_id: &str, now: DateTime<Utc>) {
    let Some(submission) = working.submissions.get(submitted_attainment_id).cloned() else {
        return;
    };
    let attainment_id = ids::final_attainment_id(submitted_attainment_id);
    let passed = working
        .defaults
        .scale(&submission.grade_scale_id)
        .and_then(|scale| scale.grade(&submission.grade_id))
        .is_some_and(|grade| grade.passed);
    let attainment = MockAttainment {
        id: attainment_id.clone(),
        attainment_type: "CourseUnitAttainment".to_string(),
        state: AttainmentState::Attained,
        person_id: submission.person_id.clone(),
        student_number: submission.student_number.clone(),
        course_code: submission.course_code.clone(),
        course_unit_id: submission.course_unit_id.clone(),
        assessment_item_id: submission.assessment_item_id.clone(),
        course_unit_realisation_id: submission.realisation_id.clone(),
        attainment_date: submission.attainment_date,
        registration_date: now.date_naive(),
        grade_scale_id: submission.grade_scale_id.clone(),
        grade_id: submission.grade_id.clone(),
        passed,
        from_submission: Some(submitted_attainment_id.to_string()),
    };
    let key = person_course_key(&submission.student_number, &submission.course_code);
    working
        .attainments
        .insert(attainment_id.clone(), attainment);
    let index = working.attainments_by_person_course.entry(key).or_default();
    if !index.contains(&attainment_id) {
        index.push(attainment_id.clone());
    }
    if let Some(submission) = working.submissions.get_mut(submitted_attainment_id) {
        submission.lifecycle = SubmissionLifecycle::Registered {
            attainment_id: attainment_id.clone(),
            registered_at: now,
        };
    }
    working.writes.push(WorldWrite::UpsertSubmission(
        submitted_attainment_id.to_string(),
    ));
    working
        .writes
        .push(WorldWrite::UpsertAttainment(attainment_id.clone()));
    working.writes.push(WorldWrite::IndexAttainment {
        student_number: submission.student_number.clone(),
        course_code: submission.course_code.clone(),
        id: attainment_id,
    });
}

/// Adds a submission to the working set and queues its writes.
pub fn record_submission(working: &mut WorkingSet, submission: MockSubmission) {
    let id = submission.submitted_attainment_id.clone();
    let key = person_course_key(&submission.student_number, &submission.course_code);
    let student_number = submission.student_number.clone();
    let course_code = submission.course_code.clone();
    working.submissions.insert(id.clone(), submission);
    let index = working.submissions_by_person_course.entry(key).or_default();
    if !index.contains(&id) {
        index.push(id.clone());
    }
    working
        .writes
        .push(WorldWrite::UpsertSubmission(id.clone()));
    working.writes.push(WorldWrite::IndexSubmission {
        student_number,
        course_code,
        id,
    });
}

fn duplicate_outcome(
    item: &wire::ImportItem,
    working: &WorkingSet,
    realisation: &MockRealisation,
) -> Option<ResponseItem> {
    let scale = working.defaults.scale(&realisation.grade_scale_id)?;
    let incoming_rank = scale.grade(&item.grade_id)?.rank;
    for attainment in attained(working, &item.student_number, &item.course_code) {
        // Comparison stays within one scale; nothing says how two scales rank against each other.
        if !scale.answers_to(&attainment.grade_scale_id) {
            continue;
        }
        if attainment.grade_id == item.grade_id
            && attainment.attainment_date == item.attainment_date
        {
            return Some(ok(
                &item.request_item_id,
                "duplicateAttainment",
                &wire::DuplicateResult {
                    attainment: attainment_summary(attainment),
                },
            ));
        }
        let existing_rank = scale
            .grade(&attainment.grade_id)
            .map_or(0, |grade| grade.rank);
        if existing_rank >= incoming_rank {
            return Some(ok(
                &item.request_item_id,
                "notImprovedAttainment",
                &wire::NotImprovedResult {
                    previous_attainment: attainment_summary(attainment),
                },
            ));
        }
    }
    None
}

fn attained<'a>(
    working: &'a WorkingSet,
    student_number: &str,
    course_code: &str,
) -> Vec<&'a MockAttainment> {
    let mut found: Vec<&MockAttainment> = working
        .attainments_by_person_course
        .get(&person_course_key(student_number, course_code))
        .into_iter()
        .flatten()
        .filter_map(|id| working.attainments.get(id))
        .filter(|attainment| attainment.state == AttainmentState::Attained)
        .collect();
    found.sort_by(|a, b| {
        a.attainment_date
            .cmp(&b.attainment_date)
            .then_with(|| a.id.cmp(&b.id))
    });
    found
}

fn existing_attainments(
    working: &WorkingSet,
    student_number: &str,
    course_code: &str,
) -> Vec<wire::ExistingAttainmentDto> {
    attained(working, student_number, course_code)
        .into_iter()
        .map(|attainment| wire::ExistingAttainmentDto {
            id: attainment.id.clone(),
            attainment_type: attainment.attainment_type.clone(),
            state: "ATTAINED".to_string(),
            person_id: attainment.person_id.clone(),
            course_unit_id: attainment.course_unit_id.clone(),
            assessment_item_id: attainment.assessment_item_id.clone(),
            course_unit_realisation_id: attainment.course_unit_realisation_id.clone(),
            attainment_date: attainment.attainment_date,
            registration_date: attainment.registration_date,
            grade_scale_id: attainment.grade_scale_id.clone(),
            grade_id: attainment.grade_id.clone(),
            passed: attainment.passed,
        })
        .collect()
}

fn attainment_summary(attainment: &MockAttainment) -> wire::AttainmentSummary {
    wire::AttainmentSummary {
        id: attainment.id.clone(),
        attainment_type: attainment.attainment_type.clone(),
        state: "ATTAINED".to_string(),
        attainment_date: attainment.attainment_date,
        registration_date: attainment.registration_date,
        grade_scale_id: attainment.grade_scale_id.clone(),
        grade_id: attainment.grade_id.clone(),
    }
}

fn enrolments_for(
    working: &WorkingSet,
    student_number: &str,
    course_code: &str,
) -> Vec<MockEnrolment> {
    working
        .enrolments_by_person
        .get(student_number)
        .into_iter()
        .flatten()
        .filter_map(|id| working.enrolments.get(id))
        .filter(|enrolment| enrolment.course_code == course_code)
        .cloned()
        .collect()
}

fn enrolment_dto(
    course_unit: &MockCourseUnit,
    enrolment: &MockEnrolment,
    realisation: &MockRealisation,
) -> wire::EnrolmentDto {
    wire::EnrolmentDto {
        id: enrolment.id.clone(),
        state: serde_plain(&enrolment.state),
        kind: realisation.kind.as_str().to_string(),
        course_unit_id: course_unit.course_unit_id.clone(),
        assessment_item_id: realisation.assessment_item_id.clone(),
        course_unit_realisation_id: realisation.id.clone(),
        course_unit_realisation_name: realisation.name.clone(),
        activity_period: realisation.activity_period.clone(),
        grade_scale_id: realisation.grade_scale_id.clone(),
        credits: realisation.credits.clone(),
        study_right_id: enrolment.study_right_id.clone(),
        study_right_validity_period: enrolment.study_right_validity_period.clone(),
        enrolment_date_time: enrolment.enrolment_date_time,
    }
}

fn ok<T: Serialize>(request_item_id: &str, code: &str, result: &T) -> ResponseItem {
    ResponseItem::ok(
        request_item_id,
        code,
        serde_json::to_value(result).unwrap_or(serde_json::Value::Null),
    )
}

/// Renders a wire-shaped enum through its serde spelling rather than duplicating the strings.
fn serde_plain<T: Serialize>(value: &T) -> String {
    serde_json::to_value(value)
        .ok()
        .and_then(|value| value.as_str().map(str::to_string))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use chrono::Duration;

    use super::super::ids;
    use super::super::world::{
        CreditRange, DatePeriod, LocalizedName, MockCourseUnit, MockPerson, MockRealisation,
        PersonBehaviour, RealisationKind, WorldDefaults,
    };
    use super::*;

    const STUDENT_NUMBER: &str = "900000101";
    const COURSE_CODE: &str = "CRS-101";

    fn world(ripeness: Ripeness) -> WorkingSet {
        let now = Utc::now();
        let period = DatePeriod {
            start_date: (now - Duration::days(30)).date_naive(),
            end_date: (now + Duration::days(30)).date_naive(),
        };
        let realisation = MockRealisation {
            id: ids::realisation_id(COURSE_CODE, RealisationKind::Degree),
            name: LocalizedName {
                fi: COURSE_CODE.to_string(),
                sv: COURSE_CODE.to_string(),
                en: COURSE_CODE.to_string(),
            },
            assessment_item_id: ids::assessment_item_id(COURSE_CODE, RealisationKind::Degree),
            kind: RealisationKind::Degree,
            activity_period: period.clone(),
            grade_scale_id: "sis-hyl-hyv".to_string(),
            credits: CreditRange { min: 5.0, max: 5.0 },
            acceptor_person_id: Some("hy-hlo-acceptor".to_string()),
            open_university_product_id: None,
        };
        let enrolment = MockEnrolment {
            id: ids::enrolment_id(STUDENT_NUMBER, RealisationKind::Degree),
            student_number: STUDENT_NUMBER.to_string(),
            course_code: COURSE_CODE.to_string(),
            realisation_id: realisation.id.clone(),
            state: EnrolmentState::Enrolled,
            study_right_id: ids::study_right_id(STUDENT_NUMBER, RealisationKind::Degree),
            study_right_validity_period: period.clone(),
            enrolment_date_time: now,
        };
        WorkingSet {
            defaults: WorldDefaults::default(),
            persons: [(
                STUDENT_NUMBER.to_string(),
                MockPerson {
                    student_number: STUDENT_NUMBER.to_string(),
                    person_id: ids::person_id(STUDENT_NUMBER),
                    first_names: "Zzyzx".to_string(),
                    last_name: "Happypath".to_string(),
                    primary_email: "zzyzx.happypath@helsinki.example".to_string(),
                    secondary_email: None,
                    behaviour: PersonBehaviour {
                        ripeness: Some(ripeness),
                        duplicate_detection: None,
                    },
                    owner_user_email: None,
                },
            )]
            .into(),
            course_units: [(
                COURSE_CODE.to_string(),
                MockCourseUnit {
                    course_code: COURSE_CODE.to_string(),
                    course_unit_id: ids::course_unit_id(COURSE_CODE),
                    name: LocalizedName {
                        fi: COURSE_CODE.to_string(),
                        sv: COURSE_CODE.to_string(),
                        en: COURSE_CODE.to_string(),
                    },
                    realisations: vec![realisation],
                    behaviour: Default::default(),
                    owner_course_slug: None,
                },
            )]
            .into(),
            enrolments: [(enrolment.id.clone(), enrolment)].into(),
            ..Default::default()
        }
    }

    fn import(working: &mut WorkingSet) -> ResponseItem {
        let item = wire::ImportItem {
            request_item_id: "cr-1".to_string(),
            student_number: STUDENT_NUMBER.to_string(),
            course_code: COURSE_CODE.to_string(),
            enrolment_id: ids::enrolment_id(STUDENT_NUMBER, RealisationKind::Degree),
            attainment_date: Utc::now().date_naive(),
            attainment_language: "en".to_string(),
            grade_scale_id: "sis-hyl-hyv".to_string(),
            grade_id: "1".to_string(),
            credits: 5.0,
        };
        import_item(&item, working, Utc::now())
    }

    fn verify(working: &mut WorkingSet, submitted_attainment_id: &str) -> ResponseItem {
        let item = wire::VerifyItem {
            request_item_id: "vf-1".to_string(),
            submitted_attainment_id: submitted_attainment_id.to_string(),
        };
        verify_item(&item, working, Utc::now())
    }

    fn submitted_id(item: &ResponseItem) -> String {
        item.result
            .as_ref()
            .and_then(|result| result.get("submittedAttainmentId"))
            .and_then(|value| value.as_str())
            .expect("a sent import answers with the submitted attainment id")
            .to_string()
    }

    /// Both post-commit stages fire on top of a world that already holds the submission. The write
    /// is queued by the time the response exists, which is what makes "timed out, but it landed"
    /// different from "timed out, nothing landed".
    #[test]
    fn an_import_queues_its_submission_before_any_response_shaping() {
        let mut working = world(Ripeness::Manual);
        let response = import(&mut working);
        assert_eq!(response.code, "sent");
        let id = submitted_id(&response);
        assert!(working.submissions.contains_key(&id));
        assert!(
            working
                .writes
                .contains(&WorldWrite::UpsertSubmission(id.clone()))
        );
        assert!(working.writes.iter().any(|write| matches!(
            write,
            WorldWrite::IndexSubmission { id: indexed, .. } if indexed == &id
        )));
    }

    /// The verify count is taken before ripeness is evaluated, so `calls: 1` answers the first poll
    /// with `notRegistered` and the second with `registered`.
    #[test]
    fn auto_ripening_counts_the_call_it_is_answering() {
        let mut working = world(Ripeness::AutoAfterVerifyCalls { calls: 1 });
        let id = submitted_id(&import(&mut working));
        assert_eq!(verify(&mut working, &id).code, "notRegistered");
        let second = verify(&mut working, &id);
        assert_eq!(second.code, "registered");
        let third = verify(&mut working, &id);
        assert_eq!(second.result, third.result);
    }

    /// Nothing moves without an explicit transition, whatever a concurrent spec's verify sweep does.
    #[test]
    fn a_manual_submission_never_ripens_on_its_own() {
        let mut working = world(Ripeness::Manual);
        let id = submitted_id(&import(&mut working));
        for _ in 0..5 {
            assert_eq!(verify(&mut working, &id).code, "notRegistered");
        }
        register(&mut working, &id, Utc::now());
        assert_eq!(verify(&mut working, &id).code, "registered");
    }

    #[test]
    fn an_at_import_submission_is_registered_by_the_import_that_created_it() {
        let mut working = world(Ripeness::AtImport);
        let response = import(&mut working);
        assert_eq!(response.code, "registered");
    }
}
