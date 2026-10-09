//! Where a registration stands on the admin timeline. Derived from the ledger state and the
//! preconditions rather than stored, so a new ledger state has to be placed on the timeline before
//! it compiles, and every admin surface (lists, counts, the registration page) places it alike.

use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationState;
use crate::prelude::*;

use super::pending_reason::{CreditRegistrationPendingReason, PendingPreconditions};

/// A column of the admin timeline. Starting registration is not one: it is [`Engagement`] on the
/// steps that wait on the student. Declared, and so ordered, in timeline order.
#[derive(
    Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Clone, Copy, Hash, ToSchema,
)]
#[serde(rename_all = "snake_case")]
pub enum TimelinePhase {
    Course,
    StudentNumber,
    Registering,
    Confirmation,
    /// Endings that are not a registration of ours: already in Sisu, better grade there, cancelled,
    /// no longer registrable.
    Ended,
}

impl TimelinePhase {
    /// The phase a row enters with `state`, or `None` for `pending`, whose phase depends on which
    /// precondition it waits on. What `phase_started_at` is stamped by.
    pub fn entered_with(state: CreditRegistrationState) -> Option<Self> {
        (state != CreditRegistrationState::Pending)
            .then(|| TimelineStep::of(state, PendingPreconditions::ALL_MET, false).phase())
    }
}

/// One step of the admin timeline. The Registrations list, the overview counts and the status card
/// all name a row by this. Declared, and so ordered, in timeline order.
#[derive(
    Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Clone, Copy, Hash, Type, ToSchema,
)]
#[sqlx(
    type_name = "credit_registration_timeline_step",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum TimelineStep {
    /// A prerequisite module, or a suspected-cheating review.
    CourseNotRegistrableYet,
    WaitingForStudentNumber,
    /// Sisu does not accept the module's course code yet. Not [`Self::LookingForEnrolment`]: this
    /// waits on staff, with no known end.
    HeldForCourseCode,
    LookingForEnrolment,
    WaitingForEnrolment,
    Sending,
    /// `submission_uncertain`: whether Sisu received it is unknown, and only a person may resend.
    AnswerUnclear,
    WaitingForAssessmentItem,
    WaitingForCourseUnit,
    Registered,
    AlreadyInSisu,
    BetterGradeInSisu,
    RecordedWrongly,
    /// `failed_permanent`, counted at the Registering step it stopped at.
    NeedsAPerson,
    NotRegistering,
    NoLongerRegistrable,
}

impl TimelineStep {
    /// Every step, in timeline order.
    pub const ALL: [Self; 16] = [
        Self::CourseNotRegistrableYet,
        Self::WaitingForStudentNumber,
        Self::HeldForCourseCode,
        Self::LookingForEnrolment,
        Self::WaitingForEnrolment,
        Self::Sending,
        Self::AnswerUnclear,
        Self::WaitingForAssessmentItem,
        Self::WaitingForCourseUnit,
        Self::Registered,
        Self::AlreadyInSisu,
        Self::BetterGradeInSisu,
        Self::RecordedWrongly,
        Self::NeedsAPerson,
        Self::NotRegistering,
        Self::NoLongerRegistrable,
    ];

    /// The steps that wait on the student, and so the only ones [`Engagement`] is reported for.
    pub const ENGAGEMENT_STEPS: [Self; 2] =
        [Self::WaitingForStudentNumber, Self::WaitingForEnrolment];

