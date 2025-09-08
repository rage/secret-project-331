use anyhow::{Context, Result};
use uuid::Uuid;

use headless_lms_models::{
    PKeyPolicy, certificate_configuration_to_requirements,
    certificate_configurations::{self, DatabaseCertificateConfiguration},
    course_instances::{self, CourseInstance, NewCourseInstance},
    course_modules::CourseModule,
    courses::{Course, NewCourse},
    file_uploads, glossary, library,
    library::content_management::CreateNewCourseFixedIds,
    pages::{self, NewCoursePage},
    roles::{self, RoleDomain, UserRole},
};

use crate::programs::seed::{
    builder::{context::SeedContext, module::ModuleBuilder},
    seed_helpers::get_seed_spec_fetcher,
};

/// Additional course instance configuration
#[derive(Debug, Clone)]
pub struct CourseInstanceConfig {
    pub name: Option<String>,
    pub description: Option<String>,
    pub support_email: Option<String>,
    pub teacher_in_charge_name: String,
    pub teacher_in_charge_email: String,
    pub opening_time: Option<chrono::DateTime<chrono::Utc>>,
    pub closing_time: Option<chrono::DateTime<chrono::Utc>>,
    pub instance_id: Option<Uuid>,
}

/// Generic page configuration for top-level course pages
#[derive(Debug, Clone)]
pub struct PageConfig {
    pub url: String,
    pub title: String,
    pub page_number: i32,
    pub is_hidden: bool,
    pub content: Option<Vec<headless_lms_utils::document_schema_processor::GutenbergBlock>>,
}

/// Glossary entry
#[derive(Debug, Clone)]
pub struct GlossaryEntry {
    pub acronym: String,
    pub definition: String,
}

/// Certificate configuration
#[derive(Debug, Clone)]
pub struct CertificateConfig {
    pub background_svg_path: String,
    pub certificate_id: Option<Uuid>,
}

/// Builder for courses with modules, chapters, pages, and exercises.
#[derive(Debug, Clone)]
pub struct CourseBuilder {
    pub name: String,
    pub slug: String,
    pub language_code: String,
    pub can_add_chatbot: bool,
    pub description: String,
    pub default_instance_name: &'static [u8],
    pub modules: Vec<ModuleBuilder>,
    pub extra_roles: Vec<(Uuid, UserRole)>,
    pub course_id: Option<Uuid>,
    pub additional_instances: Vec<CourseInstanceConfig>,
    pub pages: Vec<PageConfig>,
    pub glossary_entries: Vec<GlossaryEntry>,
    pub certificate_config: Option<CertificateConfig>,
}

