use anyhow::{Context, Result};

use headless_lms_models::course_modules::{
    self, AutomaticCompletionRequirements, CompletionPolicy, CourseModule, NewCourseModule,
};
use sqlx::PgConnection;

use crate::programs::seed::builder::{chapter::ChapterBuilder, context::SeedContext};

/// Builder for course modules that group chapters with ECTS credits and Open University registration.
#[derive(Debug, Clone)]
pub struct ModuleBuilder {
    pub name: Option<String>,
    pub order: Option<i32>,
    pub ects: Option<f32>,
    pub chapters: Vec<ChapterBuilder>,
    pub register_to_open_university: bool,
    pub completion_policy: CompletionPolicy,
}

impl Default for ModuleBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl ModuleBuilder {
    pub fn new() -> Self {
        Self {
            name: None,
            order: None,
            ects: None,
            chapters: vec![],
            register_to_open_university: false,
            completion_policy: CompletionPolicy::Manual,
        }
    }
    pub fn order(mut self, n: i32) -> Self {
        self.order = Some(n);
        self
    }
    pub fn name(mut self, n: impl Into<String>) -> Self {
        self.name = Some(n.into());
        self
    }
    pub fn ects(mut self, e: f32) -> Self {
        self.ects = Some(e);
        self
    }
    pub fn register_to_open_university(mut self, v: bool) -> Self {
        self.register_to_open_university = v;
        self
    }
    pub fn chapter(mut self, c: ChapterBuilder) -> Self {
        self.chapters.push(c);
        self
    }
    pub fn chapters<I: IntoIterator<Item = ChapterBuilder>>(mut self, it: I) -> Self {
        self.chapters.extend(it);
        self
    }
    pub fn completion_policy(mut self, policy: CompletionPolicy) -> Self {
        self.completion_policy = policy;
        self
    }
    pub fn manual_completion(mut self) -> Self {
        self.completion_policy = CompletionPolicy::Manual;
        self
    }
    pub fn automatic_completion(
        mut self,
        exercises_threshold: Option<i32>,
        points_threshold: Option<i32>,
        requires_exam: bool,
    ) -> Self {
        // We'll set the course_module_id when seeding
        self.completion_policy = CompletionPolicy::Automatic(AutomaticCompletionRequirements {
            course_module_id: uuid::Uuid::new_v4(), // Temporary, will be updated during seeding
            number_of_exercises_attempted_treshold: exercises_threshold,
            number_of_points_treshold: points_threshold,
            requires_exam,
        });
        self
    }

    pub(crate) async fn seed(
        self,
        conn: &mut PgConnection,
        cx: &SeedContext,
        course_id: uuid::Uuid,
        fallback_order: i32,
    ) -> Result<CourseModule> {
        let order = self.order.unwrap_or(fallback_order);

        let module = course_modules::insert(
            conn,
            headless_lms_models::PKeyPolicy::Generate,
            &NewCourseModule::new(course_id, self.name, order)
                .set_ects_credits(self.ects)
                .set_completion_policy(self.completion_policy.clone()),
        )
        .await
        .with_context(|| format!("inserting module (order {:?})", order))?;

        // Update completion policy if it's automatic to set the correct module ID
        if let CompletionPolicy::Automatic(mut requirements) = self.completion_policy {
            requirements.course_module_id = module.id;
            let updated_policy = CompletionPolicy::Automatic(requirements);
            course_modules::update_automatic_completion_status(conn, module.id, &updated_policy)
                .await
                .context("updating automatic completion policy")?;
        }

        if self.register_to_open_university {
            course_modules::update_enable_registering_completion_to_uh_open_university(
                conn, module.id, true,
            )
            .await
            .context("enabling OU registration for module")?;
        }

        for ch in self.chapters {
            ch.seed(conn, cx, course_id, module.id).await?;
        }

        Ok(module)
    }
}

#[cfg(test)]
mod tests {
    use crate::programs::seed::builder::chapter::ChapterBuilder;

    use super::*;

    #[test]
    fn module_builder_new() {
        let module = ModuleBuilder::new();

        assert!(module.order.is_none());
        assert!(module.name.is_none());
        assert!(module.ects.is_none());
        assert!(module.chapters.is_empty());
        assert!(!module.register_to_open_university);
        assert_eq!(module.completion_policy, CompletionPolicy::Manual);
    }

    #[test]
    fn module_builder_order() {
        let module = ModuleBuilder::new().order(5);

        assert_eq!(module.order, Some(5));
    }

    #[test]
    fn module_builder_name() {
        let module = ModuleBuilder::new().name("Test Module");

        assert_eq!(module.name, Some("Test Module".to_string()));
    }

    #[test]
    fn module_builder_name_string_conversion() {
        let module1 = ModuleBuilder::new().name("String literal");
        let module2 = ModuleBuilder::new().name(String::from("Owned string"));

        assert_eq!(module1.name, Some("String literal".to_string()));
        assert_eq!(module2.name, Some("Owned string".to_string()));
    }

    #[test]
    fn module_builder_ects() {
        let module = ModuleBuilder::new().ects(5.0);

        assert_eq!(module.ects, Some(5.0));
    }

    #[test]
    fn module_builder_ects_fractional() {
        let module = ModuleBuilder::new().ects(2.5);

        assert_eq!(module.ects, Some(2.5));
    }

    #[test]
    fn module_builder_register_to_open_university_true() {
        let module = ModuleBuilder::new().register_to_open_university(true);

        assert!(module.register_to_open_university);
    }

    #[test]
    fn module_builder_register_to_open_university_false() {
        let module = ModuleBuilder::new().register_to_open_university(false);

        assert!(!module.register_to_open_university);
    }

