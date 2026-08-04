//! Addressed faults: what can go wrong that the world's own data cannot express.
//!
//! Predicates are AND-ed and order-independent, so a miss can name the single predicate that failed.
//! No HTTP and no Redis: `explainFault` runs a fault against a hypothetical request with neither.

use headless_lms_models::suotar_api_calls::SuotarEndpoint;

use crate::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Stage {
    Auth,
    RequestGate,
    Parse,
    Resolve,
    AfterWrite,
    Respond,
}

impl Stage {
    pub const ALL: [Self; 6] = [
        Self::Auth,
        Self::RequestGate,
        Self::Parse,
        Self::Resolve,
        Self::AfterWrite,
        Self::Respond,
    ];

    /// True where the write-back pipeline has already committed.
    pub fn is_post_commit(self) -> bool {
        matches!(self, Self::AfterWrite | Self::Respond)
    }

    /// True where the body has not been read yet, so an owner-narrowed fault has to be deferred.
    pub fn is_pre_load(self) -> bool {
        matches!(self, Self::Auth | Self::RequestGate | Self::Parse)
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auth => "auth",
            Self::RequestGate => "requestGate",
            Self::Parse => "parse",
            Self::Resolve => "resolve",
            Self::AfterWrite => "afterWrite",
            Self::Respond => "respond",
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerRef {
    pub user: Option<String>,
    pub course: Option<String>,
}

impl OwnerRef {
    pub fn is_empty(&self) -> bool {
        self.user.is_none() && self.course.is_none()
    }
}

/// An owner turned into the keys the wire carries, resolved once at arm time: a fault whose meaning
/// changed because the user linked in the meantime would be unassertable.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedOwner {
    pub user: Option<String>,
    pub course: Option<String>,
    pub student_numbers: Vec<String>,
    pub course_codes: Vec<String>,
    pub product_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Predicate {
    Endpoint(SuotarEndpoint),
    Stage(Stage),
    StudentNumber(String),
    CourseCode(String),
    Owner(OwnerRef),
}

impl Predicate {
    pub fn key(&self) -> &'static str {
        match self {
            Self::Endpoint(_) => "endpoint",
            Self::Stage(_) => "stage",
            Self::StudentNumber(_) => "studentNumber",
            Self::CourseCode(_) => "courseCode",
            Self::Owner(_) => "owner",
        }
    }

    /// Names data one spec owns, which is what keeps a fault inside its own traffic.
    fn is_owner_key(&self) -> bool {
        matches!(
            self,
            Self::StudentNumber(_) | Self::CourseCode(_) | Self::Owner(_)
        )
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum Effect {
    ItemLevel {
        code: String,
        message: Option<String>,
        #[serde(default)]
        disclose_submitted_attainment_id: bool,
    },
    RequestLevel {
        status: u16,
        code: String,
        message: Option<String>,
    },
    ConnectionReset,
}

impl Effect {
    /// Derived from the kind, never declared: a descriptor naming both `level: item` and
    /// `kind: connectionReset` is nonsense.
    pub fn is_request_shaped(&self) -> bool {
        !matches!(self, Self::ItemLevel { .. })
    }

    pub fn code(&self) -> Option<&str> {
        match self {
            Self::ItemLevel { code, .. } | Self::RequestLevel { code, .. } => Some(code),
            Self::ConnectionReset => None,
        }
    }

    pub fn kind(&self) -> &'static str {
        match self {
            Self::ItemLevel { .. } => "itemLevel",
            Self::RequestLevel { .. } => "requestLevel",
            Self::ConnectionReset => "connectionReset",
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lifetime {
    pub matching_calls: Option<u32>,
    pub matching_items: Option<u32>,
}

impl Lifetime {
    pub fn budget(&self) -> Option<u32> {
        self.matching_calls.or(self.matching_items)
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlatWhen {
    pub endpoint: Option<SuotarEndpoint>,
    pub stage: Option<Stage>,
    pub student_number: Option<String>,
    pub course_code: Option<String>,
    pub owner: Option<OwnerRef>,
}

/// A flat literal is sugar and desugars into the predicate list.
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum WhenSpec {
    Predicates(Vec<Predicate>),
    Flat(Box<FlatWhen>),
}

impl WhenSpec {
    pub fn into_predicates(self) -> Vec<Predicate> {
        match self {
            Self::Predicates(predicates) => predicates,
            Self::Flat(flat) => {
                let mut predicates = Vec::new();
                if let Some(endpoint) = flat.endpoint {
                    predicates.push(Predicate::Endpoint(endpoint));
                }
                if let Some(stage) = flat.stage {
                    predicates.push(Predicate::Stage(stage));
                }
                if let Some(value) = flat.student_number {
                    predicates.push(Predicate::StudentNumber(value));
                }
                if let Some(value) = flat.course_code {
                    predicates.push(Predicate::CourseCode(value));
                }
                if let Some(value) = flat.owner {
                    predicates.push(Predicate::Owner(value));
                }
                predicates
            }
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FaultSpec {
    pub id: String,
    pub when: WhenSpec,
    pub then: Effect,
    #[serde(default)]
    pub lifetime: Lifetime,
    /// Required to arm the one combination that would otherwise pin a double submission into a
    /// green build.
    #[serde(default)]
    pub proves_double_submission: bool,
}

/// An armed fault. Immutable: re-arming an id replaces the value and re-mints its `seq`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fault {
    pub id: String,
    /// Arm order, which is precedence: first match wins.
    pub seq: u64,
    pub when: Vec<Predicate>,
    pub then: Effect,
    pub lifetime: Lifetime,
    pub proves_double_submission: bool,
    pub owner: Option<ResolvedOwner>,
    pub parallel_safe: bool,
    pub armed_at: DateTime<Utc>,
}

impl Fault {
    pub fn endpoint(&self) -> Option<SuotarEndpoint> {
        self.when.iter().find_map(|predicate| match predicate {
            Predicate::Endpoint(endpoint) => Some(*endpoint),
            _ => None,
        })
    }

    pub fn stage(&self) -> Option<Stage> {
        self.when.iter().find_map(|predicate| match predicate {
            Predicate::Stage(stage) => Some(*stage),
            _ => None,
        })
    }

    pub fn has_owner_key(&self) -> bool {
        self.when.iter().any(Predicate::is_owner_key)
    }
}

/// The address keys one request item carries, after the working-set load filled in what the wire
/// did not.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ItemAddress {
    pub request_item_id: String,
    pub student_number: Option<String>,
    pub course_code: Option<String>,
    pub product_id: Option<String>,
    pub submitted_attainment_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FaultMatch {
    Fires,
    /// The key of the predicate that failed.
    Missed(&'static str),
}

impl FaultMatch {
    pub fn fires(&self) -> bool {
        matches!(self, Self::Fires)
    }
}

pub fn matches_item(
    fault: &Fault,
    endpoint: SuotarEndpoint,
    stage: Stage,
    item: &ItemAddress,
) -> FaultMatch {
    for predicate in &fault.when {
        let satisfied = match predicate {
            Predicate::Endpoint(wanted) => *wanted == endpoint,
            Predicate::Stage(wanted) => *wanted == stage,
            Predicate::StudentNumber(wanted) => item.student_number.as_deref() == Some(wanted),
            Predicate::CourseCode(wanted) => item.course_code.as_deref() == Some(wanted),
            Predicate::Owner(_) => fault
                .owner
                .as_ref()
                .is_some_and(|owner| owner_matches(owner, item)),
        };
        if !satisfied {
            return FaultMatch::Missed(predicate.key());
        }
    }
    FaultMatch::Fires
}

/// A request-shaped effect fires only when **every** item resolves to the fault's owner: on a mixed
/// batch it would otherwise kill rows nobody armed anything for.
pub fn matches_request(
    fault: &Fault,
    endpoint: SuotarEndpoint,
    stage: Stage,
    items: &[ItemAddress],
) -> FaultMatch {
    if !fault.has_owner_key() {
        return matches_item(fault, endpoint, stage, &ItemAddress::default());
    }
    if items.is_empty() {
        return FaultMatch::Missed("owner");
    }
    let mut missed = None;
    for item in items {
        match matches_item(fault, endpoint, stage, item) {
            FaultMatch::Fires => {}
            FaultMatch::Missed(predicate) => missed = Some(predicate),
        }
    }
    match missed {
        Some(predicate) => FaultMatch::Missed(predicate),
        None => FaultMatch::Fires,
    }
}

/// Each half constrains only the keys the item carries, so on `list-by-course` — which carries no
/// student number — the course half alone decides.
fn owner_matches(owner: &ResolvedOwner, item: &ItemAddress) -> bool {
    let mut constrained = false;
    if owner.user.is_some()
        && let Some(student_number) = &item.student_number
    {
        if !owner.student_numbers.contains(student_number) {
            return false;
        }
        constrained = true;
    }
    if owner.course.is_some() {
        if let Some(course_code) = &item.course_code {
            if !owner.course_codes.contains(course_code) {
                return false;
            }
            constrained = true;
        }
        if let Some(product_id) = &item.product_id {
            if !owner.product_ids.contains(product_id) {
                return false;
            }
            constrained = true;
        }
    }
    constrained
}

pub struct FaultProblem {
    pub code: String,
    pub message: String,
}

impl FaultProblem {
    fn new(code: &str, message: String) -> Self {
        Self {
            code: code.to_string(),
            message,
        }
    }
}

/// What an endpoint can resolve, not what its body carries: verify's body holds only a submitted
/// attainment id, and the working set reads the person behind it.
pub fn resolvable_keys(endpoint: SuotarEndpoint) -> &'static [&'static str] {
    match endpoint {
        SuotarEndpoint::ResolvePersons => &["studentNumber", "owner"],
        SuotarEndpoint::ResolveEnrolments
        | SuotarEndpoint::ImportAttainments
        | SuotarEndpoint::VerifyAttainments => &["studentNumber", "courseCode", "owner"],
        SuotarEndpoint::ProductAccessTokens => &["owner"],
        SuotarEndpoint::ListByCourse => &["courseCode", "owner"],
    }
}

/// Read from the state machine rather than restated, so this guard cannot drift from the class it
/// guards.
fn is_retryable_transient_code(code: &str) -> bool {
    headless_lms_models::library::credit_registration::classification::is_retryable_transient_wire_code(
        code,
    )
}

/// Whether the endpoint's contract lists a transient code among its per-item results;
/// `resolve-enrolments` and `import` carry it only in the request-level form.
fn carries_item_level_transient(endpoint: SuotarEndpoint) -> bool {
    matches!(
        endpoint,
        SuotarEndpoint::ResolvePersons
            | SuotarEndpoint::VerifyAttainments
            | SuotarEndpoint::ProductAccessTokens
            | SuotarEndpoint::ListByCourse
    )
}

/// Rejects a fault that could never fire, and the one combination that would fire and be wrong.
pub fn validate(
    predicates: &[Predicate],
    effect: &Effect,
    proves_double_submission: bool,
) -> Result<(SuotarEndpoint, Stage), FaultProblem> {
    let mut endpoint = None;
    let mut stage = None;
    let mut seen = Vec::new();
    for predicate in predicates {
        if seen.contains(&predicate.key()) {
            return Err(FaultProblem::new(
                "invalidFault",
                format!("The predicate `{}` is given twice.", predicate.key()),
            ));
        }
        seen.push(predicate.key());
        match predicate {
            Predicate::Endpoint(value) => endpoint = Some(*value),
            Predicate::Stage(value) => stage = Some(*value),
            _ => {}
        }
    }
    let Some(endpoint) = endpoint else {
        return Err(FaultProblem::new(
            "invalidFault",
            "A fault must name an `endpoint`.".to_string(),
        ));
    };
    let Some(stage) = stage else {
        return Err(FaultProblem::new(
            "invalidFault",
            format!(
                "A fault must name a `stage`, one of {}. There is no default, because a fault at a post-commit stage means something different from the same fault before the write.",
                Stage::ALL
                    .iter()
                    .map(|s| s.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        ));
    };

    let resolvable = resolvable_keys(endpoint);
    for predicate in predicates {
        let key = predicate.key();
        if matches!(key, "endpoint" | "stage") {
            continue;
        }
        if !resolvable.contains(&key) {
            return Err(FaultProblem::new(
                "invalidFault",
                format!(
                    "`{key}` cannot be resolved on this endpoint. It resolves: {}.",
                    resolvable.join(", ")
                ),
            ));
        }
    }

    if let Some(Predicate::Owner(owner)) = predicates
        .iter()
        .find(|predicate| matches!(predicate, Predicate::Owner(_)))
        && owner.is_empty()
    {
        return Err(FaultProblem::new(
            "invalidFault",
            "`owner` must name a user, a course, or both.".to_string(),
        ));
    }

    if matches!(effect, Effect::ItemLevel { .. }) && stage.is_pre_load() {
        return Err(FaultProblem::new(
            "invalidFault",
            format!(
                "An item-level effect has no item to attach to at `{}`, which is decided before the body is read. Use `resolve`, `afterWrite` or `respond`.",
                stage.as_str()
            ),
        ));
    }

    // Naming an unexpected code is allowed on purpose; only the transient class is refused, because
    // it is the one that would teach a client to retry a body Suotar could never have sent.
    if matches!(effect, Effect::ItemLevel { .. })
        && effect.code().is_some_and(is_retryable_transient_code)
        && !carries_item_level_transient(endpoint)
    {
        return Err(FaultProblem::new(
            "invalidFault",
            format!(
                "This endpoint carries no item-level `{}`; Suotar can only fail the whole request that way. Use a `requestLevel` effect.",
                effect.code().unwrap_or_default()
            ),
        ));
    }

    if endpoint == SuotarEndpoint::ImportAttainments
        && stage.is_post_commit()
        && effect.code().is_some_and(is_retryable_transient_code)
        && !proves_double_submission
    {
        return Err(FaultProblem::new(
            "refusedFault",
            format!(
                "An import answered with `{}` after the write has committed holds the attainment and tells the client to retry, which is the double submission. Set `provesDoubleSubmission: true` if that is what the spec is proving.",
                effect.code().unwrap_or_default()
            ),
        ));
    }

    Ok((endpoint, stage))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn predicates(stage: Stage) -> Vec<Predicate> {
        vec![
            Predicate::Endpoint(SuotarEndpoint::ImportAttainments),
            Predicate::Stage(stage),
        ]
    }

    fn transient(item_level: bool) -> Effect {
        if item_level {
            Effect::ItemLevel {
                code: "sisuTemporarilyUnavailable".to_string(),
                message: None,
                disclose_submitted_attainment_id: false,
            }
        } else {
            Effect::RequestLevel {
                status: 503,
                code: "sisuTemporarilyUnavailable".to_string(),
                message: None,
            }
        }
    }

    #[test]
    fn a_retryable_code_after_the_import_write_is_refused_unless_it_is_the_point() {
        for stage in [Stage::AfterWrite, Stage::Respond] {
            assert!(
                validate(&predicates(stage), &transient(false), false).is_err(),
                "{stage:?} was not refused"
            );
            assert!(validate(&predicates(stage), &transient(false), true).is_ok());
        }
        // Before the write there is no attainment being held, so nothing needs excusing.
        assert!(validate(&predicates(Stage::RequestGate), &transient(false), false).is_ok());
    }

    /// The double-submission flag excuses a double submission, not a response shape Suotar cannot
    /// produce.
    #[test]
    fn an_item_level_transient_is_refused_where_the_contract_carries_none() {
        for endpoint in [
            SuotarEndpoint::ImportAttainments,
            SuotarEndpoint::ResolveEnrolments,
        ] {
            for stage in [Stage::Resolve, Stage::AfterWrite, Stage::Respond] {
                let when = vec![Predicate::Endpoint(endpoint), Predicate::Stage(stage)];
                let problem = validate(&when, &transient(true), true)
                    .err()
                    .unwrap_or_else(|| {
                        panic!("{endpoint:?} at {stage:?} accepted an impossible item code")
                    });
                assert!(problem.message.contains("requestLevel"));
                assert!(
                    validate(&when, &transient(false), stage.is_post_commit()).is_ok(),
                    "the request-level form is the way to drive it"
                );
            }
        }
        for endpoint in [
            SuotarEndpoint::ResolvePersons,
            SuotarEndpoint::VerifyAttainments,
            SuotarEndpoint::ProductAccessTokens,
            SuotarEndpoint::ListByCourse,
        ] {
            let when = vec![
                Predicate::Endpoint(endpoint),
                Predicate::Stage(Stage::Resolve),
            ];
            assert!(
                validate(&when, &transient(true), false).is_ok(),
                "{endpoint:?} does carry the transient item code"
            );
        }
    }

    #[test]
    fn a_key_the_endpoint_cannot_resolve_is_refused_and_an_indirect_one_is_not() {
        let unresolvable = vec![
            Predicate::Endpoint(SuotarEndpoint::ListByCourse),
            Predicate::Stage(Stage::Resolve),
            Predicate::StudentNumber("900000101".to_string()),
        ];
        let problem = validate(&unresolvable, &transient(true), false)
            .err()
            .expect("list-by-course carries no student number");
        assert!(problem.message.contains("courseCode"));

        let indirect = vec![
            Predicate::Endpoint(SuotarEndpoint::VerifyAttainments),
            Predicate::Stage(Stage::Resolve),
            Predicate::Owner(OwnerRef {
                user: Some("someone@example.com".to_string()),
                course: None,
            }),
        ];
        assert!(validate(&indirect, &transient(true), false).is_ok());
    }
}