impl CourseBuilder {
    pub fn new(name: impl Into<String>, slug: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            slug: slug.into(),
            language_code: "en-US".into(),
            can_add_chatbot: false,
            description: "Sample course.".into(),
            default_instance_name: b"default-instance",
            modules: vec![],
            extra_roles: vec![],
            course_id: None,
            additional_instances: vec![],
            pages: vec![],
            glossary_entries: vec![],
            certificate_config: None,
        }
    }

    pub fn chatbot(mut self, v: bool) -> Self {
        self.can_add_chatbot = v;
        self
    }
    pub fn desc(mut self, d: impl Into<String>) -> Self {
        self.description = d.into();
        self
    }
    pub fn language(mut self, lc: impl Into<String>) -> Self {
        self.language_code = lc.into();
        self
    }
    pub fn module(mut self, m: ModuleBuilder) -> Self {
        self.modules.push(m);
        self
    }
    pub fn modules<I: IntoIterator<Item = ModuleBuilder>>(mut self, it: I) -> Self {
        self.modules.extend(it);
        self
    }
    pub fn role(mut self, user_id: Uuid, role: UserRole) -> Self {
        self.extra_roles.push((user_id, role));
        self
    }
    pub fn course_id(mut self, id: Uuid) -> Self {
        self.course_id = Some(id);
        self
    }

    pub fn additional_instance(mut self, config: CourseInstanceConfig) -> Self {
        self.additional_instances.push(config);
        self
    }

    /// Add a top-level page to the course
    pub fn top_level_page(
        mut self,
        url: impl Into<String>,
        title: impl Into<String>,
        page_number: i32,
        is_hidden: bool,
        content: Option<Vec<headless_lms_utils::document_schema_processor::GutenbergBlock>>,
    ) -> Self {
        self.pages.push(PageConfig {
            url: url.into(),
            title: title.into(),
            page_number,
            is_hidden,
            content,
        });
        self
    }

    pub fn glossary_entry(
        mut self,
        acronym: impl Into<String>,
        definition: impl Into<String>,
    ) -> Self {
        self.glossary_entries.push(GlossaryEntry {
            acronym: acronym.into(),
            definition: definition.into(),
        });
        self
    }

    pub fn certificate_config(
        mut self,
        background_svg_path: impl Into<String>,
        certificate_id: Option<Uuid>,
    ) -> Self {
        self.certificate_config = Some(CertificateConfig {
            background_svg_path: background_svg_path.into(),
            certificate_id,
        });
        self
    }

    /// Seeds the course and all nested content. Returns `(course, default_instance, last_module)`.
    pub async fn seed(
        self,
        cx: &mut SeedContext<'_>,
    ) -> Result<(Course, CourseInstance, CourseModule)> {
        let spec = get_seed_spec_fetcher();

        let course_id = self.course_id.unwrap_or(cx.base_course_ns);
        let default_instance_id = Uuid::new_v5(&course_id, self.default_instance_name);

        let new_course = NewCourse {
            name: self.name.clone(),
            organization_id: cx.org,
            slug: self.slug.clone(),
            language_code: self.language_code.clone(),
            teacher_in_charge_name: "admin".into(),
            teacher_in_charge_email: "admin@example.com".into(),
            description: self.description.clone(),
            is_draft: false,
            is_test_mode: false,
            is_unlisted: false,
            copy_user_permissions: false,
            is_joinable_by_code_only: false,
            join_code: None,
            ask_marketing_consent: false,
            flagged_answers_threshold: Some(3),
            can_add_chatbot: self.can_add_chatbot,
        };

        let (course, _front, default_instance, mut last_module) =
            library::content_management::create_new_course(
                cx.conn,
                headless_lms_models::PKeyPolicy::Fixed(CreateNewCourseFixedIds {
                    course_id,
                    default_course_instance_id: default_instance_id,
                }),
                new_course,
                cx.teacher,
                spec,
                crate::domain::models_requests::fetch_service_info,
            )
            .await
            .context("creating course with fixed IDs")?;

        for (i, m) in self.modules.into_iter().enumerate() {
            last_module = m.seed(cx, course.id, i as i32).await?;
        }

        for (user_id, role) in self.extra_roles {
            roles::insert(cx.conn, user_id, role, RoleDomain::Course(course.id))
                .await
                .context("inserting course role")?;
        }

        // Create additional course instances
        for instance_config in self.additional_instances {
            let instance_id = instance_config.instance_id.unwrap_or_else(Uuid::new_v4);
            course_instances::insert(
                cx.conn,
                PKeyPolicy::Fixed(instance_id),
                NewCourseInstance {
                    course_id: course.id,
                    name: instance_config.name.as_deref(),
                    description: instance_config.description.as_deref(),
                    support_email: instance_config.support_email.as_deref(),
                    teacher_in_charge_name: &instance_config.teacher_in_charge_name,
                    teacher_in_charge_email: &instance_config.teacher_in_charge_email,
                    opening_time: instance_config.opening_time,
                    closing_time: instance_config.closing_time,
                },
            )
            .await
            .context("inserting additional course instance")?;
        }

        // Create top-level pages
        for page_config in self.pages {
            let mut course_page = NewCoursePage::new(
                course.id,
                page_config.page_number,
                &page_config.url,
                &page_config.title,
            );

            if page_config.is_hidden {
                course_page = course_page.set_hidden(true);
            }

            if let Some(content) = page_config.content {
                course_page = course_page.set_content(content);
            }

            pages::insert_course_page(cx.conn, &course_page, cx.teacher)
                .await
                .context("inserting course page")?;
        }

        // Add glossary entries
        for glossary_entry in self.glossary_entries {
            glossary::insert(
                cx.conn,
                &glossary_entry.acronym,
                &glossary_entry.definition,
                course.id,
            )
            .await
            .context("inserting glossary entry")?;
        }

        // Create certificate configuration
        if let Some(cert_config) = self.certificate_config {
            let background_svg_file_upload_id = file_uploads::insert(
                cx.conn,
                &format!("background-{}.svg", last_module.id),
                &cert_config.background_svg_path,
                "image/svg+xml",
                None,
            )
            .await
            .context("inserting certificate background file")?;

            let certificate_id = cert_config
                .certificate_id
                .unwrap_or_else(|| cx.v5(b"886d3e22-5007-4371-94d7-e0ad93a2391c"));
            let configuration = DatabaseCertificateConfiguration {
                id: certificate_id,
                certificate_owner_name_y_pos: None,
                certificate_owner_name_x_pos: None,
                certificate_owner_name_font_size: None,
                certificate_owner_name_text_color: None,
                certificate_owner_name_text_anchor: None,
                certificate_validate_url_y_pos: None,
                certificate_validate_url_x_pos: None,
                certificate_validate_url_font_size: None,
                certificate_validate_url_text_color: None,
                certificate_validate_url_text_anchor: None,
                certificate_date_y_pos: None,
                certificate_date_x_pos: None,
                certificate_date_font_size: None,
                certificate_date_text_color: None,
                certificate_date_text_anchor: None,
                certificate_locale: None,
                paper_size: None,
                background_svg_path: cert_config.background_svg_path,
                background_svg_file_upload_id,
                overlay_svg_path: None,
                overlay_svg_file_upload_id: None,
                render_certificate_grade: false,
                certificate_grade_y_pos: None,
                certificate_grade_x_pos: None,
                certificate_grade_font_size: None,
                certificate_grade_text_color: None,
                certificate_grade_text_anchor: None,
            };
            let database_configuration =
                certificate_configurations::insert(cx.conn, &configuration)
                    .await
                    .context("inserting certificate configuration")?;
            certificate_configuration_to_requirements::insert(
                cx.conn,
                database_configuration.id,
                Some(last_module.id),
                Some(default_instance.id),
            )
            .await
            .context("linking certificate configuration to requirements")?;
        }

        Ok((course, default_instance, last_module))
    }
}

