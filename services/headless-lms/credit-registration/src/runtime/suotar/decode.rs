//! Suotar's answers and failures read into the registry's terms.

use headless_lms_models::credit_registrations::{
    CreditRegistrationErrorCode, CreditRegistrationState,
};
use headless_lms_models::library::credit_registration::classification::{
    DUPLICATE_REQUEST_ITEM_CODE, PERSON_NOT_FOUND_CODE, WireOutcome, map_code, outcome_of,
};
use headless_lms_models::library::credit_registration::config_validation::CourseCodeVerdict;
use headless_lms_models::library::credit_registration::outcomes::import_success_state;
use headless_lms_models::library::credit_registration::study_registry::{
    ATTAINMENT_TYPE_COURSE_UNIT, CreditRange, DatePeriod, ItemStatus, LocalizedName,
    RegistryAttainment, RegistryEnrolment, RegistryErrorKind, RosterEnrolment, RosterPerson,
};
use headless_lms_utils::services::suotar::{
    self as wire, EnrolmentResolutionResult, EnrolmentsListedResult, ImportAttainmentResult,
    PersonResult, SuotarBatchResponse, SuotarEndpoint, SuotarError, SuotarErrorVariant,
    SuotarItemStatus, SuotarResponseItem, ValidateCourseCodeResult, VerifyAttainmentResult,
};

use crate::registry::{
    AttainmentId, CourseCode, EnrolmentAnswer, EnrolmentReading, FoundPerson, ImportAnswer,
    PersonAnswer, PersonLookupAnswer, PersonReading, RegistryError, SubmittedAttainmentRef,
    VerificationAnswer, VerificationReading,
};

/// Converts a `wire::ExistingAttainment` or `wire::SuotarAttainment`, which share fields but no type.
macro_rules! registry_attainment {
    ($attainment:expr) => {{
        let attainment = $attainment;
        RegistryAttainment {
            id: attainment.id.clone(),
            attainment_type: attainment.attainment_type.clone(),
            state: attainment.state.clone(),
            attainment_date: attainment.attainment_date,
            registration_date: attainment.registration_date,
            grade_scale_id: attainment.grade_scale_id.clone(),
            grade_id: attainment.grade_id.clone(),
        }
    }};
}

pub(super) fn item_status(status: SuotarItemStatus) -> ItemStatus {
    match status {
        SuotarItemStatus::Ok => ItemStatus::Ok,
        SuotarItemStatus::Error => ItemStatus::Error,
    }
}

/// Keeps [`SuotarError::message`], not its `Display`, which prefixes the variant.
pub(super) fn registry_error(error: &SuotarError) -> RegistryError {
    let kind = match error.variant {
        SuotarErrorVariant::Unauthorized => RegistryErrorKind::AuthenticationFailure,
        SuotarErrorVariant::MalformedRequest => RegistryErrorKind::MalformedRequest,
        SuotarErrorVariant::RequestLevelError => RegistryErrorKind::RejectedRequest,
        SuotarErrorVariant::ServiceTemporarilyUnavailable => {
            RegistryErrorKind::TemporarilyUnavailable
        }
        SuotarErrorVariant::ServerError => RegistryErrorKind::ServerError,
        SuotarErrorVariant::TransportNotDelivered => RegistryErrorKind::NotDelivered,
        SuotarErrorVariant::TransportUnknown => RegistryErrorKind::NoAnswer,
        SuotarErrorVariant::Deserialization => RegistryErrorKind::ProtocolViolation,
    };
    RegistryError::new(kind, error.message())
}

fn error_message<R>(item: &SuotarResponseItem<R>) -> Option<String> {
    item.error.as_ref().map(|error| error.message.clone())
}

fn found_person(person: &PersonResult) -> FoundPerson {
    FoundPerson {
        person_id: person.person_id.clone(),
        first_names: person.first_names.clone(),
        last_name: person.last_name.clone(),
    }
}

