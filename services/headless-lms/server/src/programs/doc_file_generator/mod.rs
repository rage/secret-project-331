/*! The doc file generator is used to write example JSON and TypeScript definitions for the docs of return values of API endpoints.

This is done by writing .json and .ts files that can be discovered by the #[generated_doc] attribute macro that is used by API endpoints.

To make this process more convenient, two macros are provided:
- example! (proc macro defined in the doc_macros crate)
- doc! (declarative macro defined in this file)

## example!
Accepts a struct or enum literal, such as
```no_run
# use headless_lms_server::doc;
# use headless_lms_server::programs::doc_file_generator::example::Example;
# use doc_macro::example;
# struct SomeStruct { first_field: u32, second_field: u32 }
example!(SomeStruct {
    first_field,
    second_field: 1234,
});
```
and implements the Example trait for the given type:
```
# use headless_lms_server::programs::doc_file_generator::example::Example;
# struct SomeStruct { first_field: u32, second_field: u32 }
impl Example for SomeStruct {
    fn example() -> Self {
        Self {
            first_field: Example::example(),
            second_field: 1234,
        }
    }
}
```
As can be seen in the code above, you can leave out the value of any field to use its Example implementation.

The Example trait is used for the doc! macro as explained below.

## doc!
Writes the JSON and TypeScript files used for API endpoint docs.

This macro can be used in two primary ways:
- With a struct/enum literal
- With a type and expression

With a struct/enum literal, the doc! macro generates an Example implementation for the type using the example! macro
and then uses it to write the JSON docs. (The TypeScript definition is generated with the `ts_rs::TS` trait)
```no_run
# use headless_lms_server::doc;
# use headless_lms_server::programs::doc_file_generator::example::Example;
# #[derive(serde::Serialize)]
# struct SomeStruct { first_field: u32, second_field: u32 }
doc!(SomeStruct {
    first_field,
    second_field: 1234,
});
```
In addition to the `impl Example for SomeStruct`, it will serialize `<SomeStruct as Example>::example()` to JSON and write it to generated-docs/SomeStruct.json,
as well as `<SomeStruct as TS>::inline()` to generated-docs/SomeStruct.ts.

Note that because it uses the example! macro, you can leave out values for fields the same way.

The struct/enum literal can be prepended with T, Option, or Vec, in order to generate docs for the given type (T), Option of the given type (Opt), or Vec of the given type (Vec).
Note that they must be in the order T, Option, Vec, though you can leave any (or all) of them out.

For example,
```no_run
# use headless_lms_server::doc;
# use headless_lms_server::programs::doc_file_generator::example::Example;
# #[derive(serde::Serialize)]
# struct SomeStruct { first_field: u32, second_field: u32 }
doc!(
    T,
    Vec,
    SomeStruct {
        first_field,
        second_field: 1234,
    }
);
```
will create docs for `SomeStruct` and `Vec<SomeStruct>`.

With a type and expression, the doc! macro simply uses the expression to write the JSON docs for the given type without involving the Example trait or example! macro.
```no_run
# use headless_lms_server::doc;
# use headless_lms_server::programs::doc_file_generator::example::Example;
# #[derive(serde::Serialize)]
# struct SomeStruct { first_field: u32, second_field: u32 }
doc!(
    Vec<SomeStruct>,
    vec![
        SomeStruct {
            first_field: Example::example(),
            second_field: 2,
        },
        SomeStruct {
            first_field: 3,
            second_field: 4,
        },
    ]
);
```
Note that since this method doesn't use the example! macro, leaving out field values is an error. If we want to use the Example trait here, we need to explicitly call Example::example()
or the ex() function which is just a shortcut for Example::example().

This method is mainly useful for external/std types. For example, we cannot write Uuid as a struct literal because it has private fields, or bool because it's a primitive type.
*/

#![allow(clippy::redundant_clone)]
#![allow(unused_imports)]

pub mod example;

use chrono::{TimeZone, Utc};
use example::Example;
use headless_lms_models::{
    course_background_question_answers::CourseBackgroundQuestionAnswer,
    course_background_questions::{
        CourseBackgroundQuestion, CourseBackgroundQuestionType, CourseBackgroundQuestionsAndAnswers,
    },
    course_instance_enrollments::CourseInstanceEnrollmentsInfo,
    course_module_completions::{
        CourseModuleCompletion, CourseModuleCompletionWithRegistrationInfo,
        StudyRegistryCompletion, StudyRegistryGrade,
    },
    courses::CourseBreadcrumbInfo,
    exercise_task_submissions::PeerOrSelfReviewsReceived,
    exercises::ExerciseStatusSummaryForUser,
    library::global_stats::{GlobalCourseModuleStatEntry, GlobalStatEntry},
    page_audio_files::PageAudioFile,
    page_visit_datum_summary_by_courses::PageVisitDatumSummaryByCourse,
    page_visit_datum_summary_by_courses_countries::PageVisitDatumSummaryByCoursesCountries,
    page_visit_datum_summary_by_courses_device_types::PageVisitDatumSummaryByCourseDeviceTypes,
    page_visit_datum_summary_by_pages::PageVisitDatumSummaryByPages,
    peer_or_self_review_configs::CourseMaterialPeerOrSelfReviewConfig,
    peer_or_self_review_question_submissions::{
        PeerOrSelfReviewAnswer, PeerOrSelfReviewQuestionAndAnswer,
        PeerOrSelfReviewQuestionSubmission,
    },
    peer_or_self_review_submissions::PeerOrSelfReviewSubmission,
    peer_review_queue_entries::PeerReviewQueueEntry,
    proposed_block_edits::EditedBlockStillExistsData,
    research_forms::{ResearchForm, ResearchFormQuestion, ResearchFormQuestionAnswer},
    student_countries::StudentCountry,
    teacher_grading_decisions::{TeacherDecisionType, TeacherGradingDecision},
    user_details::UserDetail,
    user_research_consents::UserResearchConsent,
};
use serde::Serialize;
use serde_json::{json, ser::PrettyFormatter, Serializer, Value};
use std::{collections::HashMap, fs};
#[cfg(feature = "ts_rs")]
use ts_rs::TS;
use uuid::Uuid;

