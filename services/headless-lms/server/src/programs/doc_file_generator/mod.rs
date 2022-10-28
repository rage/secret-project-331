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

The struct/enum literal can be prepended with T, Opt, or Vec, in order to generate docs for the given type (T), Option of the given type (Opt), or Vec of the given type (Vec).
Note that they must be in the order T, Opt, Vec, though you can leave any (or all) of them out.

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
will create docs for SomeStruct and Vec<SomeStruct>.

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
    course_module_completions::CourseModuleCompletionWithRegistrationInfo,
    exercise_task_submissions::PeerReviewsRecieved,
    peer_review_configs::CourseMaterialPeerReviewConfig,
    peer_review_question_submissions::PeerReviewQuestionSubmission,
};
use serde::Serialize;
use serde_json::{json, ser::PrettyFormatter, Serializer, Value};
use std::{collections::HashMap, fs};
#[cfg(feature = "ts_rs")]
use ts_rs::TS;
use uuid::Uuid;

// Helper function to avoid typing out Example::example()
fn ex<T: Example>() -> T {
    Example::example()
}

// Writes doc files. See the module documentation for more info.
#[macro_export]
macro_rules! doc {
    (T, Opt, Vec, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner T, $($t)*);
        doc!(@inner Opt, $($t)*);
        doc!(@inner Vec, $($t)*);
    };
    (Opt, Vec, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner Opt, $($t)*);
        doc!(@inner Vec, $($t)*);
    };
    (T, Opt, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner T, $($t)*);
        doc!(@inner Opt, $($t)*);
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
    (Opt, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner Opt, $($t)*);
    };
    (Vec, $($t:tt)*) => {
        ::doc_macro::example!($($t)*);
        doc!(@inner Vec, $($t)*);
    };
    // enum literal
    (@inner T, $i:ident :: $($t:tt)*) => {
        doc!($i, Example::example());
    };
    (@inner Opt, $i:ident :: $($t:tt)*) => {
        doc!(Option<$i>, Example::example());
    };
    (@inner Vec, $i:ident :: $($t:tt)*) => {
        doc!(Vec<$i>, Example::example());
    };
    // struct literal
    (@inner T, $i:ident $($t:tt)*) => {
        doc!($i, Example::example());
    };
    (@inner Opt, $i:ident $($t:tt)*) => {
        doc!(Option<$i>, Example::example());
    };
    (@inner Vec, $i:ident $($t:tt)*) => {
        doc!(Vec<$i>, Example::example());
    };
    // writes the actual docs
    ($t:ty, $e:expr) => {{
        let expr: $t = $e;

        let json_path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/generated-docs/",
            stringify!($t),
            ".json"
        );
        $crate::programs::doc_file_generator::write_json(json_path, expr);

        #[cfg(feature = "ts_rs")]
        {
            let ts_path = concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/generated-docs/",
                stringify!($t),
                ".ts"
            );

            $crate::programs::doc_file_generator::write_ts::<$t>(ts_path, stringify!($t));
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
    models();
    utils();

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

fn controllers() {
    use crate::controllers::{
        auth::UserInfo,
        course_material::{
            courses::{ChaptersWithStatus, CourseMaterialCourseModule},
            exams::{ExamData, ExamEnrollmentData},
        },
        main_frontend::exercises::{
            AnswerRequiringAttentionWithTasks, AnswersRequiringAttention, ExerciseSubmissions,
        },
        UploadResult,
    };

    example!(CourseMaterialCourseModule {
        chapters,
        id,
        is_default: true,
        name: None,
        order_number: 0
    });
    example!(AnswerRequiringAttentionWithTasks {
        id,
        user_id: Uuid::parse_str("7115806b-07c4-4079-8444-6dd248d3b9e7").unwrap(),
        created_at,
        updated_at,
        deleted_at: None,
        data_json: Some(serde_json::json! {{"choice": "a"}}),
        grading_progress,
        score_given: Some(0.0),
        submission_id: Uuid::parse_str("e2560477-0680-4573-abec-646440e294da").unwrap(),
        exercise_id: Uuid::parse_str("7f57619a-ad00-4116-958d-5d597437e6fb").unwrap(),
        tasks,
    });

    doc!(UploadResult {
        url: "http://project-331.local/api/v0/files/courses/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/iHZMHdvsazy43ZtP0Ea01sy8AOpUiZ.png".to_string()
    });
    doc!(ExamData {
        id,
        name: "Course exam".to_string(),
        instructions: serde_json::json!([]),
        starts_at,
        ends_at,
        ended: false,
        time_minutes: 120,
        enrollment_data: ExamEnrollmentData::NotEnrolled
    });
    doc!(ExerciseSubmissions {
        data,
        total_pages: 1
    });
    doc!(ChaptersWithStatus {
        is_previewable: false,
        modules,
    });
    doc!(
        Opt,
        UserInfo {
            user_id: Uuid::parse_str("cebcb32b-aa7e-40ad-bc79-9d5c534a8a5a").unwrap()
        }
    );
    doc!(AnswersRequiringAttention {
        exercise_max_points: 1,
        data,
        total_pages: 10,
    });
}

fn models() {
    use headless_lms_models::{
        chapters::{
            Chapter, ChapterStatus, ChapterWithStatus, DatabaseChapter,
            UserCourseInstanceChapterProgress,
        },
        course_instance_enrollments::CourseInstanceEnrollment,
        course_instances::{ChapterScore, CourseInstance, Points},
        course_module_completions::{StudyRegistryCompletion, StudyRegistryGrade},
        course_modules::CourseModule,
        courses::{Course, CourseCount, CourseStructure},
        email_templates::EmailTemplate,
        exams::{CourseExam, Exam, ExamEnrollment, ExamInstructions, OrgExam},
        exercise_repositories::{ExerciseRepository, ExerciseRepositoryStatus},
        exercise_services::{ExerciseService, ExerciseServiceIframeRenderingInfo},
        exercise_slide_submissions::{
            ExerciseAnswersInCourseRequiringAttentionCount, ExerciseSlideSubmission,
            ExerciseSlideSubmissionCount, ExerciseSlideSubmissionCountByExercise,
            ExerciseSlideSubmissionCountByWeekAndHour, ExerciseSlideSubmissionInfo,
        },
        exercise_slides::CourseMaterialExerciseSlide,
        exercise_task_gradings::{ExerciseTaskGrading, UserPointsUpdateStrategy},
        exercise_task_submissions::ExerciseTaskSubmission,
        exercise_tasks::CourseMaterialExerciseTask,
        exercises::{
            ActivityProgress, CourseMaterialExercise, Exercise, ExerciseStatus, GradingProgress,
        },
        feedback::{Feedback, FeedbackBlock, FeedbackCount},
        glossary::Term,
        library::{
            grading::{StudentExerciseSlideSubmissionResult, StudentExerciseTaskSubmissionResult},
            peer_reviewing::{
                CourseMaterialPeerReviewData, CourseMaterialPeerReviewDataAnswerToReview,
                CourseMaterialPeerReviewQuestionAnswer, CourseMaterialPeerReviewSubmission,
            },
            progressing::{
                CompletionRegistrationLink, CourseInstanceCompletionSummary,
                UserCompletionInformation, UserCourseModuleCompletion, UserModuleCompletionStatus,
                UserWithModuleCompletions,
            },
        },
        material_references::{MaterialReference, NewMaterialReference},
        organizations::Organization,
        page_history::{HistoryChangeReason, PageHistory},
        pages::{
            CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask, ContentManagementPage,
            CoursePageWithUserData, IsChapterFrontPage, Page, PageChapterAndCourseInformation,
            PageInfo, PageNavigationInformation, PageRoutingData, PageSearchResult,
            PageWithExercises,
        },
        peer_review_configs::{
            CmsPeerReviewConfig, CmsPeerReviewConfiguration, PeerReviewAcceptingStrategy,
            PeerReviewConfig,
        },
        peer_review_questions::{
            CmsPeerReviewQuestion, PeerReviewQuestion, PeerReviewQuestionType,
        },
        pending_roles::PendingRole,
        playground_examples::PlaygroundExample,
        proposed_block_edits::{BlockProposal, ProposalStatus},
        proposed_page_edits::{PageProposal, ProposalCount},
        regradings::{Regrading, RegradingInfo, RegradingSubmissionInfo},
        repository_exercises::RepositoryExercise,
        roles::{RoleUser, UserRole},
        user_course_settings::UserCourseSettings,
        user_exercise_states::{
            ReviewingStage, UserCourseInstanceChapterExerciseProgress, UserCourseInstanceProgress,
            UserExerciseState,
        },
        users::User,
    };

    example!(ExerciseSlideSubmission {
        id,
        created_at,
        updated_at,
        deleted_at: None,
        course_id,
        course_instance_id,
        exam_id: None,
        exercise_id,
        user_id,
        exercise_slide_id,
        user_points_update_strategy: UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
    });
    example!(ExerciseTaskSubmission {
        id,
        created_at,
        updated_at,
        deleted_at: None,
        exercise_slide_submission_id,
        exercise_task_id,
        exercise_slide_id,
        data_json: Some(json!({"choice": "a"})),
        exercise_task_grading_id,
        metadata: None,
    });
    example!(GradingProgress::PendingManual);
    example!(ExerciseTaskGrading {
        id,
        created_at,
        updated_at,
        exercise_task_submission_id,
        course_id,
        exam_id: None,
        exercise_id,
        exercise_task_id,
        grading_priority: 1,
        score_given: Some(80.0),
        grading_progress,
        unscaled_score_given: Some(80.0),
        unscaled_score_maximum: Some(100),
        grading_started_at,
        grading_completed_at,
        feedback_json: None,
        feedback_text: None,
        deleted_at: None,
    });
    example!(CourseMaterialExerciseTask {
        id,
        exercise_service_slug: "example-exercise".to_string(),
        exercise_slide_id,
        exercise_iframe_url: Some("http://project-331.local/example-exercise/exercise".to_string()),
        assignment: serde_json::json! {{"name":"core/paragraph","isValid":true,"clientId":"187a0aea-c088-4354-a1ea-f0cab082c065","attributes":{"content":"Answer this question.","dropCap":false},"innerBlocks":[]}},
        public_spec: Some(
            serde_json::json! {[{"id":"7ab2591c-b0f3-4543-9548-a113849b0f94","name":"a"},{"id":"a833d1df-f27b-4fbf-b516-883a62c09d88","name":"b"},{"id":"03d4b3d4-88af-4125-88b7-4ee052fd876f","name":"c"}]},
        ),
        model_solution_spec: None,
        previous_submission,
        previous_submission_grading,
        order_number: 0,
        pseudonumous_user_id: Some(
            Uuid::parse_str("934ac548-f7de-479a-b4f8-af9c0c6c22dc").unwrap(),
        ),
    });
    example!(CmsPageExercise {
        id,
        name: "exercise".to_string(),
        order_number: 123,
        score_maximum: 1,
        max_tries_per_slide: Some(17),
        limit_number_of_tries: true,
        deadline: None,
        needs_peer_review: true,
        use_course_default_peer_review_config: true,
        peer_review_config: None,
        peer_review_questions: None
    });
    example!(CmsPageExerciseSlide {
        id,
        exercise_id,
        order_number: 123,
    });
    example!(CmsPageExerciseTask {
        id,
        exercise_slide_id,
        assignment: serde_json::json!({"options": ["a", "b", "c"]}),
        exercise_type: "quizzes".to_string(),
        private_spec: None,
        order_number: 1,
    });
    example!(CmsPeerReviewConfig {
        id,
        accepting_strategy: PeerReviewAcceptingStrategy::AutomaticallyAcceptOrManualReviewByAverage,
        accepting_threshold: 0.5,
        course_id,
        exercise_id: None,
        peer_reviews_to_give: 2,
        peer_reviews_to_receive: 1,
    });
    example!(CmsPeerReviewQuestion {
        id,
        answer_required: true,
        order_number: 1,
        peer_review_config_id,
        question: "what?".to_string(),
        question_type: PeerReviewQuestionType::Essay
    });
    example!(CourseMaterialExerciseSlide { id, exercise_tasks });
    example!(ExerciseStatus {
        score_given: None,
        activity_progress: ActivityProgress::InProgress,
        grading_progress: GradingProgress::NotReady,
        reviewing_stage: headless_lms_models::user_exercise_states::ReviewingStage::NotStarted
    });
    example!(CourseMaterialPeerReviewQuestionAnswer {
        peer_review_question_id,
        text_data: Some("I think that the answer was well written.".to_string()),
        number_data: None,
    });
    example!(ChapterScore {
        chapter,
        score_given: 1.0,
        score_total: 2
    });
    example!(DatabaseChapter {
        id,
        created_at,
        updated_at,
        deleted_at: None,
        name: "The Basics".to_string(),
        color: None,
        course_id,
        chapter_image_path: None,
        chapter_number: 1,
        front_page_id: None,
        opens_at,
        deadline,
        copied_from: None,
        course_module_id,
    });
    example!(CourseModule {
        id,
        created_at,
        updated_at,
        deleted_at: None,
        name: None,
        course_id,
        order_number: 0,
        copied_from: None,
        uh_course_code: None,
        automatic_completion: false,
        automatic_completion_number_of_exercises_attempted_treshold: None,
        automatic_completion_number_of_points_treshold: None,
        ects_credits: None,
        completion_registration_link_override: None,
    });
    example!(UserCourseModuleCompletion {
        course_module_id,
        grade: Some(4),
        passed: true,
    });
    example!(UserWithModuleCompletions {
        completed_modules,
        email: "student@example.com".to_string(),
        first_name: Some("Student".to_string()),
        last_name: Some("Student".to_string()),
        user_id,
    });
    example!(FeedbackBlock {
        id,
        text: None,
        order_number: Some(0)
    });
    example!(BlockProposal {
        id,
        block_id,
        original_text: "Hello,, world!".to_string(),
        current_text: "Hello,, world!".to_string(),
        changed_text: "Hello, world!".to_string(),
        status: ProposalStatus::Accepted,
        accept_preview: Some("Hello, world!!".to_string())
    });
    example!(ChapterWithStatus {
    id,
    created_at,
    updated_at,
      name: "The Basics".to_string(),
      color: None,
      course_id,
    deleted_at: None,
      chapter_number: 1,
      front_page_id: None,
      opens_at: None,
      status: ChapterStatus::Open,
      chapter_image_url: Some("http://project-331.local/api/v0/files/course/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5/images/ydy8IxX1dGMd9T2b27u7FL5VmH5X9U.jpg".to_string()),
  course_module_id,
  });
    example!(CourseMaterialPeerReviewDataAnswerToReview {
        course_material_exercise_tasks,
        exercise_slide_submission_id,
    });
    example!(RegradingSubmissionInfo {
        exercise_task_submission_id,
        grading_before_regrading,
        grading_after_regrading
    });
    example!(CourseMaterialPeerReviewConfig {
        course_id,
        exercise_id,
        id,
        peer_reviews_to_give: 3,
        peer_reviews_to_receive: 2
    });
    example!(PeerReviewQuestionSubmission {
        id,
        created_at,
        deleted_at,
        updated_at,
        peer_review_question_id,
        peer_review_submission_id,
        text_data: Some("I think that the answer was well written.".to_string()),
        number_data: None,
    });

    doc!(
        T,
        Vec,
        EmailTemplate {
            id,
            created_at,
            updated_at,
            deleted_at: None,
            content: Some(Value::String("content".to_string())),
            name: "name".to_string(),
            subject: Some("subject".to_string()),
            exercise_completions_threshold: Some(123),
            points_threshold: Some(123),
            course_instance_id,
        }
    );
    doc!(ContentManagementPage {
        page,
        exercises,
        exercise_slides,
        exercise_tasks,
        peer_review_configs,
        peer_review_questions,
        organization_id
    });
    doc!(PeerReviewConfig {
        id,
        created_at,
        updated_at,
        deleted_at: None,
        course_id,
        exercise_id,
        peer_reviews_to_give: 3,
        peer_reviews_to_receive: 2,
        accepting_threshold: 3.0,
        accepting_strategy: PeerReviewAcceptingStrategy::AutomaticallyAcceptOrManualReviewByAverage,
    });
    doc!(
        T,
        Vec,
        PeerReviewQuestion {
            id,
            created_at,
            updated_at,
            deleted_at: None,
            peer_review_config_id,
            order_number: 0,
            question: "Was the answer well thought out?".to_string(),
            question_type: PeerReviewQuestionType::Essay,
            answer_required: true,
        }
    );
    doc!(Vec, PageWithExercises { page, exercises });
    doc!(
        T,
        Vec,
        UserCourseInstanceProgress {
            course_module_id,
            course_module_name: "Module".to_string(),
            course_module_order_number: 0,
            score_given: 3.0,
            score_required: Some(7),
            score_maximum: Some(10),
            total_exercises: Some(66),
            attempted_exercises: Some(13),
            attempted_exercises_required: Some(40),
        }
    );
    doc!(UserCourseInstanceChapterProgress {
        score_given: 1.0,
        score_maximum: 4,
        total_exercises: Some(4),
        attempted_exercises: Some(2)
    });
    doc!(
        T,
        Vec,
        UserCourseInstanceChapterExerciseProgress {
            exercise_id,
            score_given: 1.0
        }
    );
    doc!(CourseInstanceEnrollment {
        user_id,
        course_id,
        course_instance_id,
        created_at,
        updated_at,
        deleted_at: None
    });
    doc!(
        T,
        Vec,
        Course {
            id,
            slug: "introduction-to-cs".to_string(),
            created_at,
            updated_at,
            name: "Introduction to Computer Science".to_string(),
            organization_id,
            deleted_at: None,
            language_code: "en-US".to_string(),
            copied_from: None,
            content_search_language: Some("simple".to_string()),
            course_language_group_id,
            description: Some("Example".to_string()),
            is_draft: true,
            is_test_mode: false,
            base_module_completion_requires_n_submodule_completions: 0,
        }
    );
    doc!(CoursePageWithUserData {
        page,
        instance,
        settings,
        was_redirected: false,
        is_test_mode: false
    });
    doc!(
        T,
        Opt,
        Vec,
        CourseInstance {
            id,
            created_at,
            updated_at,
            deleted_at: None,
            course_id,
            starts_at,
            ends_at: None,
            name: Some("Instance".to_string()),
            description: Some("Description".to_string()),
            teacher_in_charge_name: "Example Teacher".to_string(),
            teacher_in_charge_email: "example@email.com".to_string(),
            support_email: Some("example@email.com".to_string()),
        }
    );
    doc!(
        Opt,
        UserCourseSettings {
            user_id,
            course_language_group_id,
            created_at,
            updated_at,
            deleted_at: None,
            current_course_id,
            current_course_instance_id,
        }
    );
    doc!(
        Vec<PageSearchResult>,
        vec![
            PageSearchResult {
                id: ex(),
                title_headline: Some("Introduction to everything".to_string()),
                rank: Some(0.6079271),
                content_headline: None,
                url_path: "/chapter-1".to_string()
            },
            PageSearchResult {
                id: ex(),
                title_headline: Some("In the second chapter...".to_string()),
                rank: Some(0.24317084),
                content_headline: Some("<b>Everything</b> is a big topic".to_string()),
                url_path: "/chapter-2".to_string()
            }
        ]
    );
    doc!(
        Opt,
        ExamEnrollment {
            user_id,
            exam_id,
            started_at
        }
    );
    doc!(CourseMaterialExercise {
        exercise,
        can_post_submission: true,
        current_exercise_slide,
        exercise_status,
        exercise_slide_submission_counts: HashMap::from([
            (
                Uuid::parse_str("2794a98e-d594-40cf-949e-7cc011755a58").unwrap(),
                2_i64
            ),
            (
                Uuid::parse_str("7dea54af-3d38-4f7c-8969-ecb17b55ec02").unwrap(),
                4_i64
            )
        ]),
        peer_review_config,
        previous_exercise_slide_submission
    });
    doc!(CourseMaterialPeerReviewSubmission {
        exercise_slide_submission_id,
        peer_review_config_id,
        peer_review_question_answers,
    });
    doc!(
        T,
        Vec,
        StudentExerciseTaskSubmissionResult {
            submission,
            grading,
            model_solution_spec: None,
        }
    );
    doc!(StudentExerciseSlideSubmissionResult {
        exercise_task_submission_results,
        exercise_status,
    });
    doc!(Chapter {
        id,
        created_at,
        updated_at,
        deleted_at: None,
        name: "The Basics".to_string(),
        color: None,
        course_id,
        chapter_image_url: None,
        chapter_number: 1,
        front_page_id: None,
        opens_at,
        copied_from: None,
        deadline,
        course_module_id,
    });
    doc!(Points {
        chapter_points,
        user_chapter_points: HashMap::new(),
        users
    });
    doc!(CourseInstanceCompletionSummary {
        course_modules,
        users_with_course_module_completions
    });
    doc!(CourseStructure {
        chapters,
        course,
        pages,
        modules: vec![],
    });
    doc!(
        Vec,
        Exercise {
            id,
            created_at,
            updated_at,
            name: "Hello Exercise".to_string(),
            course_id,
            exam_id: None,
            page_id,
            chapter_id: None,
            deadline: None,
            deleted_at: None,
            score_maximum: 1,
            order_number: 123,
            copied_from: None,
            max_tries_per_slide: Some(17),
            limit_number_of_tries: true,
            needs_peer_review,
            use_course_default_peer_review_config,
        }
    );
    doc!(
        Vec,
        ExerciseSlideSubmissionCount {
            count: Some(123),
            date
        }
    );
    doc!(
        Vec,
        ExerciseSlideSubmissionCountByWeekAndHour {
            count: Some(123),
            hour: Some(2),
            isodow: Some(2)
        }
    );
    doc!(
        Vec,
        ExerciseSlideSubmissionCountByExercise {
            exercise_id,
            exercise_name: "Best exercise".to_string(),
            count: Some(123),
        }
    );
    doc!(
        Vec,
        Feedback {
            id,
            user_id,
            course_id,
            feedback_given: "Unclear".to_string(),
            selected_text: None,
            marked_as_read: false,
            created_at,
            blocks,
            page_id: Some(Uuid::parse_str("bba0eda6-882b-4a0f-ad91-b02de1de4770").unwrap()),
            page_title: "The title of the page".to_string(),
            page_url_path: "/path-to-page".to_string()
        }
    );
    doc!(FeedbackCount { read: 1, unread: 2 });
    doc!(Exam {
        id,
        name: "Course exam".to_string(),
        instructions: serde_json::json!([]),
        page_id,
        courses,
        starts_at,
        ends_at,
        time_minutes: 120
    });
    doc!(
        T,
        Vec,
        ExerciseService {
            id,
            created_at,
            updated_at,
            deleted_at: None,
            name: "Quizzes".to_string(),
            slug: "quizzes".to_string(),
            public_url: "http://example.com".to_string(),
            internal_url: None,
            max_reprocessing_submissions_at_once: 4,
        }
    );
    doc!(
        T,
        Vec,
        Organization {
            id,
            created_at,
            updated_at,
            deleted_at: None,
            slug: "hy-cs".to_string(),
            name: "University of Helsinki".to_string(),
            description: None,
            organization_image_url: None,
        }
    );
    doc!(
        Vec,
        CourseExam {
            id,
            course_id,
            course_name: "Example course".to_string(),
            name: "Course exam".to_string()
        }
    );
    doc!(
        Vec,
        OrgExam {
            id,
            organization_id,
            name: "Org exam".to_string(),
            instructions: Page::example().content,
            time_minutes: 120,
            starts_at,
            ends_at
        }
    );
    doc!(
        T,
        Opt,
        Vec,
        Page {
            id,
            created_at,
            updated_at,
            deleted_at: None,
            course_id,
            exam_id: None,
            chapter_id,
            url_path: "/part-1/hello-world".to_string(),
            title: "Hello world!".to_string(),
            content: serde_json::json!([
              {
                "name": "moocfi/pages-in-part",
                "isValid": true,
                "clientId": "c68f55ae-65c4-4e9b-aded-0b52e36e344a",
                "attributes": {
                  "hidden": false
                },
                "innerBlocks": []
              },
              {
                "name": "moocfi/exercises-in-part",
                "isValid": true,
                "clientId": "415ecc4c-a5c6-410e-a43f-c14b8ee910ea",
                "attributes": {
                  "hidden": false
                },
                "innerBlocks": []
              }
            ]),
            order_number: 123,
            copied_from: None,
        }
    );
    doc!(
        Vec,
        PageHistory {
            id,
            created_at,
            title: "Page title".to_string(),
            content: serde_json::json! {{}},
            history_change_reason: HistoryChangeReason::PageSaved,
            restored_from_id: None,
            author_user_id,
        }
    );
    doc!(
        T,
        Vec,
        PlaygroundExample {
            id,
            created_at,
            updated_at,
            deleted_at: None,
            name: "Example".to_string(),
            url: "http://example.com".to_string(),
            width: 123,
            data: serde_json::json! {{}},
        }
    );
    doc!(
        Vec,
        PageProposal {
            id,
            page_id,
            user_id,
            pending: false,
            created_at,
            block_proposals,
            page_title: "Page title".to_string(),
            page_url_path: "/path/to/page".to_string()
        }
    );
    doc!(ProposalCount {
        pending: 2,
        handled: 2
    });
    doc!(User {
        id,
        first_name: Some("User".to_string()),
        last_name: Some("Example".to_string()),
        created_at,
        updated_at,
        deleted_at: None,
        upstream_id: None,
        email: "email@example.com".to_string(),
    });
    doc!(CourseCount { count: 1234 });
    doc!(
        Vec,
        Term {
            id,
            term: "Term".to_string(),
            definition: "Definition".to_string()
        }
    );
    doc!(PageChapterAndCourseInformation {
        chapter_name: Some("Chapter 1".to_string()),
        chapter_number: Some(1),
        course_name: Some("Introduction to everything".to_string()),
        course_slug: Some("introduction-to-everything".to_string()),
        chapter_front_page_id: Some(
            Uuid::parse_str("307fa56f-9853-4f5c-afb9-a6736c232f32").unwrap()
        ),
        chapter_front_page_url_path: Some("/chapter-1".to_string()),
        organization_slug: "uh-cs".to_string()
    });
    doc!(ExamInstructions {
        id,
        instructions: Page::example().content
    });
    doc!(PageInfo {
        page_id,
        page_title: "The basics".to_string(),
        course_id,
        course_name: Some("Introduction to everything".to_string()),
        course_slug: Some("introduction-to-everything".to_string()),
        organization_slug: Some("uh-cs".to_string())
    });
    doc!(
        Vec,
        MaterialReference {
            id,
            course_id,
            citation_key: "NeuralNetworks2022".to_string(),
            reference: "bibtex reference".to_string(),
            created_at,
            updated_at,
            deleted_at: None
        }
    );
    doc!(NewMaterialReference {
        citation_key: "NeuralNetworks2022".to_string(),
        reference: "bibtex reference".to_string(),
    });
    doc!(ExerciseSlideSubmissionInfo {
        tasks,
        exercise,
        exercise_slide_submission,
    });
    doc!(IsChapterFrontPage {
        is_chapter_front_page: true
    });
    doc!(CourseMaterialPeerReviewData {
        peer_review_config,
        peer_review_questions,
        num_peer_reviews_given: 2,
        answer_to_review,
    });
    doc!(
        T,
        Vec,
        StudyRegistryCompletion {
            completion_date: Utc.ymd(2022, 6, 21).and_hms(0, 0, 0),
            completion_language: "en-US".to_string(),
            completion_registration_attempt_date: None,
            email: "student@example.com".to_string(),
            grade: StudyRegistryGrade::new(true, Some(4)),
            id: Uuid::parse_str("633852ce-c82a-4d60-8ab5-28745163f6f9").unwrap(),
            user_id,
            tier: None
        }
    );
    doc!(UserCompletionInformation {
        course_module_completion_id,
        course_name: "Course".to_string(),
        email: "student@example.com".to_string(),
        uh_course_code: "ABC123".to_string(),
        ects_credits: Some(5),
    });
    doc!(
        Vec<UserModuleCompletionStatus>,
        vec![
            UserModuleCompletionStatus {
                completed: false,
                default: true,
                module_id: Uuid::parse_str("299eba99-9aa2-4023-bd64-bd4b5d7578ba").unwrap(),
                name: "Course".to_string(),
                order_number: 0,
                prerequisite_modules_completed: false,
            },
            UserModuleCompletionStatus {
                completed: true,
                default: false,
                module_id: Uuid::parse_str("c6c89368-c05d-498f-a2e3-10d7c327752c").unwrap(),
                name: "Module".to_string(),
                order_number: 1,
                prerequisite_modules_completed: false,
            }
        ]
    );
    doc!(CompletionRegistrationLink {
        url: "https://www.example.com".to_string(),
    });
    doc!(PageNavigationInformation {
        chapter_front_page: Some(PageRoutingData {
            url_path: "/chapter-1".to_string(),
            title: "Chapter 1".to_string(),
            page_id: Uuid::parse_str("634d1116-4a00-4f97-988d-e2fd523ac43a").unwrap(),
            chapter_number: 1,
            chapter_id: Uuid::parse_str("22552232-c1b6-4067-9aae-e09221b63e8f").unwrap(),
            chapter_opens_at: None,
            chapter_front_page_id: Some(
                Uuid::parse_str("f8726e97-5ebe-4698-9163-7d6e2568ec7e").unwrap()
            ),
        }),
        next_page: Some(PageRoutingData {
            url_path: "/chapter-1/page-3".to_string(),
            title: "Page 3".to_string(),
            page_id: Uuid::parse_str("634d1116-4a00-4f97-988d-e2fd523ac43a").unwrap(),
            chapter_number: 1,
            chapter_id: Uuid::parse_str("22552232-c1b6-4067-9aae-e09221b63e8f").unwrap(),
            chapter_opens_at: None,
            chapter_front_page_id: Some(
                Uuid::parse_str("f8726e97-5ebe-4698-9163-7d6e2568ec7e").unwrap()
            ),
        }),
        previous_page: Some(PageRoutingData {
            url_path: "/chapter-1/page-1".to_string(),
            title: "Page 1".to_string(),
            page_id: Uuid::parse_str("25d1932b-ad97-4461-8280-412fe8b75ca2").unwrap(),
            chapter_number: 1,
            chapter_id: Uuid::parse_str("22552232-c1b6-4067-9aae-e09221b63e8f").unwrap(),
            chapter_opens_at: None,
            chapter_front_page_id: Some(
                Uuid::parse_str("f8726e97-5ebe-4698-9163-7d6e2568ec7e").unwrap()
            ),
        }),
    });
    doc!(UserExerciseState {
        id,
        user_id: Uuid::parse_str("e9386872-d5f4-4120-a8df-6024c0f9714a").unwrap(),
        exercise_id: Uuid::parse_str("2d798a55-8786-411b-8061-8352c4be2143").unwrap(),
        course_instance_id: Some(Uuid::parse_str("7490d7a3-86df-4bfa-8991-751dd1d5128c").unwrap()),
        exam_id: None,
        created_at,
        updated_at,
        deleted_at: None,
        score_given: Some(1.0),
        grading_progress,
        activity_progress: ActivityProgress::Completed,
        reviewing_stage: ReviewingStage::ReviewedAndLocked,
        selected_exercise_slide_id: Some(
            Uuid::parse_str("b1355811-b233-45f1-87cc-038c9dea927d").unwrap()
        ),
    });
    doc!(
        Vec<ExerciseAnswersInCourseRequiringAttentionCount>,
        vec![
            ExerciseAnswersInCourseRequiringAttentionCount {
                id: ex(),
                name: "Exercise 1".to_string(),
                page_id: Uuid::parse_str("cdffbf4f-00dc-4538-b382-5c9acdf7f7af").unwrap(),
                chapter_id: Some(Uuid::parse_str("05d2518b-aa07-44ee-a6c4-bab0b0ecf4c8").unwrap()),
                order_number: 1,
                count: Some(5)
            },
            ExerciseAnswersInCourseRequiringAttentionCount {
                id: ex(),
                name: "Exercise 2".to_string(),
                page_id: Uuid::parse_str("edf6dbcf-d6c2-43ce-9724-adc81e24e8df").unwrap(),
                chapter_id: Some(Uuid::parse_str("b4d13b83-6366-4daf-b9b1-eb6b8792df0c").unwrap()),
                order_number: 2,
                count: Some(10)
            }
        ]
    );
    doc!(
        Vec,
        ExerciseServiceIframeRenderingInfo {
            id,
            name: "Example exercise".to_string(),
            slug: "example-exercise".to_string(),
            public_iframe_url: "https://example.com/iframe".to_string()
        }
    );
    doc!(CmsPeerReviewConfiguration {
        peer_review_config,
        peer_review_questions,
    });
    doc!(
        Vec,
        ExerciseRepository {
            id,
            url: "https://github.com/testmycode/tmc-testcourse".to_string(),
            course_id,
            exam_id: None,
            status: ExerciseRepositoryStatus::Success,
            error_message: None,
        }
    );
    doc!(
        Vec,
        RepositoryExercise {
            id,
            repository_id,
            part: "part01".to_string(),
            name: "exercise01".to_string(),
            repository_url: "https://github.com/testmycode/tmc-testcourse".to_string(),
            checksum: vec![0, 1, 2, 3],
            download_url: "direct-download-link".to_string(),
        }
    );
    doc!(
        Vec,
        Regrading {
            id,
            created_at,
            updated_at,
            regrading_started_at,
            regrading_completed_at,
            total_grading_progress: GradingProgress::FullyGraded,
            user_points_update_strategy: UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
            user_id
        }
    );
    doc!(RegradingInfo {
        regrading,
        submission_infos,
    });
    doc!(
        Vec,
        RoleUser {
            id,
            first_name: Some("Example".to_string()),
            last_name: Some("User".to_string()),
            email: "example@example.com".to_string(),
            role: UserRole::MaterialViewer
        }
    );
    doc!(
        Vec,
        PendingRole {
            id,
            user_email: "example@example.com".to_string(),
            role: UserRole::MaterialViewer,
            expires_at,
        }
    );
    doc!(CourseModuleCompletionWithRegistrationInfo {
        completion_registration_attempt_date: None,
        course_module_id,
        created_at,
        grade: Some(4),
        passed: true,
        prerequisite_modules_completed: true,
        registered: false,
        user_id,
    });
    doc!(PeerReviewsRecieved {
        peer_review_question_submissions,
        peer_review_questions
    });
}

fn utils() {
    use headless_lms_utils::url_to_oembed_endpoint::OEmbedResponse;

    doc!(
        OEmbedResponse {
            author_name: "Mooc.fi".to_string(),
            author_url: "http://project-331.local".to_string(),
            html: "<iframe src='http://project-331.local/oembed' style='width: 99%;' height='500' title='OEmbed iFrame'></iframe>".to_string(),
            provider_name: "project".to_string(),
            provider_url: "http://project-331.local".to_string(),
            title: "OEmbed".to_string(),
            version: "1.0".to_string(),
        }
    );
}
