use headless_lms_authorization::Action;
use std::collections::HashMap;
use std::str::FromStr;

use indexmap::IndexMap;

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{
    certificate_configurations, course_module_completion_registered_to_study_registries,
    course_module_completions::{self, CourseModuleCompletion},
    course_modules, exercise_reset_logs, exercise_slide_submissions,
    exercises::{self, Exercise},
    generated_certificates,
    library::progressing::{self, UserModuleCompletionStatus},
    peer_review_queue_entries, study_registry_registrars,
    teacher_grading_decisions::{self, TeacherDecisionType},
    user_details, user_exercise_states,
    user_exercise_states::{ReviewingStage, UserCourseProgress},
};
use headless_lms_utils::json_schema_types::{
    JSONType, JsonItem, Schema, SchemaPropertyType, string_array_property,
};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties,
        argument_parsing::deserialize_to_optional_uuid_and_errors_to_none,
        tool_authorization::ToolRequirement,
    },
    prelude::*,
    user_context::ChatbotTurnContext,
};

pub type UserCourseStateTool = ToolProperties<UserCourseStateState>;

pub struct UserCourseStateState {
    output: UserCourseStateOutput,
    base_url: String,
    user_id: Uuid,
    course_id: Uuid,
}

#[derive(Serialize)]
struct UserCourseStateOutput {
    user_email: String,
    course_name: String,
    #[serde(flatten)]
    facets: IndexMap<String, UserCourseStateFacetValue>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum UserCourseStateFacetValue {
    Progress(Vec<UserCourseProgress>),
    Completions(CompletionsFacet),
    Submissions(SubmissionsFacet),
    Reviews(ReviewsFacet),
    Resets(ResetsFacet),
    Certificates(CertificatesFacet),
    CreditRegistration(CreditRegistrationFacet),
}

/// The facets `user_course_state` can be asked for. Internal to this tool: the wire form is the
/// `facets` string array in the schema, never this enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum UserCourseStateFacet {
    Progress,
    Completions,
    Submissions,
    Reviews,
    Resets,
    Certificates,
    CreditRegistration,
}

impl UserCourseStateFacet {
    const ALL_WIRE_NAMES: &'static [&'static str] = &[
        "progress",
        "completions",
        "submissions",
        "reviews",
        "resets",
        "certificates",
        "credit_registration",
    ];

    fn from_wire(s: &str) -> Option<Self> {
        match s {
            "progress" => Some(Self::Progress),
            "completions" => Some(Self::Completions),
            "submissions" => Some(Self::Submissions),
            "reviews" => Some(Self::Reviews),
            "resets" => Some(Self::Resets),
            "certificates" => Some(Self::Certificates),
            "credit_registration" => Some(Self::CreditRegistration),
            _ => None,
        }
    }

    fn wire_name(self) -> &'static str {
        match self {
            Self::Progress => "progress",
            Self::Completions => "completions",
            Self::Submissions => "submissions",
            Self::Reviews => "reviews",
            Self::Resets => "resets",
            Self::Certificates => "certificates",
            Self::CreditRegistration => "credit_registration",
        }
    }
}

fn parse_facets(raw: &[String]) -> ChatbotResult<Vec<UserCourseStateFacet>> {
    if raw.is_empty() {
        return Err(chatbot_err!(
            InvalidToolArguments,
            "facets must not be empty. Valid facets: progress, completions, submissions, reviews, resets, certificates, credit_registration.".to_string()
        ));
    }
    let mut seen = std::collections::HashSet::new();
    let mut facets = Vec::new();
    for wire in raw {
        let facet = UserCourseStateFacet::from_wire(wire).ok_or_else(|| {
            chatbot_err!(
                InvalidToolArguments,
                format!(
                    "Unknown facet '{wire}'. Valid facets: {}.",
                    UserCourseStateFacet::ALL_WIRE_NAMES.join(", ")
                )
            )
        })?;
        if seen.insert(facet) {
            facets.push(facet);
        }
    }
    Ok(facets)
}

#[derive(Deserialize)]
struct RawArguments {
    user_id: String,
    course_id: String,
    facets: Vec<String>,
    #[serde(deserialize_with = "deserialize_to_optional_uuid_and_errors_to_none")]
    exercise_id: Option<Uuid>,
}

pub struct UserCourseStateArguments {
    user_id: Uuid,
    course_id: Uuid,
    exercise_id: Option<Uuid>,
    facets: Vec<UserCourseStateFacet>,
}