#[cfg(test)]
mod tests {
    use crate::programs::seed::builder::module::ModuleBuilder;

    use super::*;
    use headless_lms_models::roles::UserRole;

    #[test]
    fn course_builder_new() {
        let course = CourseBuilder::new("Test Course", "test-course");

        assert_eq!(course.name, "Test Course");
        assert_eq!(course.slug, "test-course");
        assert_eq!(course.language_code, "en-US");
        assert!(!course.can_add_chatbot);
        assert_eq!(course.description, "Sample course.");
        assert_eq!(course.default_instance_name, b"default-instance");
        assert!(course.modules.is_empty());
        assert!(course.extra_roles.is_empty());
        assert!(course.course_id.is_none());
    }

    #[test]
    fn course_builder_string_conversion() {
        let course1 = CourseBuilder::new("String literal", "string-slug");
        let course2 = CourseBuilder::new(String::from("Owned string"), String::from("owned-slug"));

        assert_eq!(course1.name, "String literal");
        assert_eq!(course1.slug, "string-slug");
        assert_eq!(course2.name, "Owned string");
        assert_eq!(course2.slug, "owned-slug");
    }

    #[test]
    fn course_builder_chatbot() {
        let course = CourseBuilder::new("Test Course", "test-course").chatbot(true);
        assert!(course.can_add_chatbot);

        let course_disabled = CourseBuilder::new("Test Course", "test-course").chatbot(false);
        assert!(!course_disabled.can_add_chatbot);
    }

    #[test]
    fn course_builder_desc() {
        let course =
            CourseBuilder::new("Test Course", "test-course").desc("A comprehensive test course");

        assert_eq!(course.description, "A comprehensive test course");

        let desc_string = String::from("Another description");
        let course2 = CourseBuilder::new("Test Course", "test-course").desc(desc_string);
        assert_eq!(course2.description, "Another description");
    }

    #[test]
    fn course_builder_language() {
        let course = CourseBuilder::new("Test Course", "test-course").language("fi-FI");

        assert_eq!(course.language_code, "fi-FI");

        let lang_string = String::from("sv-SE");
        let course2 = CourseBuilder::new("Test Course", "test-course").language(lang_string);
        assert_eq!(course2.language_code, "sv-SE");
    }

    #[test]
    fn course_builder_module() {
        let module = ModuleBuilder::new().order(0);
        let course = CourseBuilder::new("Test Course", "test-course").module(module);

        assert_eq!(course.modules.len(), 1);
        assert_eq!(course.modules[0].order, Some(0));
    }

    #[test]
    fn course_builder_multiple_modules() {
        let module1 = ModuleBuilder::new().order(0);
        let module2 = ModuleBuilder::new().order(1);
        let course = CourseBuilder::new("Test Course", "test-course")
            .module(module1)
            .module(module2);

        assert_eq!(course.modules.len(), 2);
        assert_eq!(course.modules[0].order, Some(0));
        assert_eq!(course.modules[1].order, Some(1));
    }

    #[test]
    fn course_builder_role() {
        let user_id = Uuid::new_v4();
        let course =
            CourseBuilder::new("Test Course", "test-course").role(user_id, UserRole::Teacher);

        assert_eq!(course.extra_roles.len(), 1);
        assert_eq!(course.extra_roles[0].0, user_id);
        assert_eq!(course.extra_roles[0].1, UserRole::Teacher);
    }

    #[test]
    fn course_builder_multiple_roles() {
        let user1_id = Uuid::new_v4();
        let user2_id = Uuid::new_v4();
        let course = CourseBuilder::new("Test Course", "test-course")
            .role(user1_id, UserRole::Teacher)
            .role(user2_id, UserRole::MaterialViewer);

        assert_eq!(course.extra_roles.len(), 2);
        assert_eq!(course.extra_roles[0].0, user1_id);
        assert_eq!(course.extra_roles[0].1, UserRole::Teacher);
        assert_eq!(course.extra_roles[1].0, user2_id);
        assert_eq!(course.extra_roles[1].1, UserRole::MaterialViewer);
    }