pub(super) fn person_answer(item: &SuotarResponseItem<PersonResult>) -> PersonAnswer {
    let found = item
        .result
        .as_ref()
        .filter(|_| item.status == SuotarItemStatus::Ok);
    let reading = match found {
        Some(person) => PersonReading::Found(found_person(person)),
        None => PersonReading::Refused {
            code: if item.status == SuotarItemStatus::Ok {
                CreditRegistrationErrorCode::UnexpectedResponse
            } else {
                map_code(SuotarEndpoint::ResolvePersons, &item.code)
                    .unwrap_or(CreditRegistrationErrorCode::Unknown)
            },
        },
    };
    PersonAnswer {
        reading,
        error_message: error_message(item),
    }
}

/// `personNotFound` is read before the status, whatever the status says.
pub(super) fn person_lookup_answer(item: &SuotarResponseItem<PersonResult>) -> PersonLookupAnswer {
    if item.code == PERSON_NOT_FOUND_CODE {
        return PersonLookupAnswer::NotFound;
    }
    match item
        .result
        .as_ref()
        .filter(|_| item.status == SuotarItemStatus::Ok)
    {
        Some(person) => PersonLookupAnswer::Found {
            person: found_person(person),
            registry_code: item.code.clone(),
        },
        None => PersonLookupAnswer::Unexpected {
            registry_code: item.code.clone(),
        },
    }
}

pub(super) fn enrolment_answer(
    item: &SuotarResponseItem<EnrolmentResolutionResult>,
) -> EnrolmentAnswer {
    let reading = if item.status == SuotarItemStatus::Error {
        EnrolmentReading::Refused {
            code: map_code(SuotarEndpoint::ResolveEnrolments, &item.code)
                .unwrap_or(CreditRegistrationErrorCode::Unknown),
            error_message: error_message(item),
        }
    } else {
        EnrolmentReading::Listed
    };
    let result = item.result.as_ref();
    EnrolmentAnswer {
        reading,
        enrolments: result
            .map(|result| result.enrolments.iter().map(enrolment).collect())
            .unwrap_or_default(),
        existing_attainments: result
            .map(|result| {
                result
                    .existing_attainments
                    .iter()
                    .map(|existing| registry_attainment!(existing))
                    .collect()
            })
            .unwrap_or_default(),
    }
}

pub(super) fn import_answer(item: &SuotarResponseItem<ImportAttainmentResult>) -> ImportAnswer {
    let result = item.result.as_ref();
    let submission = result.and_then(|result| {
        result
            .submitted_attainment_id
            .as_ref()
            .map(|id| SubmittedAttainmentRef {
                id: AttainmentId::new(id.clone()),
                attainment_type: result.submitted_attainment_type.clone(),
            })
    });
    match import_success_state(&item.code) {
        Some(CreditRegistrationState::AwaitingVerification) => ImportAnswer::Submitted {
            submission,
            is_repeat_in_batch: item.code == DUPLICATE_REQUEST_ITEM_CODE,
        },
        Some(state) => ImportAnswer::Settled {
            state,
            attainment: result
                .and_then(|result| {
                    result
                        .attainment
                        .as_ref()
                        .or(result.previous_attainment.as_ref())
                })
                .map(|attainment| registry_attainment!(attainment)),
        },
        None if item.status == SuotarItemStatus::Error => ImportAnswer::Refused {
            code: map_code(SuotarEndpoint::ImportAttainments, &item.code)
                .unwrap_or(CreditRegistrationErrorCode::Unknown),
            submission,
            error_message: error_message(item),
        },
        None => ImportAnswer::UnknownSuccessCode,
    }
}

pub(super) fn verification_answer(
    item: &SuotarResponseItem<VerifyAttainmentResult>,
) -> VerificationAnswer {
    let result = item.result.as_ref();
    let reading = match outcome_of(SuotarEndpoint::VerifyAttainments, &item.code) {
        WireOutcome::Settled(CreditRegistrationState::Registered)
            if item.status == SuotarItemStatus::Ok =>
        {
            match result.and_then(|result| result.attainment.as_ref()) {
                Some(registered) if registered.attainment_type == ATTAINMENT_TYPE_COURSE_UNIT => {
                    VerificationReading::Registered {
                        attainment: registry_attainment!(registered),
                    }
                }
                // The assessment item attainment's id can equal the submitted one, and verify
                // records only the final course unit attainment.
                _ => VerificationReading::PartiallyRegistered,
            }
        }
        WireOutcome::Unsettled => VerificationReading::Pending {
            resubmit_not_before: result.and_then(|result| result.retry_after),
        },
        WireOutcome::Failure(CreditRegistrationErrorCode::NotRegistered) => {
            VerificationReading::NotRegistered
        }
        WireOutcome::Failure(code) => VerificationReading::Failed { code },
        WireOutcome::Settled(_) => VerificationReading::Inconclusive,
    };
    VerificationAnswer {
        reading,
        error_message: error_message(item),
    }
}