    /// `preconditions` is only read for `pending`; pass [`PendingPreconditions::ALL_MET`] only where
    /// the row is known not to be pending. `enrolment_resolved` is whether the row has settled on
    /// an enrolment, which only `failed_retryable` reads.
    ///
    /// Same inputs as
    /// [`StudentFacingCreditRegistrationStatus::of`](super::StudentFacingCreditRegistrationStatus::of),
    /// finer grained: that one is what the student is told.
    pub fn of(
        state: CreditRegistrationState,
        preconditions: PendingPreconditions,
        enrolment_resolved: bool,
    ) -> Self {
        use CreditRegistrationPendingReason as Reason;
        use CreditRegistrationState as State;
        match state {
            State::Pending => match preconditions.reason() {
                Some(Reason::Completion) => Self::CourseNotRegistrableYet,
                Some(Reason::StudentNumber) => Self::WaitingForStudentNumber,
                Some(Reason::CourseCode) => Self::HeldForCourseCode,
                // Nothing is outstanding, so the next precondition tick moves the row on.
                None => Self::LookingForEnrolment,
            },
            State::ReadyToSubmit | State::ResolvingEnrolment => Self::LookingForEnrolment,
            State::FailedRetryable if !enrolment_resolved => Self::LookingForEnrolment,
            State::NoUsableEnrolment => Self::WaitingForEnrolment,
            State::CheckingEnrolment | State::Submitting | State::FailedRetryable => Self::Sending,
            State::SubmissionUncertain => Self::AnswerUnclear,
            State::AwaitingVerification => Self::WaitingForAssessmentItem,
            State::PartiallyRegistered => Self::WaitingForCourseUnit,
            State::Registered => Self::Registered,
            State::Duplicate => Self::AlreadyInSisu,
            State::NotImproved => Self::BetterGradeInSisu,
            State::Misregistered => Self::RecordedWrongly,
            State::FailedPermanent => Self::NeedsAPerson,
            State::Cancelled => Self::NotRegistering,
            State::Blocked => Self::NoLongerRegistrable,
        }
    }

    /// The timeline column the step is counted under.
    pub fn phase(self) -> TimelinePhase {
        match self {
            Self::CourseNotRegistrableYet => TimelinePhase::Course,
            Self::WaitingForStudentNumber => TimelinePhase::StudentNumber,
            Self::HeldForCourseCode
            | Self::LookingForEnrolment
            | Self::WaitingForEnrolment
            | Self::Sending
            | Self::AnswerUnclear
            | Self::NeedsAPerson => TimelinePhase::Registering,
            Self::WaitingForAssessmentItem
            | Self::WaitingForCourseUnit
            | Self::Registered
            | Self::RecordedWrongly => TimelinePhase::Confirmation,
            Self::AlreadyInSisu
            | Self::BetterGradeInSisu
            | Self::NotRegistering
            | Self::NoLongerRegistrable => TimelinePhase::Ended,
        }
    }

    /// Whether the step waits on the student, and so reports an [`Engagement`].
    pub fn has_engagement(self) -> bool {
        Self::ENGAGEMENT_STEPS.contains(&self)
    }
}

/// A row's step, with its student's [`Engagement`] where the step waits on the student.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TimelinePosition {
    pub step: TimelineStep,
    pub engagement: Option<Engagement>,
}

impl TimelinePosition {
    /// See [`TimelineStep::of`] for the first three arguments.
    pub fn of(
        state: CreditRegistrationState,
        preconditions: PendingPreconditions,
        enrolment_resolved: bool,
        engagement: Engagement,
    ) -> Self {
        let step = TimelineStep::of(state, preconditions, enrolment_resolved);
        Self {
            step,
            engagement: step.has_engagement().then_some(engagement),
        }
    }
}

/// The `(state, completion_eligible, has_verified_student_number, course_code_allowed,
/// enrolment_resolved)` combinations a set of steps covers, each with its step, as parallel arrays
/// for a query to `UNNEST` and join against, as a filter or via [`Self::all`].
///
/// Enumerated from [`TimelineStep::of`] rather than restated as a SQL predicate, so a list filtered
/// by a step returns exactly the rows that show that step.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct StepMatch {
    pub states: Vec<CreditRegistrationState>,
    pub completion_eligible: Vec<bool>,
    pub has_verified_student_number: Vec<bool>,
    pub course_code_allowed: Vec<bool>,
    pub enrolment_resolved: Vec<bool>,
    pub steps: Vec<TimelineStep>,
}

