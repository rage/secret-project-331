//! The fixture identities the credit-registration (Suotar) system tests are built from.
//!
//! The seed writes the database rows and the mock study registry serves the matching registry rows,
//! so neither side owns these: both read them here.
//!
//! Every seeded account holds one student number for good, so a number is shared by every spec that
//! drives that account. Isolation is per (student number, course code) instead: the mock and the
//! workers are global, so no two specs may drive the same account on the same course.
//! [`LANE_COMPLETIONS`] and the table in `system-tests/src/utils/creditRegistration.ts` allocate
//! them. Numbers are digits only, 6–12 of them, per `verified_student_numbers.student_number_format`,
//! the leading `9` keeping them clear of real UH numbers.
//!
//! Names and emails are unlikely strings (`Zzyzx …`) because a spec asserts their absence from the
//! scrubbed Suotar API log.

use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

use super::commands::{
    CourseUnitUpsert, EnrolmentUpsert, PersonUpsert, RealisationUpsert, SisuViolationsUpsert,
    WorldPush,
};
use super::world::{
    CourseBehaviour, CreditRange, DatePeriod, EnrolmentState, LocalizedName, PersonBehaviour,
    RealisationKind, SuotarCourse, WorldDefaults,
};

/// The general Suotar course, and the only one with a chapter page to read.
pub const SUOTAR_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0001_4a5e_9e6e_c0de00000001);
/// A second general Suotar course, so one account can serve a spec on each.
pub const SUOTAR_B_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0003_4a5e_9e6e_c0de00000003);
/// A course left on the legacy open-university pull flow, for the coexistence specs.
pub const OLD_FLOW_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0002_4a5e_9e6e_c0de00000002);
/// Owned by `suotar-import-outcomes.spec.ts`; its modules are the failing shapes.
pub const IMPORT_OUTCOMES_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0004_4a5e_9e6e_c0de00000004);
/// Owned by `suotar-grade-improvement.spec.ts`, and the only graded module here.
pub const GRADE_IMPROVEMENT_COURSE_ID: Uuid =
    Uuid::from_u128(0xc5ed17ea_0005_4a5e_9e6e_c0de00000005);
/// Owned by `suotar-admin-dashboard.spec.ts`: discovery and the linking mails tick by course, so the
/// spec that ticks them needs a roster no other spec's unlinked people are on.
pub const ADMIN_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0006_4a5e_9e6e_c0de00000006);
/// One frozen ledger row per registration state and per error code, on paused modules. Read by
/// `suotar-teacher-views.spec.ts` and the admin explorer, written by neither.
pub const STATES_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0007_4a5e_9e6e_c0de00000007);
/// Owned by `suotar-teacher-views.spec.ts`'s retry half, and swept by its bulk retry.
pub const RETRY_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0009_4a5e_9e6e_c0de00000009);

pub const CRS_101: &str = "CRS-101";
pub const CRS_B_101: &str = "CRS-B-101";
pub const CRS_OLD_101: &str = "CRS-OLD-101";
/// The module `suotar-old-flow-coexistence.spec.ts` treats as already cut over: Suotar-enabled, but
/// holding a completion the legacy pull path registered before the cutover happened.
pub const CRS_OLD_102: &str = "CRS-OLD-102";
pub const CRS_ADMIN_101: &str = "CRS-ADMIN-101";
/// One module per column of the frozen-row grid: an account holds one completion per module.
pub const STATES_COURSE_CODES: [&str; 6] = [
    "CRS-STATES-101",
    "CRS-STATES-102",
    "CRS-STATES-103",
    "CRS-STATES-104",
    "CRS-STATES-105",
    "CRS-STATES-106",
];
pub const CRS_RETRY_101: &str = "CRS-RETRY-101";