/// `None` for any answer that is neither verdict.
pub(super) fn course_code_verdict(
    item: &SuotarResponseItem<ValidateCourseCodeResult>,
) -> Option<CourseCodeVerdict> {
    match outcome_of(SuotarEndpoint::ValidateCourseCodes, &item.code) {
        WireOutcome::Unsettled if item.status == SuotarItemStatus::Ok => {
            Some(CourseCodeVerdict::Allowed)
        }
        WireOutcome::Failure(CreditRegistrationErrorCode::CourseNotAllowed) => {
            Some(CourseCodeVerdict::NotAllowed {
                reason: error_message(item).unwrap_or_default(),
            })
        }
        _ => None,
    }
}

/// The people one code's answer lists, or why there is no roster for it.
pub(super) fn roster(
    response: &SuotarBatchResponse<EnrolmentsListedResult>,
    request_item_id: &str,
    course_code: &CourseCode,
) -> Result<Vec<RosterPerson>, CreditRegistrationErrorCode> {
    match response.item(request_item_id) {
        Some(item) if item.status == SuotarItemStatus::Ok => Ok(item
            .result
            .as_ref()
            .map(|result| result.people.iter().map(roster_person).collect())
            .unwrap_or_default()),
        Some(item) => {
            warn!(
                course_code = %course_code.as_str(),
                code = %item.code,
                "Listing course code failed"
            );
            Err(map_code(SuotarEndpoint::ListByCourse, &item.code)
                .unwrap_or(CreditRegistrationErrorCode::Unknown))
        }
        None => {
            warn!(
                course_code = %course_code.as_str(),
                "The study registry did not answer for a course code"
            );
            Err(CreditRegistrationErrorCode::UnexpectedResponse)
        }
    }
}

pub(super) fn roster_person(person: &wire::ListedPerson) -> RosterPerson {
    RosterPerson {
        student_number: person.student_number.clone(),
        person_id: person.person_id.clone(),
        first_names: person.first_names.clone(),
        last_name: person.last_name.clone(),
        primary_email: person.primary_email.clone(),
        secondary_email: person.secondary_email.clone(),
        enrolment: person.enrolment.as_ref().map(|enrolment| RosterEnrolment {
            id: enrolment.id.clone(),
            course_unit_realisation_id: enrolment.course_unit_realisation_id.clone(),
            state: enrolment.state.clone(),
            enrolment_date_time: enrolment.enrolment_date_time,
        }),
    }
}

fn enrolment(enrolment: &wire::SuotarEnrolment) -> RegistryEnrolment {
    RegistryEnrolment {
        id: enrolment.id.clone(),
        state: enrolment.state.clone(),
        kind: enrolment.kind.clone(),
        course_unit_realisation_id: enrolment.course_unit_realisation_id.clone(),
        course_unit_realisation_name: enrolment.course_unit_realisation_name.as_ref().map(|name| {
            LocalizedName {
                fi: name.fi.clone(),
                sv: name.sv.clone(),
                en: name.en.clone(),
            }
        }),
        activity_period: enrolment.activity_period.as_ref().map(date_period),
        grade_scale_id: enrolment.grade_scale_id.clone(),
        credits: enrolment.credits.as_ref().map(|range| CreditRange {
            min: range.min,
            max: range.max,
        }),
        study_right_validity_period: enrolment
            .study_right_validity_period
            .as_ref()
            .map(date_period),
        enrolment_date_time: enrolment.enrolment_date_time,
    }
}

fn date_period(period: &wire::DatePeriod) -> DatePeriod {
    DatePeriod {
        start_date: period.start_date,
        end_date: period.end_date,
    }
}
