//! Builder pattern API for creating course seed data declaratively.
//!
//! # Usage
//!
//! ```rust
//! use crate::programs::seed::builder::prelude::*;
//!
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
//! let (course, instance, module) = course.seed(&mut context).await?;
//! ```

pub mod chapter;
pub mod context;
pub mod course;
pub mod exercise;
pub mod id;
pub mod json_source;
pub mod module;
pub mod page;