pub const CRS_GRADED_101: &str = "CRS-GRADED-101";
/// One module per import failure, each breaking exactly one thing.
pub const CRS_IMPORT_101: &str = "CRS-IMPORT-101";
pub const CRS_IMPORT_102: &str = "CRS-IMPORT-102";
pub const CRS_IMPORT_103: &str = "CRS-IMPORT-103";
pub const CRS_IMPORT_104: &str = "CRS-IMPORT-104";
pub const IMPORT_OUTCOME_COURSE_CODES: [&str; 4] = [
    CRS_IMPORT_101,
    CRS_IMPORT_102,
    CRS_IMPORT_103,
    CRS_IMPORT_104,
];

pub const SUOTAR_COURSE_SLUG: &str = "credit-registration-via-suotar";
pub const SUOTAR_B_COURSE_SLUG: &str = "credit-registration-via-suotar-b";
pub const OLD_FLOW_COURSE_SLUG: &str = "credit-registration-old-flow";
pub const IMPORT_OUTCOMES_COURSE_SLUG: &str = "credit-registration-import-outcomes";
pub const GRADE_IMPROVEMENT_COURSE_SLUG: &str = "credit-registration-grade-improvement";
pub const ADMIN_COURSE_SLUG: &str = "credit-registration-admin";
pub const STATES_COURSE_SLUG: &str = "credit-registration-states";
pub const RETRY_COURSE_SLUG: &str = "credit-registration-retry";

/// A Sisu person, and the seeded account it belongs to if any. The database rows and the pushed
/// persons must carry the same identifiers, so both are built from here.
pub struct MockPersonFixture {
    pub student_number: &'static str,
    pub first_names: &'static str,
    pub last_name: &'static str,
    /// Where the account-linking mail goes.
    pub sisu_email: &'static str,
    pub account_email: Option<&'static str>,
}

impl MockPersonFixture {
    pub fn sisu_person_id(&self) -> String {
        format!("hy-hlo-{}", self.student_number)
    }
}

/// A general seeded student the credit-registration seed links to this number, like `student7` and
/// `student8`. Kept off every row that asks something of the student:
/// `suotar-student-profile.spec.ts` asserts its studies page is clean.
pub const STUDENT_6: MockPersonFixture = MockPersonFixture {
    student_number: "900000006",
    first_names: "Zzyzx",
    last_name: "Studentsix",
    sisu_email: "zzyzx.studentsix@helsinki.example",
    account_email: Some("student6@example.com"),
};
pub const STUDENT_7: MockPersonFixture = MockPersonFixture {
    student_number: "900000007",
    first_names: "Zzyzx",
    last_name: "Studentseven",
    sisu_email: "zzyzx.studentseven@helsinki.example",
    account_email: Some("student7@example.com"),
};
pub const STUDENT_8: MockPersonFixture = MockPersonFixture {
    student_number: "900000008",
    first_names: "Zzyzx",
    last_name: "Studenteight",
    sisu_email: "zzyzx.studenteight@helsinki.example",
    account_email: Some("student8@example.com"),
};

/// Created and linked to this number by the credit-registration seed, like the four below.
pub const CREDIT_REGISTRATION_STUDENT_1: MockPersonFixture = MockPersonFixture {
    student_number: "900000011",
    first_names: "Zzyzx",
    last_name: "Crsone",
    sisu_email: "zzyzx.crsone@helsinki.example",
    account_email: Some("credit-registration-student-1@example.com"),
};
/// Linked by support by hand rather than by the mailed link, which the teacher view renders
/// differently.
pub const CREDIT_REGISTRATION_STUDENT_2: MockPersonFixture = MockPersonFixture {
    student_number: "900000012",
    first_names: "Zzyzx",
    last_name: "Crstwo",
    sisu_email: "zzyzx.crstwo@helsinki.example",
    account_email: Some("credit-registration-student-2@example.com"),
};
pub const CREDIT_REGISTRATION_STUDENT_3: MockPersonFixture = MockPersonFixture {
    student_number: "900000013",
    first_names: "Zzyzx",
    last_name: "Crsthree",
    sisu_email: "zzyzx.crsthree@helsinki.example",
    account_email: Some("credit-registration-student-3@example.com"),
};
pub const CREDIT_REGISTRATION_STUDENT_4: MockPersonFixture = MockPersonFixture {
    student_number: "900000014",
    first_names: "Zzyzx",
    last_name: "Crsfour",
    sisu_email: "zzyzx.crsfour@helsinki.example",
    account_email: Some("credit-registration-student-4@example.com"),
};
pub const CREDIT_REGISTRATION_STUDENT_5: MockPersonFixture = MockPersonFixture {
    student_number: "900000015",
    first_names: "Zzyzx",
    last_name: "Crsfive",
    sisu_email: "zzyzx.crsfive@helsinki.example",
    account_email: Some("credit-registration-student-5@example.com"),
};

