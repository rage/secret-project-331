//! Builder pattern API for creating course seed data declaratively.
//!
//! # Usage
//!
//! ```rust
//! use chrono::Utc;
//! use sqlx::Connection;
//! use headless_lms_server::programs::seed::builder::{
//!     course::CourseBuilder,
//!     module::ModuleBuilder,
//!     chapter::ChapterBuilder,
//!     page::PageBuilder,
//!     context::SeedContext,
//! };
//!
//! # async fn example() -> anyhow::Result<()> {
//! # let mut conn = sqlx::PgConnection::connect("postgresql://").await?;
//! # let teacher = uuid::Uuid::new_v4();
//! # let org = uuid::Uuid::new_v4();
//! # let base_course_ns = uuid::Uuid::new_v4();
//! # let mut context = SeedContext { teacher, org, base_course_ns };
//! let course = CourseBuilder::new("My Course", "my-course")
//!     .desc("A sample course")
//!     .chatbot(true)
//!     .module(
//!         ModuleBuilder::new()
//!             .order(0)
//!             .name("Introduction")
//!             .ects(5.0)
//!             .chapter(
//!                 ChapterBuilder::new(1, "Getting Started")
//!                     .opens(Utc::now())
//!                     .page(PageBuilder::new("/intro", "Introduction Page"))
//!             )
//!     );
//!
//! let (course, instance, module) = course.seed(&mut conn, &context).await?;
//! # Ok(())
//! # }
//! ```

pub mod chapter;
pub mod context;
pub mod course;
pub mod exercise;
pub mod id;
pub mod json_source;
pub mod module;
pub mod page;