    #[test]
    fn course_builder_course_id() {
        let course_id = Uuid::new_v4();
        let course = CourseBuilder::new("Test Course", "test-course").course_id(course_id);

        assert_eq!(course.course_id, Some(course_id));
    }

    #[test]
    fn course_builder_fluent_interface() {
        let user_id = Uuid::new_v4();
        let course_id = Uuid::new_v4();
        let module = ModuleBuilder::new().order(0);

        let course = CourseBuilder::new("Advanced Course", "advanced-course")
            .desc("A comprehensive advanced course")
            .language("fi-FI")
            .chatbot(true)
            .module(module)
            .role(user_id, UserRole::Teacher)
            .course_id(course_id);

        assert_eq!(course.name, "Advanced Course");
        assert_eq!(course.slug, "advanced-course");
        assert_eq!(course.description, "A comprehensive advanced course");
        assert_eq!(course.language_code, "fi-FI");
        assert!(course.can_add_chatbot);
        assert_eq!(course.modules.len(), 1);
        assert_eq!(course.extra_roles.len(), 1);
        assert_eq!(course.course_id, Some(course_id));
    }

    #[test]
    fn course_builder_default_values() {
        let course = CourseBuilder::new("Minimal Course", "minimal");

        assert_eq!(course.language_code, "en-US");
        assert!(!course.can_add_chatbot);
        assert_eq!(course.description, "Sample course.");
        assert_eq!(course.default_instance_name, b"default-instance");
        assert!(course.modules.is_empty());
        assert!(course.extra_roles.is_empty());
        assert!(course.course_id.is_none());
    }

    #[test]
    fn course_builder_empty_strings() {
        let course = CourseBuilder::new("", "");

        assert_eq!(course.name, "");
        assert_eq!(course.slug, "");
        assert_eq!(course.language_code, "en-US");
        assert_eq!(course.description, "Sample course.");
    }

    #[test]
    fn course_builder_method_chaining_order() {
        let course1 = CourseBuilder::new("Course 1", "course-1")
            .chatbot(true)
            .desc("Description 1")
            .language("fi-FI");

        let course2 = CourseBuilder::new("Course 2", "course-2")
            .language("fi-FI")
            .desc("Description 2")
            .chatbot(true);

        assert_eq!(course1.can_add_chatbot, course2.can_add_chatbot);
        assert_eq!(course1.language_code, course2.language_code);
        assert_eq!(course1.description, "Description 1");
        assert_eq!(course2.description, "Description 2");
    }

    #[test]
    fn course_builder_top_level_page() {
        let course = CourseBuilder::new("Test Course", "test-course")
            .top_level_page("/welcome", "Welcome Page", 1, false, None)
            .top_level_page("/hidden", "Hidden Page", 2, true, None);

        assert_eq!(course.pages.len(), 2);
        assert_eq!(course.pages[0].url, "/welcome");
        assert_eq!(course.pages[0].title, "Welcome Page");
        assert_eq!(course.pages[0].page_number, 1);
        assert!(!course.pages[0].is_hidden);
        assert_eq!(course.pages[0].content, None);

        assert_eq!(course.pages[1].url, "/hidden");
        assert_eq!(course.pages[1].title, "Hidden Page");
        assert_eq!(course.pages[1].page_number, 2);
        assert!(course.pages[1].is_hidden);
        assert_eq!(course.pages[1].content, None);
    }

    #[test]
    fn course_builder_top_level_page_with_content() {
        let content = vec![];
        let course = CourseBuilder::new("Test Course", "test-course").top_level_page(
            "/content",
            "Content Page",
            1,
            false,
            Some(content.clone()),
        );

        assert_eq!(course.pages.len(), 1);
        assert_eq!(course.pages[0].url, "/content");
        assert_eq!(course.pages[0].title, "Content Page");
        assert_eq!(course.pages[0].page_number, 1);
        assert!(!course.pages[0].is_hidden);
        assert_eq!(course.pages[0].content, Some(content));
    }

    #[test]
    fn course_builder_multiple_top_level_pages() {
        let course = CourseBuilder::new("Test Course", "test-course")
            .top_level_page("/welcome", "Welcome", 1, false, None)
            .top_level_page("/about", "About", 2, false, None)
            .top_level_page("/secret", "Secret", 3, true, None);

        assert_eq!(course.pages.len(), 3);
        assert_eq!(course.pages[0].url, "/welcome");
        assert_eq!(course.pages[1].url, "/about");
        assert_eq!(course.pages[2].url, "/secret");
        assert!(course.pages[2].is_hidden);
    }
}