/// A seeded completion on one of the two general Suotar courses, and the enrolments the registry
/// holds for it. Without one the row parks at `no_usable_enrolment`, or waits for its spec to create
/// the enrolment after arming a fault, so no earlier unscoped sweep can import the row first.
pub struct LaneCompletion {
    pub student: &'static MockPersonFixture,
    pub course_code: &'static str,
    pub enrolments: &'static [RealisationKind],
}

const NOT_ENROLLED: &[RealisationKind] = &[];
const DEGREE: &[RealisationKind] = &[RealisationKind::Degree];

pub const LANE_COMPLETIONS: [LaneCompletion; 14] = [
    // suotar-in-course-banner
    LaneCompletion {
        student: &STUDENT_7,
        course_code: CRS_101,
        enrolments: NOT_ENROLLED,
    },
    LaneCompletion {
        student: &STUDENT_8,
        course_code: CRS_101,
        enrolments: NOT_ENROLLED,
    },
    // suotar-enrolment-problems
    LaneCompletion {
        student: &CREDIT_REGISTRATION_STUDENT_1,
        course_code: CRS_101,
        enrolments: &[RealisationKind::Degree, RealisationKind::OpenUniversity],
    },
    LaneCompletion {
        student: &STUDENT_7,
        course_code: CRS_B_101,
        enrolments: NOT_ENROLLED,
    },
    // suotar-student-emails
    LaneCompletion {
        student: &CREDIT_REGISTRATION_STUDENT_2,
        course_code: CRS_101,
        enrolments: DEGREE,
    },
    LaneCompletion {
        student: &STUDENT_8,
        course_code: CRS_B_101,
        enrolments: NOT_ENROLLED,
    },
    // suotar-import-outcomes
    LaneCompletion {
        student: &CREDIT_REGISTRATION_STUDENT_3,
        course_code: CRS_101,
        enrolments: NOT_ENROLLED,
    },
    LaneCompletion {
        student: &CREDIT_REGISTRATION_STUDENT_3,
        course_code: CRS_B_101,
        enrolments: NOT_ENROLLED,
    },
    LaneCompletion {
        student: &CREDIT_REGISTRATION_STUDENT_4,
        course_code: CRS_101,
        enrolments: NOT_ENROLLED,
    },
    LaneCompletion {
        student: &CREDIT_REGISTRATION_STUDENT_5,
        course_code: CRS_101,
        enrolments: NOT_ENROLLED,
    },
    // suotar-verify-outcomes
    LaneCompletion {
        student: &STUDENT_6,
        course_code: CRS_B_101,
        enrolments: DEGREE,
    },
    LaneCompletion {
        student: &CREDIT_REGISTRATION_STUDENT_1,
        course_code: CRS_B_101,
        enrolments: DEGREE,
    },
    LaneCompletion {
        student: &CREDIT_REGISTRATION_STUDENT_2,
        course_code: CRS_B_101,
        enrolments: DEGREE,
    },
    // suotar-sisu-outage
    LaneCompletion {
        student: &CREDIT_REGISTRATION_STUDENT_4,
        course_code: CRS_B_101,
        enrolments: NOT_ENROLLED,
    },
];