/// Manual, not derived: ids and facets need validation `#[derive(Deserialize)]` can't express,
/// and this is what [ChatbotTool::Arguments]'s `DeserializeOwned` bound is satisfied by
/// (`parse_arguments` below is overridden and never calls it, but the bound still has to hold).
impl<'de> Deserialize<'de> for UserCourseStateArguments {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let raw = RawArguments::deserialize(deserializer)?;
        build_arguments(raw).map_err(serde::de::Error::custom)
    }
}

fn build_arguments(raw: RawArguments) -> ChatbotResult<UserCourseStateArguments> {
    let user_id = Uuid::from_str(&raw.user_id).map_err(|e| {
        chatbot_err!(
            InvalidToolArguments,
            format!("'{}' is not a valid user_id.", raw.user_id),
            e
        )
    })?;
    let course_id = Uuid::from_str(&raw.course_id).map_err(|e| {
        chatbot_err!(
            InvalidToolArguments,
            format!("'{}' is not a valid course_id.", raw.course_id),
            e
        )
    })?;
    let facets = parse_facets(&raw.facets)?;
    Ok(UserCourseStateArguments {
        user_id,
        course_id,
        exercise_id: raw.exercise_id,
        facets,
    })
}

impl ChatbotToolDeclaration for UserCourseStateTool {
    const NAME: &'static str = "user_course_state";

    fn offer_requirements(user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        vec![ToolRequirement::on_turn(
            Action::ViewUserProgressOrDetails,
            user_context,
        )]
    }