use crate::controllers::course_material::exercises::CourseMaterialPeerOrSelfReviewDataWithToken;

// Helper function to avoid typing out Example::example()
fn ex<T: Example>() -> T {
    Example::example()
}

#[macro_export]
macro_rules! doc_path {
    ($filename:expr, $extension:expr) => {{
        let windows_safe_filename = $filename
            .replace('<', "(")
            .replace('>', ")")
            .replace(" ", "");

        let mut s = String::new();
        s.push_str(env!("CARGO_MANIFEST_DIR"));
        s.push_str("/generated-docs/");
        s.push_str(windows_safe_filename.as_str());
        s.push_str($extension);
        s
    }};
}

// Writes doc files. See the module documentation for more info.
// macro_export mainly for the docs that use it
#[macro_export]
macro_rules! doc {
    (T, Option, Vec, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner T, $($t)*);
        doc!(@inner Option, $($t)*);
        doc!(@inner Vec, $($t)*);
    };
    (Option, Vec, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner Option, $($t)*);
        doc!(@inner Vec, $($t)*);
    };
    (T, Option, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner T, $($t)*);
        doc!(@inner Option, $($t)*);
    };
    (T, Vec, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner T, $($t)*);
        doc!(@inner Vec, $($t)*);
    };
    (T, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner T, $($t)*);
    };
    (Option, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner Option, $($t)*);
    };
    (Vec, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner Vec, $($t)*);
    };
    // enum literal
    (@inner T, $i:ident :: $($t:tt)*) => {
        doc!($i, Example::example());
    };
    (@inner Option, $i:ident :: $($t:tt)*) => {
        doc!(Option<$i>, Example::example());
    };
    (@inner Vec, $i:ident :: $($t:tt)*) => {
        doc!(Vec<$i>, Example::example());
    };
    // struct literal
    (@inner T, $i:ident $($t:tt)*) => {
        doc!($i, Example::example());
    };
    (@inner Option, $i:ident $($t:tt)*) => {
        doc!(Option<$i>, Example::example());
    };
    (@inner Vec, $i:ident $($t:tt)*) => {
        doc!(Vec<$i>, Example::example());
    };
    // writes the actual docs
    ($t:ty, $e:expr) => {{
        let expr: $t = $e;

        let json_path = $crate::doc_path!(
            stringify!($t),
            ".json"
        );
        $crate::programs::doc_file_generator::write_json(&json_path, expr);

        #[cfg(feature = "ts_rs")]
        {
            let ts_path = $crate::doc_path!(
                stringify!($t),
                ".ts"
            );

            $crate::programs::doc_file_generator::write_ts::<$t>(&ts_path, stringify!($t));
        }
    }};
    // shortcut for doc!(T, ...)
    ($($t:tt)*) => {
        doc!(T, $($t)*);
    };
}

pub async fn main() -> anyhow::Result<()> {
    // clear previous results
    fs::read_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/generated-docs/"))
        .unwrap()
        .filter_map(|file| {
            file.ok().filter(|f| {
                f.file_name()
                    .to_str()
                    .map_or(false, |n| n.ends_with(".json") || n.ends_with(".ts"))
            })
        })
        .for_each(|f| fs::remove_file(f.path()).unwrap());

    // write docs
    controllers();

    external();

    doc!((), ex());
    doc!(i64, 123);
    doc!(bool, ex());
    doc!(
        Vec<bool>,
        vec![false, true, false, true, false, true, true, true]
    );
    doc!(String, ex());
    doc!(Uuid, ex());
    doc!(Vec<Uuid>, ex());

    Ok(())
}

pub fn write_json<T: Serialize>(path: &str, value: T) {
    let mut file = std::fs::File::create(path).unwrap();
    let formatter = PrettyFormatter::with_indent(b"    ");
    let mut serializer = Serializer::with_formatter(&mut file, formatter);
    serde::Serialize::serialize(&value, &mut serializer).unwrap();
}

#[cfg(feature = "ts_rs")]
pub fn write_ts<T: TS>(path: &str, type_name: &str) {
    let contents = format!("type {} = {}", type_name, T::inline());
    std::fs::write(path, contents).unwrap();
}

#[allow(non_local_definitions)]
fn controllers() {
    doc!(
        T,
        Vec,
        StudyRegistryCompletion {
            completion_date: Utc.with_ymd_and_hms(2022, 6, 21, 0, 0, 0).unwrap(),
            completion_language: "en-US".to_string(),
            completion_registration_attempt_date: None,
            email: "student@example.com".to_string(),
            grade: StudyRegistryGrade::new(true, Some(4)),
            id: Uuid::parse_str("633852ce-c82a-4d60-8ab5-28745163f6f9").unwrap(),
            user_id,
            tier: None
        }
    );
}

// external types, there should only be a couple in here so no macros or other fancy stuff
fn external() {
    std::fs::write(doc_path!("Bytes", ".ts"), "type Bytes = Blob").unwrap();
}