/// Mailed to the cap, never claimed, no account: the stale-address population is the only place the
/// resend and manual-link actions render.
pub const ADMIN_STALE: MockPersonFixture = MockPersonFixture {
    student_number: "900000903",
    first_names: "Zzyzx",
    last_name: "Deadaddress",
    sisu_email: "zzyzx.deadaddress@helsinki.example",
    account_email: None,
};
/// A second capped person on `ADMIN_STALE`'s course, owned by the teacher specs so a cap-refused
/// resend cannot race whichever spec is overriding the cap.
pub const TEACHER_RESEND_CAPPED: MockPersonFixture = MockPersonFixture {
    student_number: "900000804",
    first_names: "Zzyzx",
    last_name: "Cappedmail",
    sisu_email: "zzyzx.cappedmail@helsinki.example",
    account_email: None,
};

/// Three distinct addresses out of one Sisu address: the dedup key is the address and the cap is
/// three mails per person and course.
pub const MAILED_ADDRESS_SUFFIXES: [&str; 3] = ["", "old.", "older."];

/// Claims the seeded linking tokens, and holds no student number of its own: the tokens are unbound
/// and bind to whoever opens the link.
pub const LINK_CLAIMER_EMAIL: &str = "credit-registration-link-claimer@example.com";
pub const LINK_VALID: MockPersonFixture = MockPersonFixture {
    student_number: "900000201",
    first_names: "Zzyzx",
    last_name: "Linkvalid",
    sisu_email: "zzyzx.linkvalid@helsinki.example",
    account_email: None,
};
pub const LINK_EXPIRED: MockPersonFixture = MockPersonFixture {
    student_number: "900000202",
    first_names: "Zzyzx",
    last_name: "Linkexpired",
    sisu_email: "zzyzx.linkexpired@helsinki.example",
    account_email: None,
};
pub const LINK_USED: MockPersonFixture = MockPersonFixture {
    student_number: "900000203",
    first_names: "Zzyzx",
    last_name: "Linkused",
    sisu_email: "zzyzx.linkused@helsinki.example",
    account_email: None,
};
/// The world the mock Suotar serves, built from the same fixtures the database rows are.
///
/// Pure and pool-free on purpose: the restore-from-template setup path runs no seed and has the mock
/// install this lazily instead, so both setup scripts hand the suite the same fixtures.
pub fn mock_suotar_world() -> WorldPush {
    let now = Utc::now();
    let wide = DatePeriod {
        start_date: (now - Duration::days(730)).date_naive(),
        end_date: Some((now + Duration::days(730)).date_naive()),
    };
    let degree = |fixture: &MockPersonFixture, course_code: &str| {
        enrolment(
            fixture,
            course_code,
            RealisationKind::Degree,
            wide.clone(),
            now,
        )
    };

    let seeded_students = [
        &STUDENT_6,
        &STUDENT_7,
        &STUDENT_8,
        &CREDIT_REGISTRATION_STUDENT_1,
        &CREDIT_REGISTRATION_STUDENT_2,
        &CREDIT_REGISTRATION_STUDENT_3,
        &CREDIT_REGISTRATION_STUDENT_4,
        &CREDIT_REGISTRATION_STUDENT_5,
    ];
    let link_token_people = [&LINK_VALID, &LINK_EXPIRED, &LINK_USED];
    let admin_roster = [
        &CREDIT_REGISTRATION_STUDENT_1,
        &ADMIN_STALE,
        &TEACHER_RESEND_CAPPED,
    ];

    let mut persons: Vec<PersonUpsert> = seeded_students
        .iter()
        .chain(&link_token_people)
        .map(|fixture| person(fixture))
        .collect();
    for fixture in [&ADMIN_STALE, &TEACHER_RESEND_CAPPED] {
        persons.push(PersonUpsert {
            // Sisu's live address must differ from the mailed history, or a resend hits the dedup
            // guard (already mailed this address) before it ever reaches the cap it exists to
            // demonstrate.
            primary_email: Some(format!("current.{}", fixture.sisu_email)),
            ..person(fixture)
        });
    }

    let mut enrolments: Vec<EnrolmentUpsert> = LANE_COMPLETIONS
        .iter()
        .flat_map(|lane| {
            lane.enrolments
                .iter()
                .map(|kind| enrolment(lane.student, lane.course_code, *kind, wide.clone(), now))
        })
        .collect();
    // The replaced attempt pair `suotar-student-profile.spec.ts` reads.
    enrolments.push(degree(&STUDENT_6, CRS_101));
    enrolments.extend(link_token_people.iter().map(|f| degree(f, CRS_101)));
    enrolments.extend(admin_roster.iter().map(|f| degree(f, CRS_ADMIN_101)));
    enrolments.extend(
        IMPORT_OUTCOME_COURSE_CODES
            .iter()
            .map(|course_code| degree(&STUDENT_8, course_code)),
    );
    enrolments.push(degree(&CREDIT_REGISTRATION_STUDENT_2, CRS_GRADED_101));

    let import_outcomes = [
        CourseUnitShape {
            carried_by_suotar: false,
            ..CourseUnitShape::new(CRS_IMPORT_101, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
        CourseUnitShape {
            credits: Some(CreditRange {
                min: 5.0,
                max: None,
            }),
            ..CourseUnitShape::new(CRS_IMPORT_102, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
        // Sisu refuses the send; the realisation with no end date is a shape the client must read.
        CourseUnitShape {
            is_open_ended: true,
            ..CourseUnitShape::new(CRS_IMPORT_103, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
        // Graded on 0–5 in Sisu while the module registers pass/fail.
        CourseUnitShape {
            grade_scale_id: "sis-0-5",
            ..CourseUnitShape::new(CRS_IMPORT_104, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
    ];
    let both_kinds = &[RealisationKind::Degree, RealisationKind::OpenUniversity];

    let mut course_units = vec![
        CourseUnitShape {
            kinds: both_kinds,
            ..CourseUnitShape::new(CRS_101, SUOTAR_COURSE_SLUG, 5.0)
        }
        .build(&wide),
        CourseUnitShape {
            kinds: both_kinds,
            ..CourseUnitShape::new(CRS_B_101, SUOTAR_B_COURSE_SLUG, 5.0)
        }
        .build(&wide),
        CourseUnitShape {
            kinds: &[RealisationKind::OpenUniversity],
            ..CourseUnitShape::new(CRS_OLD_101, OLD_FLOW_COURSE_SLUG, 5.0)
        }
        .build(&wide),
        CourseUnitShape {
            kinds: both_kinds,
            ..CourseUnitShape::new(CRS_ADMIN_101, ADMIN_COURSE_SLUG, 5.0)
        }
        .build(&wide),
        CourseUnitShape::new(CRS_RETRY_101, RETRY_COURSE_SLUG, 5.0).build(&wide),
        // Every other module is pass/fail, so grade improvement needs a graded one.
        CourseUnitShape {
            grade_scale_id: "sis-0-5",
            ..CourseUnitShape::new(CRS_GRADED_101, GRADE_IMPROVEMENT_COURSE_SLUG, 5.0)
        }
        .build(&wide),
    ];
    course_units.extend(STATES_COURSE_CODES.iter().map(|course_code| {
        CourseUnitShape::new(course_code, STATES_COURSE_SLUG, 5.0).build(&wide)
    }));
    course_units.extend(import_outcomes.into_iter().map(|shape| shape.build(&wide)));

    WorldPush {
        defaults: Some(WorldDefaults::default()),
        persons,
        course_units,
        enrolments,
        attainments: Vec::new(),
        submissions: Vec::new(),
        sisu_violations: vec![SisuViolationsUpsert {
            student_number: STUDENT_8.student_number.to_string(),
            course_code: CRS_IMPORT_103.to_string(),
            violations: vec![
                "Student must have an active study right on attainment date or on credit transfer date.".to_string(),
            ],
        }],
    }
}

fn person(fixture: &MockPersonFixture) -> PersonUpsert {
    PersonUpsert {
        student_number: fixture.student_number.to_string(),
        person_id: Some(fixture.sisu_person_id()),
        first_names: Some(fixture.first_names.to_string()),
        last_name: Some(fixture.last_name.to_string()),
        primary_email: Some(fixture.sisu_email.to_string()),
        secondary_email: None,
        behaviour: PersonBehaviour::default(),
        owner_user_email: fixture.account_email.map(str::to_string),
    }
}

fn enrolment(
    fixture: &MockPersonFixture,
    course_code: &str,
    kind: RealisationKind,
    validity: DatePeriod,
    enrolled_at: DateTime<Utc>,
) -> EnrolmentUpsert {
    EnrolmentUpsert {
        id: None,
        student_number: fixture.student_number.to_string(),
        course_code: course_code.to_string(),
        realisation_id: None,
        kind,
        state: EnrolmentState::Enrolled,
        study_right_id: None,
        study_right_validity_period: Some(validity),
        study_right_grant_date: None,
        enrolment_date_time: Some(Some(enrolled_at)),
    }
}

/// What the mock's course unit for one module looks like. The defaults are the working shape; the
/// import-outcomes modules each break exactly one of them.
struct CourseUnitShape<'a> {
    course_code: &'a str,
    course_slug: &'a str,
    ects: f64,
    kinds: &'a [RealisationKind],
    grade_scale_id: &'a str,
    credits: Option<CreditRange>,
    carried_by_suotar: bool,
    /// The realisations' activity periods have no end date.
    is_open_ended: bool,
}

impl<'a> CourseUnitShape<'a> {
    fn new(course_code: &'a str, course_slug: &'a str, ects: f64) -> Self {
        Self {
            course_code,
            course_slug,
            ects,
            kinds: &[RealisationKind::Degree],
            grade_scale_id: "sis-hyl-hyv",
            credits: None,
            carried_by_suotar: true,
            is_open_ended: false,
        }
    }

    fn build(self, activity_period: &DatePeriod) -> CourseUnitUpsert {
        let name = LocalizedName {
            fi: self.course_code.to_string(),
            sv: self.course_code.to_string(),
            en: self.course_code.to_string(),
        };
        CourseUnitUpsert {
            course_code: self.course_code.to_string(),
            course_unit_id: None,
            name: Some(name),
            credits: Some(self.credits.unwrap_or(CreditRange {
                min: self.ects,
                max: Some(self.ects),
            })),
            grade_scale_id: Some(self.grade_scale_id.to_string()),
            realisations: self
                .kinds
                .iter()
                .map(|kind| RealisationUpsert {
                    id: None,
                    name: None,
                    assessment_item_id: None,
                    kind: *kind,
                    activity_period: Some(DatePeriod {
                        end_date: activity_period.end_date.filter(|_| !self.is_open_ended),
                        ..activity_period.clone()
                    }),
                    grade_scale_id: None,
                })
                .collect(),
            suotar_course: self.carried_by_suotar.then(|| SuotarCourse {
                name: self.course_code.to_string(),
            }),
            behaviour: CourseBehaviour::default(),
            owner_course_slug: Some(self.course_slug.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A world that does not hang together surfaces as confusing Playwright failures elsewhere.
    #[test]
    fn the_pushed_world_is_internally_consistent() {
        let world = mock_suotar_world();
        let scales = world
            .defaults
            .as_ref()
            .map(|defaults| defaults.grade_scales.clone())
            .unwrap_or_default();

        for unit in &world.course_units {
            if let Some(scale_id) = &unit.grade_scale_id {
                assert!(
                    scales.iter().any(|scale| &scale.id == scale_id),
                    "{} names an unknown grade scale {scale_id}",
                    unit.course_code
                );
            }
        }

        for enrolment in &world.enrolments {
            assert!(
                world
                    .persons
                    .iter()
                    .any(|person| person.student_number == enrolment.student_number),
                "enrolment for an unpushed person {}",
                enrolment.student_number
            );
            let unit = world
                .course_units
                .iter()
                .find(|unit| unit.course_code == enrolment.course_code)
                .unwrap_or_else(|| {
                    panic!("enrolment on an unpushed course {}", enrolment.course_code)
                });
            assert!(
                unit.realisations
                    .iter()
                    .any(|realisation| realisation.kind == enrolment.kind),
                "{} has no {:?} realisation for {} to enrol on",
                unit.course_code,
                enrolment.kind,
                enrolment.student_number
            );
        }
    }
}