    const CATEGORY: ToolCategory = ToolCategory::AdminSupportLearningProgress;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Get a user's state on a course: progress, module completions, submission timeline, peer/self/teacher review status, exercise resets, certificate eligibility, or credit registration status. Pick one or more facets. Resolve user_id with find_user and course_id with find_course first.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "user_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The target user's id (UUID). Resolve it with find_user first.".to_string()),
                        }),
                    ),
                    (
                        "course_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The course's id (UUID). Resolve it with find_course first.".to_string()),
                        }),
                    ),
                    (
                        "facets".to_string(),
                        string_array_property(Some(
                            "Which facets of the user's course state to fetch. One or more of: progress, completions, submissions, reviews, resets, certificates, credit_registration.",
                        )),
                    ),
                    (
                        "exercise_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("Optional. Pass an empty string for the whole course; pass an exercise UUID to narrow the submissions and reviews facets to that exercise.".to_string()),
                        }),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ChatbotTool for UserCourseStateTool {
    type Arguments = UserCourseStateArguments;

    fn call_requirements(
        arguments: &Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement> {
        vec![ToolRequirement::on_course(
            Action::ViewUserProgressOrDetails,
            arguments.course_id,
        )]
    }

    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = serde_json::from_str(&args_string).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {args_string}"),
                e
            )
        })?;
        build_arguments(raw)
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self> {
        let base_url = app_config.base_url.trim_end_matches('/').to_string();
        let course = headless_lms_models::courses::get_course(conn, arguments.course_id)
            .await
            .map_err(|e| {
                chatbot_err!(
                    InvalidToolArguments,
                    format!("No course found with id {}.", arguments.course_id),
                    e
                )
            })?;
        let user_detail = user_details::get_user_details_by_user_id(conn, arguments.user_id)
            .await
            .map_err(|e| {
                chatbot_err!(
                    InvalidToolArguments,
                    format!("No user found with id {}.", arguments.user_id),
                    e
                )
            })?;

        if let Some(exercise_id) = arguments.exercise_id {
            let exercise = exercises::get_by_id(conn, exercise_id).await.map_err(|e| {
                chatbot_err!(
                    InvalidToolArguments,
                    format!("No exercise found with id {exercise_id}."),
                    e
                )
            })?;
            if exercise.course_id != Some(arguments.course_id) {
                return Err(chatbot_err!(
                    InvalidToolArguments,
                    format!(
                        "Exercise {exercise_id} does not belong to course {}.",
                        arguments.course_id
                    )
                ));
            }
        }

        let mut facets = IndexMap::new();

        // Fetched once and shared across facets instead of once per facet, since a single call
        // commonly requests several facets that would otherwise repeat the same query.
        let course_exercises = if arguments.facets.iter().any(|f| {
            matches!(
                f,
                UserCourseStateFacet::Submissions | UserCourseStateFacet::Reviews
            )
        }) {
            Some(exercises::get_exercises_by_course_id(conn, arguments.course_id).await?)
        } else {
            None
        };
        let completions = if arguments.facets.iter().any(|f| {
            matches!(
                f,
                UserCourseStateFacet::Completions
                    | UserCourseStateFacet::Certificates
                    | UserCourseStateFacet::CreditRegistration
            )
        }) {
            Some(
                course_module_completions::get_all_by_course_id_and_user_id(
                    conn,
                    arguments.course_id,
                    arguments.user_id,
                )
                .await?,
            )
        } else {
            None
        };

        for facet in &arguments.facets {
            let value = match facet {
                UserCourseStateFacet::Progress => UserCourseStateFacetValue::Progress(
                    progress_facet(conn, arguments.user_id, arguments.course_id).await?,
                ),
                UserCourseStateFacet::Completions => {
                    let completions = completions.as_ref().ok_or_else(|| {
                        chatbot_err!(
                            ToolUseError,
                            "expected completions to have been prefetched".to_string()
                        )
                    })?;
                    UserCourseStateFacetValue::Completions(
                        completions_facet(
                            conn,
                            arguments.user_id,
                            arguments.course_id,
                            completions,
                        )
                        .await?,
                    )
                }
                UserCourseStateFacet::Submissions => {
                    let course_exercises = course_exercises.as_ref().ok_or_else(|| {
                        chatbot_err!(
                            ToolUseError,
                            "expected course_exercises to have been prefetched".to_string()
                        )
                    })?;
                    UserCourseStateFacetValue::Submissions(
                        submissions_facet(
                            conn,
                            arguments.user_id,
                            arguments.course_id,
                            arguments.exercise_id,
                            course_exercises,
                        )
                        .await?,
                    )
                }
                UserCourseStateFacet::Reviews => {
                    let course_exercises = course_exercises.as_ref().ok_or_else(|| {
                        chatbot_err!(
                            ToolUseError,
                            "expected course_exercises to have been prefetched".to_string()
                        )
                    })?;
                    UserCourseStateFacetValue::Reviews(
                        reviews_facet(
                            conn,
                            arguments.user_id,
                            arguments.course_id,
                            arguments.exercise_id,
                            course_exercises,
                        )
                        .await?,
                    )
                }
                UserCourseStateFacet::Resets => UserCourseStateFacetValue::Resets(
                    resets_facet(conn, arguments.user_id, arguments.course_id).await?,
                ),
                UserCourseStateFacet::Certificates => {
                    let completions = completions.as_ref().ok_or_else(|| {
                        chatbot_err!(
                            ToolUseError,
                            "expected completions to have been prefetched".to_string()
                        )
                    })?;
                    UserCourseStateFacetValue::Certificates(
                        certificates_facet(
                            conn,
                            arguments.user_id,
                            arguments.course_id,
                            completions,
                        )
                        .await?,
                    )
                }
                UserCourseStateFacet::CreditRegistration => {
                    let completions = completions.as_ref().ok_or_else(|| {
                        chatbot_err!(
                            ToolUseError,
                            "expected completions to have been prefetched".to_string()
                        )
                    })?;
                    UserCourseStateFacetValue::CreditRegistration(
                        credit_registration_facet(conn, completions).await?,
                    )
                }
            };
            facets.insert(facet.wire_name().to_string(), value);
        }

        Ok(UserCourseStateTool {
            state: UserCourseStateState {
                output: UserCourseStateOutput {
                    user_email: user_detail.email.clone(),
                    course_name: course.name.clone(),
                    facets,
                },
                base_url,
                user_id: arguments.user_id,
                course_id: arguments.course_id,
            },
        })
    }

    fn output(&self) -> String {
        serde_json::to_string_pretty(&self.state.output).unwrap_or_else(|_| "{}".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        let facets = &self.state.output.facets;
        let mut notes = Vec::new();
        let base_url = &self.state.base_url;

        if facets.contains_key(UserCourseStateFacet::Progress.wire_name())
            || facets.contains_key(UserCourseStateFacet::Completions.wire_name())
            || facets.contains_key(UserCourseStateFacet::Submissions.wire_name())
            || facets.contains_key(UserCourseStateFacet::Reviews.wire_name())
        {
            notes.push(format!(
                "{base_url}/manage/courses/{}/user-status-summary/{} shows progress, module completions, \
                submissions and reviews for this student on one page - check the numbers there before telling \
                the admin anything a student will act on.",
                self.state.course_id, self.state.user_id,
            ));
        }

        if facets.contains_key(UserCourseStateFacet::Progress.wire_name()) {
            notes.push(
                "progress: unlike the other facets this one serializes explicit nulls rather than omitting fields. \
                score_required / attempted_exercises_required are null when the module's completion policy is Manual \
                (staff grants completion), not \"nothing required\". Totals are computed across all chapters, including \
                ones not yet opened, so a score can be measured against material the student cannot see yet. \
                score_given: 0 does not distinguish \"scored zero\" from \"never attempted\"; attempted_exercises only \
                counts submitted/completed activity, so a drafted-but-unsubmitted answer counts as zero. The unnamed \
                default module is reported under the course's own name. Exam exercises have no module and are excluded \
                from every number here.".to_string(),
            );
        }

        if let Some(UserCourseStateFacetValue::Completions(completions)) =
            facets.get(UserCourseStateFacet::Completions.wire_name())
        {
            notes.push(
                "needs_to_be_reviewed and anything derived from it is internal: it silently blocks certificates and \
                grade visibility, and the student must never learn it exists - explain effects (\"the completion is \
                still being processed\") without the cause. The user-status-summary page above does show this \
                needs-review state (with a banner) to staff, so that page is where an admin can confirm the \
                blocked-certificate cause directly; the no-cause-to-student rule above only governs what you tell \
                the student.".to_string(),
            );
            if completions
                .raw_completions
                .iter()
                .any(|c| c.needs_to_be_reviewed)
            {
                notes.push(
                    "module_completion_statuses.completed: false can mean a completion exists in raw_completions but \
                    needs_to_be_reviewed - this is deliberate so a flagged student cannot infer suspicion, not a data \
                    contradiction. When that happens, passed is also null on the status entry as a consequence of \
                    completed: false, not a separate signal.".to_string(),
                );
            }
            notes.push(
                "raw_completions lists every completion row, including failed and superseded ones; \
                module_completion_statuses reports only the best one per module (grade improvement wins), so the two \
                can legitimately disagree in count - a regrade always writes a new row rather than editing one in \
                place. passed: false is a recorded failure, not \"still in progress\". grade: null means the module \
                is pass/fail, not that a grade is missing. completion_granter distinguishes staff-granted completions \
                (exempt from cheating flags) from automatic ones. eligible_for_ects: false blocks credit registration \
                regardless of the module's ECTS setting. completion_registration_attempt_date absent means the \
                student never opened the open-university registration form - pair with the credit_registration facet.".to_string(),
            );
        }

        if let Some(UserCourseStateFacetValue::Submissions(submissions)) =
            facets.get(UserCourseStateFacet::Submissions.wire_name())
        {
            notes.push(
                "Quote submission timestamps exactly when the question is whether an answer saved."
                    .to_string(),
            );
            notes.push(format!(
                "submissions are timestamps only, with no score or answer content. An absent row can mean nothing \
                was submitted, or that a reset soft-deleted the submissions it would have come from - cross-check \
                the resets facet before telling anyone an answer never saved. exercise_name absent means the exercise \
                has since been deleted from the course. exercise_attempts is present only when exercise_id was \
                passed; its absence means \"not requested\", never \"no attempts\". Each row's exercise_id links to \
                {base_url}/manage/exercises/<exercise_id>/submissions, the exercise-wide submission view.",
            ));
            if let Some(attempts) = &submissions.exercise_attempts {
                notes.push(
                    "attempt_count sums submissions across all slides, but out_of_tries is decided by the worst \
                    single slide reaching the cap, so attempt_count can exceed max_tries_per_slide with \
                    out_of_tries: false, or be below it with out_of_tries: true.".to_string(),
                );
                if attempts.limit_number_of_tries && attempts.max_tries_per_slide.is_none() {
                    notes.push(
                        "This exercise has limit_number_of_tries: true but no max_tries_per_slide, which means the \
                        limit does not actually exist - do not tell the student they are out of tries based on \
                        limit_number_of_tries alone.".to_string(),
                    );
                }
            }
        }

        if let Some(UserCourseStateFacetValue::Reviews(_)) =
            facets.get(UserCourseStateFacet::Reviews.wire_name())
        {
            notes.push(
                "in_review_stages only queries PeerReview, SelfReview, WaitingForPeerReviews and \
                WaitingForManualGrading; it omits ReviewedAndLocked (reviewed, scored, and permanently unanswerable \
                because the model solution was revealed) and the chapter-locking stages, so an empty list does not \
                mean nothing is blocking the student - only a reset clears ReviewedAndLocked, and the \
                user-status-summary page above shows ReviewedAndLocked as the exercise's own state, so check there \
                when this list is empty. NotStarted never \
                appears here and is the answerable state; any listed stage means the student cannot submit. Who is \
                blocking differs by stage: PeerReview/SelfReview waits on the student's own reviews, \
                WaitingForPeerReviews waits on other students, WaitingForManualGrading waits on the teacher. \
                teacher_grading_decisions are the latest decision per still-live exercise state, so a reset that \
                soft-deletes the state makes an earlier decision disappear from this list - an empty list is not \
                proof the student was never graded down, and a listed decision may already be superseded by a later \
                submission. hidden: true means the decision is hidden from the student - never quote its \
                justification back to them; hidden absent means unrecorded, not safe to quote. A FullPoints decision \
                can be system-generated by the peer-review timeout auto-pass. In peer_review_queue, no entry for an \
                exercise usually means the student has not yet given their own required peer reviews, not that \
                nothing is pending; peer_review_priority is higher-served-sooner, not a queue position.".to_string(),
            );
        }

        if let Some(UserCourseStateFacetValue::Resets(resets)) =
            facets.get(UserCourseStateFacet::Resets.wire_name())
        {
            notes.push(
                "reset_by absent means either the system did it (e.g. the automatic peer-review reset) or the \
                acting staff account has since been deleted - it does not mean the actor is unknown. reason is \
                shown to the student verbatim in the course material as the reset notice, so treat it as \
                user-facing text, not an internal field.".to_string(),
            );
            notes.push(format!(
                "{base_url}/manage/users/{} lists this student's exercise resets across every course, not just this \
                one - a superset of this facet worth checking when a reset elsewhere might explain something here.",
                self.state.user_id,
            ));
            if !resets.resets.is_empty() {
                notes.push(
                    "A reset soft-deletes the affected submissions, gradings, peer-review queue entries and \
                    exercise states, and unlocks the affected chapters, but it does not touch \
                    course_module_completions - a module can still show completed/graded while progress and \
                    submissions show nothing. A reset restores tries; it does not revoke completions.".to_string(),
                );
            }
        }

        if let Some(UserCourseStateFacetValue::Certificates(certificates)) =
            facets.get(UserCourseStateFacet::Certificates.wire_name())
        {
            notes.push(
                "certificates.configurations lists only single-module (\"default\") certificate configurations - an \
                empty array does not mean the course has no certificate. modules_blocked_by_pending_review is the \
                internal cause (a pending suspected-cheater review) and must never be told to the student; \
                missing_module_completions is the safe, student-explainable list. generated_certificates empty does \
                not mean generation failed - certificates are only created when the student explicitly clicks \
                generate, nothing generates them automatically; empty plus eligible: true means they can download it \
                now. verification_id both verifies and grants access to the certificate image - only share it with \
                the certificate's owner.".to_string(),
            );
            let certificates_search_url = search_url(
                base_url,
                &format!(
                    "/manage/courses/{}/students/certificates",
                    self.state.course_id
                ),
                &self.state.output.user_email,
            );
            notes.push(format!(
                "{certificates_search_url} lists this student's generated certificates (issued date, \
                verification URL, certificate image) for cross-checking generated_certificates.",
            ));
            if certificates
                .configurations
                .iter()
                .any(|c| c.eligible && !c.missing_module_completions.is_empty())
            {
                notes.push(
                    "eligible checks completions across the whole platform and ignores passed, while \
                    missing_module_completions counts an unpassed completion as missing - so eligible: true \
                    alongside a non-empty missing_module_completions is an expected combination here, not a bug; \
                    trust missing_module_completions when explaining what is left to do.".to_string(),
                );
            }
        }

        if facets.contains_key(UserCourseStateFacet::CreditRegistration.wire_name()) {
            notes.push(
                "credit_registration has one row per completion, keyed by course_module_id - a module with no \
                completion produces no row at all, so an empty array can mean \"nothing completed yet\" rather than \
                \"nothing registered\". study_registry: \"This platform\" means this platform recorded the \
                attainment itself, not that an external registry accepted it. registered_at is the row's own \
                created_at, not the registration date shown to the student in the registry.".to_string(),
            );
            let completions_search_url = search_url(
                base_url,
                &format!(
                    "/manage/courses/{}/students/completions",
                    self.state.course_id
                ),
                &self.state.output.user_email,
            );
            notes.push(format!(
                "{completions_search_url} shows per-module grade and registration status for \
                cross-checking, and \
                {base_url}/manage/credit-registration/registrations?user_id={} is the richer per-user view \
                (attempt chain, event timeline, API calls, attainment ids).",
                self.state.user_id,
            ));
        }

        if notes.is_empty() {
            return None;
        }
        Some(notes.join(" "))
    }
}

