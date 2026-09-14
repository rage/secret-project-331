//! Which categories of tools a chatbot configuration offers the LLM, independent of
//! [crate::chatbot_tools::tool_authorization::ToolRequirement]: a category answers "does this
//! chatbot offer this kind of tool", not "may this caller use it".

use headless_lms_models::chatbot_configurations::{ChatbotConfiguration, ToolCategory};

pub struct EnabledToolCategories(Vec<ToolCategory>);

impl EnabledToolCategories {
    pub fn from_configuration(configuration: &ChatbotConfiguration) -> Self {
        Self(configuration.enabled_tool_categories.clone())
    }

    pub fn contains(&self, category: ToolCategory) -> bool {
        self.0.contains(&category)
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    #[cfg(test)]
    pub(crate) fn all() -> Self {
        Self(ToolCategory::ALL.to_vec())
    }

    #[cfg(test)]
    pub(crate) fn only(categories: &[ToolCategory]) -> Self {
        Self(categories.to_vec())
    }
}