    #[test]
    fn module_builder_chapter() {
        let chapter = ChapterBuilder::new(1, "Test Chapter");
        let module = ModuleBuilder::new().chapter(chapter);

        assert_eq!(module.chapters.len(), 1);
        assert_eq!(module.chapters[0].number, 1);
        assert_eq!(module.chapters[0].name, "Test Chapter");
    }

    #[test]
    fn module_builder_multiple_chapters() {
        let chapter1 = ChapterBuilder::new(1, "Chapter 1");
        let chapter2 = ChapterBuilder::new(2, "Chapter 2");
        let module = ModuleBuilder::new().chapter(chapter1).chapter(chapter2);

        assert_eq!(module.chapters.len(), 2);
        assert_eq!(module.chapters[0].number, 1);
        assert_eq!(module.chapters[0].name, "Chapter 1");
        assert_eq!(module.chapters[1].number, 2);
        assert_eq!(module.chapters[1].name, "Chapter 2");
    }

    #[test]
    fn module_builder_fluent_interface() {
        let chapter1 = ChapterBuilder::new(1, "Chapter 1");
        let chapter2 = ChapterBuilder::new(2, "Chapter 2");

        let module = ModuleBuilder::new()
            .order(1)
            .name("Advanced Module")
            .ects(3.5)
            .register_to_open_university(true)
            .chapter(chapter1)
            .chapter(chapter2);

        assert_eq!(module.order, Some(1));
        assert_eq!(module.name, Some("Advanced Module".to_string()));
        assert_eq!(module.ects, Some(3.5));
        assert!(module.register_to_open_university);
        assert_eq!(module.chapters.len(), 2);
    }

    #[test]
    fn module_builder_method_chaining_order() {
        let chapter1 = ChapterBuilder::new(1, "Test Chapter");
        let chapter2 = ChapterBuilder::new(1, "Test Chapter");

        let module1 = ModuleBuilder::new()
            .order(1)
            .name("Module 1")
            .ects(2.0)
            .register_to_open_university(true)
            .chapter(chapter1);

        let module2 = ModuleBuilder::new()
            .register_to_open_university(true)
            .chapter(chapter2)
            .ects(2.0)
            .name("Module 1")
            .order(1);

        assert_eq!(module1.name, module2.name);
        assert_eq!(module1.ects, module2.ects);
        assert_eq!(
            module1.register_to_open_university,
            module2.register_to_open_university
        );
        assert_eq!(module1.chapters.len(), module2.chapters.len());
        assert_eq!(module1.order, module2.order);
    }

    #[test]
    fn module_builder_default_values() {
        let module = ModuleBuilder::new();

        assert!(module.order.is_none());
        assert!(module.name.is_none());
        assert!(module.ects.is_none());
        assert!(module.chapters.is_empty());
        assert!(!module.register_to_open_university);
    }

    #[test]
    fn module_builder_order_preservation() {
        let module = ModuleBuilder::new().order(999);

        assert_eq!(module.order, Some(999));
    }

    #[test]
    fn module_builder_manual_completion() {
        let module = ModuleBuilder::new().manual_completion();

        assert_eq!(module.completion_policy, CompletionPolicy::Manual);
    }

    #[test]
    fn module_builder_automatic_completion() {
        let module = ModuleBuilder::new().automatic_completion(Some(5), Some(100), true);

        match module.completion_policy {
            CompletionPolicy::Automatic(requirements) => {
                assert_eq!(requirements.number_of_exercises_attempted_treshold, Some(5));
                assert_eq!(requirements.number_of_points_treshold, Some(100));
                assert!(requirements.requires_exam);
            }
            CompletionPolicy::Manual => panic!("Expected automatic completion policy"),
        }
    }

    #[test]
    fn module_builder_automatic_completion_no_thresholds() {
        let module = ModuleBuilder::new().automatic_completion(None, None, false);

        match module.completion_policy {
            CompletionPolicy::Automatic(requirements) => {
                assert_eq!(requirements.number_of_exercises_attempted_treshold, None);
                assert_eq!(requirements.number_of_points_treshold, None);
                assert!(!requirements.requires_exam);
            }
            CompletionPolicy::Manual => panic!("Expected automatic completion policy"),
        }
    }

    #[test]
    fn module_builder_completion_policy_fluent_interface() {
        let chapter1 = ChapterBuilder::new(1, "Chapter 1");
        let chapter2 = ChapterBuilder::new(2, "Chapter 2");

        let module = ModuleBuilder::new()
            .order(1)
            .name("Advanced Module")
            .ects(3.5)
            .register_to_open_university(true)
            .automatic_completion(Some(10), Some(200), true)
            .chapter(chapter1)
            .chapter(chapter2);

        assert_eq!(module.order, Some(1));
        assert_eq!(module.name, Some("Advanced Module".to_string()));
        assert_eq!(module.ects, Some(3.5));
        assert!(module.register_to_open_university);
        assert_eq!(module.chapters.len(), 2);

        match module.completion_policy {
            CompletionPolicy::Automatic(requirements) => {
                assert_eq!(
                    requirements.number_of_exercises_attempted_treshold,
                    Some(10)
                );
                assert_eq!(requirements.number_of_points_treshold, Some(200));
                assert!(requirements.requires_exam);
            }
            CompletionPolicy::Manual => panic!("Expected automatic completion policy"),
        }
    }

    #[test]
    fn module_builder_completion_policy_override() {
        let module1 = ModuleBuilder::new().manual_completion();
        let module2 = ModuleBuilder::new()
            .automatic_completion(Some(5), Some(100), false)
            .manual_completion();

        assert_eq!(module1.completion_policy, CompletionPolicy::Manual);
        assert_eq!(module2.completion_policy, CompletionPolicy::Manual);
    }
}