async fn progress_facet(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ChatbotResult<Vec<UserCourseProgress>> {
    Ok(user_exercise_states::get_user_course_progress(conn, course_id, user_id, false).await?)
}

/// Maps exercise id to name, for annotating rows that only carry an exercise id.
fn exercise_name_index(exercises: &[Exercise]) -> HashMap<Uuid, &str> {
    exercises.iter().map(|e| (e.id, e.name.as_str())).collect()
}

/// An absolute `{base_url}{path}` URL with a single percent-encoded `search` query parameter.
/// `search` can contain characters (e.g. a `+` in an email's local part) that are not safe to
/// interpolate into a query string directly.
fn search_url(base_url: &str, path: &str, search: &str) -> String {
    url::Url::parse(&format!("{base_url}{path}"))
        .map(|mut url| {
            url.query_pairs_mut().append_pair("search", search);
            url.to_string()
        })
        .unwrap_or_else(|_| format!("{base_url}{path}"))
}

#[derive(Serialize)]
struct CompletionsFacet {
    module_completion_statuses: Vec<UserModuleCompletionStatus>,
    raw_completions: Vec<RawCompletion>,
}

#[derive(Serialize)]
struct RawCompletion {
    course_module_id: Uuid,
    completion_date: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    grade: Option<i32>,
    passed: bool,
    needs_to_be_reviewed: bool,
    completion_granter: &'static str,
    eligible_for_ects: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    completion_registration_attempt_date: Option<DateTime<Utc>>,
}

async fn completions_facet(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    raw: &[CourseModuleCompletion],
) -> ChatbotResult<CompletionsFacet> {
    let module_completion_statuses =
        progressing::get_user_module_completion_statuses_for_course(conn, user_id, course_id)
            .await?;
    let raw_completions = raw
        .iter()
        .map(|c| RawCompletion {
            course_module_id: c.course_module_id,
            completion_date: c.completion_date,
            grade: c.grade,
            passed: c.passed,
            needs_to_be_reviewed: c.needs_to_be_reviewed,
            completion_granter: if c.completion_granter_user_id.is_some() {
                "granted by staff"
            } else {
                "automatic"
            },
            eligible_for_ects: c.eligible_for_ects,
            completion_registration_attempt_date: c.completion_registration_attempt_date,
        })
        .collect();
    Ok(CompletionsFacet {
        module_completion_statuses,
        raw_completions,
    })
}

#[derive(Serialize)]
struct SubmissionsFacet {
    submissions: Vec<SubmissionRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    exercise_attempts: Option<ExerciseAttempts>,
}

#[derive(Serialize)]
struct SubmissionRow {
    created_at: DateTime<Utc>,
    exercise_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    exercise_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    course_module_id: Option<Uuid>,
}

#[derive(Serialize)]
struct ExerciseAttempts {
    attempt_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tries_per_slide: Option<i32>,
    limit_number_of_tries: bool,
    out_of_tries: bool,
}

async fn submissions_facet(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    exercise_id: Option<Uuid>,
    course_exercises: &[Exercise],
) -> ChatbotResult<SubmissionsFacet> {
    let times =
        exercise_slide_submissions::get_user_course_submission_times(conn, user_id, course_id)
            .await?;
    let exercise_names = exercise_name_index(course_exercises);

    let submissions = times
        .iter()
        .filter(|t| exercise_id.is_none_or(|id| t.exercise_id == id))
        .map(|t| SubmissionRow {
            created_at: t.created_at,
            exercise_id: t.exercise_id,
            exercise_name: exercise_names.get(&t.exercise_id).map(|s| s.to_string()),
            course_module_id: t.course_module_id,
        })
        .collect();

    let mut exercise_attempts = None;

    if let Some(exercise_id) = exercise_id
        && let Some(exercise) = course_exercises.iter().find(|e| e.id == exercise_id)
    {
        let counts_per_slide =
            exercise_slide_submissions::get_exercise_slide_submission_counts_for_exercise_user(
                conn,
                exercise_id,
                CourseOrExamId::Course(course_id),
                user_id,
            )
            .await?;
        let attempt_count: i64 = counts_per_slide.values().sum();
        // A slide is out of tries once its own count reaches the per-slide cap, whichever slide
        // gets there first - matching the per-slide limit the course-material endpoint enforces.
        let max_slide_attempt_count = counts_per_slide.values().copied().max().unwrap_or(0);
        let out_of_tries = exercise.limit_number_of_tries
            && exercise
                .max_tries_per_slide
                .is_some_and(|max| max_slide_attempt_count >= max as i64);
        exercise_attempts = Some(ExerciseAttempts {
            attempt_count,
            max_tries_per_slide: exercise.max_tries_per_slide,
            limit_number_of_tries: exercise.limit_number_of_tries,
            out_of_tries,
        });
    }

    Ok(SubmissionsFacet {
        submissions,
        exercise_attempts,
    })
}

#[derive(Serialize)]
struct ReviewsFacet {
    in_review_stages: Vec<InReviewStageRow>,
    teacher_grading_decisions: Vec<TeacherGradingDecisionRow>,
    peer_review_queue: Vec<PeerReviewQueueRow>,
}

#[derive(Serialize)]
struct InReviewStageRow {
    exercise_id: Uuid,
    exercise_name: String,
    reviewing_stage: ReviewingStage,
    #[serde(skip_serializing_if = "Option::is_none")]
    score_given: Option<f32>,
}

#[derive(Serialize)]
struct TeacherGradingDecisionRow {
    #[serde(skip_serializing_if = "Option::is_none")]
    exercise_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    exercise_name: Option<String>,
    teacher_decision: TeacherDecisionType,
    score_given: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    justification: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    hidden: Option<bool>,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
struct PeerReviewQueueRow {
    exercise_id: Uuid,
    received_enough_peer_reviews: bool,
    peer_review_priority: i32,
    created_at: DateTime<Utc>,
}

async fn reviews_facet(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    exercise_id: Option<Uuid>,
    course_exercises: &[Exercise],
) -> ChatbotResult<ReviewsFacet> {
    let states = user_exercise_states::get_states_in_reviewing_stages_for_user_and_course(
        conn,
        user_id,
        course_id,
        &[
            ReviewingStage::PeerReview,
            ReviewingStage::SelfReview,
            ReviewingStage::WaitingForPeerReviews,
            ReviewingStage::WaitingForManualGrading,
        ],
    )
    .await?;
    let in_review_stages = states
        .iter()
        .map(|s| InReviewStageRow {
            exercise_id: s.exercise_id,
            exercise_name: s.exercise_name.clone(),
            reviewing_stage: s.reviewing_stage,
            score_given: s.score_given,
        })
        .collect();

    let decisions =
        teacher_grading_decisions::get_all_latest_grading_decisions_by_user_id_and_course_id(
            conn, user_id, course_id,
        )
        .await?;
    let exercise_id_by_user_exercise_state_id: HashMap<Uuid, Uuid> =
        user_exercise_states::get_all_for_user_and_course_or_exam(
            conn,
            user_id,
            CourseOrExamId::Course(course_id),
        )
        .await?
        .into_iter()
        .map(|s| (s.id, s.exercise_id))
        .collect();
    let exercise_names = exercise_name_index(course_exercises);
    let teacher_grading_decisions = decisions
        .iter()
        .map(|d| {
            let exercise_id = exercise_id_by_user_exercise_state_id
                .get(&d.user_exercise_state_id)
                .copied();
            TeacherGradingDecisionRow {
                exercise_id,
                exercise_name: exercise_id
                    .and_then(|id| exercise_names.get(&id))
                    .map(|s| s.to_string()),
                teacher_decision: d.teacher_decision,
                score_given: d.score_given,
                justification: d.justification.clone(),
                hidden: d.hidden,
                created_at: d.created_at,
            }
        })
        .collect();

    let peer_review_entries = if let Some(exercise_id) = exercise_id {
        peer_review_queue_entries::try_to_get_by_user_and_exercise_and_course_ids(
            conn,
            user_id,
            exercise_id,
            course_id,
        )
        .await?
        .into_iter()
        .collect()
    } else {
        peer_review_queue_entries::get_all_by_user_and_course_id(conn, user_id, course_id).await?
    };
    let peer_review_queue = peer_review_entries
        .iter()
        .map(|e| PeerReviewQueueRow {
            exercise_id: e.exercise_id,
            received_enough_peer_reviews: e.received_enough_peer_reviews,
            peer_review_priority: e.peer_review_priority,
            created_at: e.created_at,
        })
        .collect();

    Ok(ReviewsFacet {
        in_review_stages,
        teacher_grading_decisions,
        peer_review_queue,
    })
}

#[derive(Serialize)]
struct ResetsFacet {
    resets: Vec<ResetRow>,
}

#[derive(Serialize)]
struct ResetRow {
    exercise_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    reset_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
    reset_at: DateTime<Utc>,
}

async fn resets_facet(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ChatbotResult<ResetsFacet> {
    let logs = exercise_reset_logs::get_exercise_reset_logs_for_user(conn, user_id).await?;
    let resets = logs
        .into_iter()
        .filter(|l| l.course_id == course_id)
        .map(|l| {
            let reset_by = match (l.reset_by_first_name, l.reset_by_last_name) {
                (Some(first), Some(last)) => Some(format!("{first} {last}")),
                (Some(first), None) => Some(first),
                (None, Some(last)) => Some(last),
                (None, None) => None,
            };
            ResetRow {
                exercise_name: l.exercise_name,
                reset_by,
                reason: l.reason,
                reset_at: l.reset_at,
            }
        })
        .collect();
    Ok(ResetsFacet { resets })
}

#[derive(Serialize)]
struct CertificatesFacet {
    configurations: Vec<CertificateConfigurationRow>,
    generated_certificates: Vec<GeneratedCertificateRow>,
}

#[derive(Serialize)]
struct CertificateConfigurationRow {
    certificate_configuration_id: Uuid,
    eligible: bool,
    missing_module_completions: Vec<String>,
    modules_blocked_by_pending_review: Vec<String>,
}

#[derive(Serialize)]
struct GeneratedCertificateRow {
    verification_id: String,
    name_on_certificate: String,
    created_at: DateTime<Utc>,
}

async fn certificates_facet(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    raw_completions: &[CourseModuleCompletion],
) -> ChatbotResult<CertificatesFacet> {
    let configurations =
        certificate_configurations::get_default_certificate_configurations_and_requirements_by_course(
            conn, course_id,
        )
        .await?;
    let modules = course_modules::get_by_course_id(conn, course_id).await?;
    let module_names: HashMap<Uuid, String> = modules
        .iter()
        .map(|m| {
            (
                m.id,
                m.name
                    .clone()
                    .unwrap_or_else(|| "Default module".to_string()),
            )
        })
        .collect();

    let mut configurations_json = Vec::new();
    for configuration in &configurations {
        let eligible = configuration
            .requirements
            .has_user_completed_all_requirements(conn, user_id)
            .await?;
        let mut missing_module_completions = Vec::new();
        // A completion can exist but still be withheld from certificate eligibility because it
        // needs_to_be_reviewed (e.g. a suspected-cheater flag) - surfaced here separately so
        // support can explain "still processing" without naming the real, internal reason.
        let mut modules_blocked_by_pending_review = Vec::new();
        for module_id in &configuration.requirements.course_module_ids {
            let module_name = module_names
                .get(module_id)
                .cloned()
                .unwrap_or_else(|| module_id.to_string());
            match raw_completions
                .iter()
                .find(|c| c.course_module_id == *module_id)
            {
                None => missing_module_completions.push(module_name),
                Some(c) if c.needs_to_be_reviewed => {
                    modules_blocked_by_pending_review.push(module_name)
                }
                Some(c) if !c.passed => missing_module_completions.push(module_name),
                Some(_) => {}
            }
        }
        configurations_json.push(CertificateConfigurationRow {
            certificate_configuration_id: configuration.certificate_configuration.id,
            eligible,
            missing_module_completions,
            modules_blocked_by_pending_review,
        });
    }

    let generated_certificates = generated_certificates::get_all_by_user_id(conn, user_id)
        .await?
        .into_iter()
        .filter(|c| c.course_id == course_id)
        .map(|c| GeneratedCertificateRow {
            verification_id: c.verification_id,
            name_on_certificate: c.name_on_certificate,
            created_at: c.created_at,
        })
        .collect();

    Ok(CertificatesFacet {
        configurations: configurations_json,
        generated_certificates,
    })
}

#[derive(Serialize)]
struct CreditRegistrationFacet {
    registrations: Vec<CreditRegistrationRow>,
}

#[derive(Serialize)]
struct CreditRegistrationRow {
    course_module_id: Uuid,
    registered: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    registered_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    study_registry: Option<String>,
}

async fn credit_registration_facet(
    conn: &mut PgConnection,
    completions: &[CourseModuleCompletion],
) -> ChatbotResult<CreditRegistrationFacet> {
    let completion_ids: Vec<Uuid> = completions.iter().map(|c| c.id).collect();
    let registrations =
        course_module_completion_registered_to_study_registries::get_registrations_by_completion_ids(
            conn,
            &completion_ids,
        )
        .await?;
    let registrar_ids: Vec<Uuid> = registrations
        .iter()
        .filter_map(|r| r.study_registry_registrar_id)
        .collect();
    let registrar_names: HashMap<Uuid, String> =
        study_registry_registrars::get_by_ids(conn, &registrar_ids)
            .await?
            .into_iter()
            .map(|registrar| (registrar.id, registrar.name))
            .collect();

    let mut result = Vec::new();
    for completion in completions {
        let registration = registrations
            .iter()
            .find(|r| r.course_module_completion_id == completion.id);
        let study_registry = match registration.and_then(|r| r.study_registry_registrar_id) {
            Some(registrar_id) => registrar_names.get(&registrar_id).cloned(),
            None if registration.is_some() => Some("This platform".to_string()),
            None => None,
        };
        result.push(CreditRegistrationRow {
            course_module_id: completion.course_module_id,
            registered: registration.is_some(),
            registered_at: registration.map(|r| r.created_at),
            study_registry,
        });
    }

    Ok(CreditRegistrationFacet {
        registrations: result,
    })
}