impl StepMatch {
    /// Empty for an empty `steps`, which every query reads as "do not narrow".
    pub fn of(steps: &[TimelineStep]) -> Self {
        let mut matched = Self::default();
        let flags = [false, true];
        for (
            state,
            completion_eligible,
            has_verified_student_number,
            course_code_allowed,
            enrolment_resolved,
        ) in itertools::iproduct!(CreditRegistrationState::ALL, flags, flags, flags, flags)
        {
            let preconditions = PendingPreconditions {
                completion_eligible,
                has_verified_student_number,
                course_code_allowed,
            };
            let step = TimelineStep::of(state, preconditions, enrolment_resolved);
            if steps.contains(&step) {
                matched.states.push(state);
                matched.completion_eligible.push(completion_eligible);
                matched
                    .has_verified_student_number
                    .push(has_verified_student_number);
                matched.course_code_allowed.push(course_code_allowed);
                matched.enrolment_resolved.push(enrolment_resolved);
                matched.steps.push(step);
            }
        }
        matched
    }

    /// Every combination, for reading the step of any row.
    pub fn all() -> Self {
        Self::of(&TimelineStep::ALL)
    }
}

/// What a student waiting on their own step has done on the registration page. Per completion, so
/// every attempt of one completion shares it. Ordered from most to least engaged.
#[derive(
    Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Clone, Copy, Hash, Type, ToSchema,
)]
#[sqlx(
    type_name = "credit_registration_engagement",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum Engagement {
    /// Their latest "I have enrolled" press stands. Only the student's own press: a teacher's or an
    /// admin's check request is not this.
    Pressed,
    Visited,
    NotStarted,
}

impl Engagement {
    /// The engagement shown by the student's latest "I have enrolled" press and latest visit to the
    /// registration page.
    pub fn of(pressed_at: Option<DateTime<Utc>>, last_visited_at: Option<DateTime<Utc>>) -> Self {
        if pressed_at.is_some() {
            Self::Pressed
        } else if last_visited_at.is_some() {
            Self::Visited
        } else {
            Self::NotStarted
        }
    }
}

/// Who a registration waits on. The first line of the status card and of a Needs attention row.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum WaitsOn {
    Student,
    Sisu,
    Support,
    CourseSetup,
    /// Finished, or nothing anyone needs to do.
    Nobody,
}

impl WaitsOn {
    /// `needs_attention` is whether the row is on the Needs attention queue (dismissed rows are
    /// not); `needs_course_setup` whether what stopped it is the module's configuration, which
    /// takes precedence over support.
    pub fn of(
        step: TimelineStep,
        engagement: Option<Engagement>,
        needs_attention: bool,
        needs_course_setup: bool,
    ) -> Self {
        if needs_course_setup {
            return Self::CourseSetup;
        }
        if needs_attention {
            return Self::Support;
        }
        match step {
            TimelineStep::CourseNotRegistrableYet | TimelineStep::WaitingForEnrolment => {
                Self::Student
            }
            TimelineStep::WaitingForStudentNumber => match engagement {
                // The press made the code's enrolment list due, and the linking email follows it.
                Some(Engagement::Pressed) => Self::Sisu,
                Some(Engagement::Visited | Engagement::NotStarted) | None => Self::Student,
            },
            TimelineStep::HeldForCourseCode => Self::CourseSetup,
            TimelineStep::LookingForEnrolment
            | TimelineStep::Sending
            | TimelineStep::WaitingForAssessmentItem
            | TimelineStep::WaitingForCourseUnit => Self::Sisu,
            TimelineStep::AnswerUnclear
            | TimelineStep::RecordedWrongly
            | TimelineStep::NeedsAPerson => Self::Support,
            TimelineStep::Registered
            | TimelineStep::AlreadyInSisu
            | TimelineStep::BetterGradeInSisu
            | TimelineStep::NotRegistering
            | TimelineStep::NoLongerRegistrable => Self::Nobody,
        }
    }
}
