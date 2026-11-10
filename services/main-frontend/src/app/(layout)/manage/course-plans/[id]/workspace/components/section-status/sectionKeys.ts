import type { TFunction } from "i18next"

/**
 * Stable `section_key`s for section Ready/Unfinished marks.
 *
 * Stored in the database and read by the weekly digest, the MOOC support page and the assistant,
 * so never rename a value.
 */
export const SECTION_KEYS = {
  analysisMyCourse: "analysis.my_course",
  analysisNeedsAnalysis: "analysis.needs_analysis",
  analysisWishes: "analysis.wishes",
  analysisMarketAnalysis: "analysis.market_analysis",
  analysisResources: "analysis.resources",
  analysisKeyContributors: "analysis.key_contributors",
  designLearningGoals: "design.learning_goals",
  designCoreContent: "design.core_content",
  designCourseStructure: "design.course_structure",
  designContentFormat: "design.content_format",
  designStyleGuide: "design.style_guide",
  designExercises: "design.exercises",
  designLearningTypes: "design.learning_types",
  developmentStage: "development.stage",
  implementationStage: "implementation.stage",
  evaluationStage: "evaluation.stage",
} as const

export type SectionKey = (typeof SECTION_KEYS)[keyof typeof SECTION_KEYS]

/** Stages without form sections; each has a single mark. */
export type FormlessStage = "Development" | "Implementation" | "Evaluation"

export const STAGE_SECTION_KEYS = {
  Development: SECTION_KEYS.developmentStage,
  Implementation: SECTION_KEYS.implementationStage,
  Evaluation: SECTION_KEYS.evaluationStage,
} as const satisfies Record<FormlessStage, SectionKey>

const SECTION_LABEL_KEYS = {
  [SECTION_KEYS.analysisMyCourse]: "course-plans-analysis-section-1",
  [SECTION_KEYS.analysisNeedsAnalysis]: "course-plans-analysis-section-2",
  [SECTION_KEYS.analysisWishes]: "course-plans-analysis-section-3",
  [SECTION_KEYS.analysisMarketAnalysis]: "course-plans-analysis-section-4",
  [SECTION_KEYS.analysisResources]: "course-plans-analysis-section-5",
  [SECTION_KEYS.analysisKeyContributors]: "course-plans-analysis-section-6",
  [SECTION_KEYS.designLearningGoals]: "course-plans-design-section-learning-goals",
  [SECTION_KEYS.designCoreContent]: "course-plans-design-section-core-content",
  [SECTION_KEYS.designCourseStructure]: "course-plans-design-section-course-structure",
  [SECTION_KEYS.designContentFormat]: "course-plans-design-section-content-format",
  [SECTION_KEYS.designStyleGuide]: "course-plans-design-section-style-guide",
  [SECTION_KEYS.designExercises]: "course-plans-design-section-exercises",
  [SECTION_KEYS.designLearningTypes]: "course-plans-design-section-learning-types",
  [SECTION_KEYS.developmentStage]: "course-plans-section-key-whole-stage",
  [SECTION_KEYS.implementationStage]: "course-plans-section-key-whole-stage",
  [SECTION_KEYS.evaluationStage]: "course-plans-section-key-whole-stage",
} as const satisfies Record<SectionKey, string>

/** Translated name of a stored `section_key`; unknown keys are returned as they are. */
export function sectionKeyLabel(sectionKey: string, t: TFunction): string {
  const labelKey = (SECTION_LABEL_KEYS as Record<string, (typeof SECTION_LABEL_KEYS)[SectionKey]>)[
    sectionKey
  ]
  return labelKey ? t(labelKey) : sectionKey
}
