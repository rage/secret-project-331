import {
  Brain,
  Hierarchy,
  ImageMessage,
  ListClipboard,
  Paintbrush,
  PencilPaper,
  TargetArrowBullseye,
} from "@vectopus/atlas-icons-react"
import { v4 } from "uuid"

import type {
  CourseDesignerStage,
  CourseDesignerStageWorkspace,
  DesignPlannedContentFormats,
  DesignStyleGuide,
  DesignWorkloadActivityType,
  DesignWorkspaceV1,
} from "@/generated/api/types.generated"

import { SECTION_KEYS } from "../section-status/sectionKeys"

export const STAGE_DESIGN: CourseDesignerStage = "Design"
export const DESIGN_WORKSPACE_SCHEMA_V1 = "design_v1" as const
export const DEFAULT_LEARNING_GOAL_COUNT = 3
/** Student workload per credit in Finnish higher education. */
export const HOURS_PER_CREDIT = 27
export const MAX_WORKLOAD_AMOUNT = 10_000

/** One entry of a string list; react-hook-form field arrays need objects. */
export interface TextListItem {
  text: string
}

export interface DesignTopicFormValues {
  id: string
  title: string
}

export interface DesignChapterFormValues {
  id: string
  title: string
  learning_objectives: TextListItem[]
  topics: DesignTopicFormValues[]
}

export interface DesignWorkloadActivityFormValues {
  id: string
  title: string
  activity_type: DesignWorkloadActivityType
  /** `null` while the number field is empty; saved as 0. */
  count: number | null
  /** `null` while the number field is empty; saved as 0. */
  minutes_each: number | null
}

export interface DesignFormValues {
  learning_goals: TextListItem[]
  core_content_must_know: string
  core_content_should_know: string
  core_content_nice_to_know: string
  chapters: DesignChapterFormValues[]
  planned_content_formats: Required<DesignPlannedContentFormats>
  content_format_notes: string
  accessibility_notes: string
  style_guide: Required<DesignStyleGuide>
  exercise_notes: string
  workload_activities: DesignWorkloadActivityFormValues[]
}

export type PlannedContentFormat = keyof DesignPlannedContentFormats
export type StyleGuideItem = keyof DesignStyleGuide

/** ABC activity types with the learner effort time per activity from the content writing guidance. */
export const WORKLOAD_ACTIVITY_TYPES = [
  {
    type: "acquisition_audio",
    labelKey: "course-plans-design-activity-acquisition-audio",
    defaultMinutes: 10,
  },
  {
    type: "acquisition_video",
    labelKey: "course-plans-design-activity-acquisition-video",
    defaultMinutes: 5,
  },
  {
    type: "acquisition_reading",
    labelKey: "course-plans-design-activity-acquisition-reading",
    defaultMinutes: 8,
  },
  { type: "discussion", labelKey: "course-plans-design-activity-discussion", defaultMinutes: 20 },
  {
    type: "collaboration",
    labelKey: "course-plans-design-activity-collaboration",
    defaultMinutes: 30,
  },
  {
    type: "investigation",
    labelKey: "course-plans-design-activity-investigation",
    defaultMinutes: 45,
  },
  { type: "practice", labelKey: "course-plans-design-activity-practice", defaultMinutes: 20 },
  { type: "production", labelKey: "course-plans-design-activity-production", defaultMinutes: 60 },
] as const satisfies readonly {
  type: DesignWorkloadActivityType
  labelKey: string
  defaultMinutes: number
}[]

/** Default learner effort time for one activity of the given type. */
export function defaultMinutesFor(type: DesignWorkloadActivityType): number {
  return WORKLOAD_ACTIVITY_TYPES.find((entry) => entry.type === type)?.defaultMinutes ?? 0
}

export const PLANNED_CONTENT_FORMATS = [
  {
    format: "text",
    labelKey: "course-plans-design-format-text",
    guidanceKey: "course-plans-design-format-text-guidance",
  },
  {
    format: "infographics",
    labelKey: "course-plans-design-format-infographics",
    guidanceKey: "course-plans-design-format-infographics-guidance",
  },
  {
    format: "photos",
    labelKey: "course-plans-design-format-photos",
    guidanceKey: "course-plans-design-format-photos-guidance",
  },
  {
    format: "videos",
    labelKey: "course-plans-design-format-videos",
    guidanceKey: "course-plans-design-format-videos-guidance",
  },
  {
    format: "podcast",
    labelKey: "course-plans-design-format-podcast",
    guidanceKey: "course-plans-design-format-podcast-guidance",
  },
  {
    format: "thinglink",
    labelKey: "course-plans-design-format-thinglink",
    guidanceKey: "course-plans-design-format-thinglink-guidance",
  },
  {
    format: "simulations",
    labelKey: "course-plans-design-format-simulations",
    guidanceKey: "course-plans-design-format-simulations-guidance",
  },
  {
    format: "chatbots",
    labelKey: "course-plans-design-format-chatbots",
    guidanceKey: "course-plans-design-format-chatbots-guidance",
  },
] as const satisfies readonly {
  format: PlannedContentFormat
  labelKey: string
  guidanceKey: string
}[]

/** The style guide items in the order of the "Page/Screen Layout Elements" guidance. */
export const STYLE_GUIDE_ITEMS = [
  {
    item: "file_naming",
    labelKey: "course-plans-design-style-file-naming",
    exampleKey: "course-plans-design-style-file-naming-example",
  },
  {
    item: "video_styles",
    labelKey: "course-plans-design-style-video-styles",
    exampleKey: "course-plans-design-style-video-styles-example",
  },
  {
    item: "podcast",
    labelKey: "course-plans-design-style-podcast",
    exampleKey: "course-plans-design-style-podcast-example",
  },
  {
    item: "graphics_background",
    labelKey: "course-plans-design-style-graphics-background",
    exampleKey: "course-plans-design-style-graphics-background-example",
  },
  {
    item: "colour_palette",
    labelKey: "course-plans-design-style-colour-palette",
    exampleKey: "course-plans-design-style-colour-palette-example",
  },
  {
    item: "punctuation",
    labelKey: "course-plans-design-style-punctuation",
    exampleKey: "course-plans-design-style-punctuation-example",
  },
  {
    item: "font",
    labelKey: "course-plans-design-style-font",
    exampleKey: "course-plans-design-style-font-example",
  },
  {
    item: "bulleted_lists",
    labelKey: "course-plans-design-style-bulleted-lists",
    exampleKey: "course-plans-design-style-bulleted-lists-example",
  },
  {
    item: "capitalization",
    labelKey: "course-plans-design-style-capitalization",
    exampleKey: "course-plans-design-style-capitalization-example",
  },
  {
    item: "active_passive_voice",
    labelKey: "course-plans-design-style-voice",
    exampleKey: "course-plans-design-style-voice-example",
  },
  {
    item: "writing_style",
    labelKey: "course-plans-design-style-writing-style",
    exampleKey: "course-plans-design-style-writing-style-example",
  },
  {
    item: "references_and_citations",
    labelKey: "course-plans-design-style-references",
    exampleKey: "course-plans-design-style-references-example",
  },
  {
    item: "terminology_and_acronyms",
    labelKey: "course-plans-design-style-terminology",
    exampleKey: "course-plans-design-style-terminology-example",
  },
  {
    item: "blocks",
    labelKey: "course-plans-design-style-blocks",
    exampleKey: "course-plans-design-style-blocks-example",
  },
] as const satisfies readonly { item: StyleGuideItem; labelKey: string; exampleKey: string }[]

/** The Design form's sections in display order. */
export const DESIGN_SECTIONS = [
  {
    domId: "design-section-learning-goals",
    sectionKey: SECTION_KEYS.designLearningGoals,
    titleKey: "course-plans-design-section-learning-goals",
    icon: TargetArrowBullseye,
  },
  {
    domId: "design-section-core-content",
    sectionKey: SECTION_KEYS.designCoreContent,
    titleKey: "course-plans-design-section-core-content",
    icon: ListClipboard,
  },
  {
    domId: "design-section-course-structure",
    sectionKey: SECTION_KEYS.designCourseStructure,
    titleKey: "course-plans-design-section-course-structure",
    icon: Hierarchy,
  },
  {
    domId: "design-section-content-format",
    sectionKey: SECTION_KEYS.designContentFormat,
    titleKey: "course-plans-design-section-content-format",
    icon: ImageMessage,
  },
  {
    domId: "design-section-style-guide",
    sectionKey: SECTION_KEYS.designStyleGuide,
    titleKey: "course-plans-design-section-style-guide",
    icon: Paintbrush,
  },
  {
    domId: "design-section-exercises",
    sectionKey: SECTION_KEYS.designExercises,
    titleKey: "course-plans-design-section-exercises",
    icon: PencilPaper,
  },
  {
    domId: "design-section-learning-types",
    sectionKey: SECTION_KEYS.designLearningTypes,
    titleKey: "course-plans-design-section-learning-types",
    icon: Brain,
  },
] as const

export type DesignSectionDomId = (typeof DESIGN_SECTIONS)[number]["domId"]

/** A fresh client-generated id for chapters, topics and workload rows. */
export function newDesignItemId(): string {
  return v4()
}

export function newChapter(): DesignChapterFormValues {
  return { id: newDesignItemId(), title: "", learning_objectives: [{ text: "" }], topics: [] }
}

export function newTopic(): DesignTopicFormValues {
  return { id: newDesignItemId(), title: "" }
}

export function newWorkloadActivity(): DesignWorkloadActivityFormValues {
  const activityType: DesignWorkloadActivityType = "acquisition_reading"
  return {
    id: newDesignItemId(),
    title: "",
    activity_type: activityType,
    count: 1,
    minutes_each: defaultMinutesFor(activityType),
  }
}

function toTextList(values: readonly string[] | undefined): TextListItem[] {
  return (values ?? []).map((text) => ({ text }))
}

/** Reads a stored Design workspace into form values, filling in anything older payloads lack. */
export function toDesignFormValues(workspaceData: unknown): DesignFormValues {
  const envelope = workspaceData as { schema?: unknown; payload?: unknown } | null | undefined
  const payload: DesignWorkspaceV1 =
    envelope?.schema === DESIGN_WORKSPACE_SCHEMA_V1 &&
    typeof envelope.payload === "object" &&
    envelope.payload !== null
      ? (envelope.payload as DesignWorkspaceV1)
      : {}
  const formats = payload.planned_content_formats ?? {}
  const styleGuide = payload.style_guide ?? {}
  const learningGoals = toTextList(payload.learning_goals)
  return {
    learning_goals:
      learningGoals.length > 0
        ? learningGoals
        : Array.from({ length: DEFAULT_LEARNING_GOAL_COUNT }, () => ({ text: "" })),
    core_content_must_know: payload.core_content_must_know ?? "",
    core_content_should_know: payload.core_content_should_know ?? "",
    core_content_nice_to_know: payload.core_content_nice_to_know ?? "",
    chapters: (payload.chapters ?? []).map((chapter) => ({
      id: chapter.id ?? newDesignItemId(),
      title: chapter.title ?? "",
      learning_objectives: toTextList(chapter.learning_objectives),
      topics: (chapter.topics ?? []).map((topic) => ({
        id: topic.id ?? newDesignItemId(),
        title: topic.title ?? "",
      })),
    })),
    planned_content_formats: {
      text: formats.text ?? false,
      infographics: formats.infographics ?? false,
      photos: formats.photos ?? false,
      videos: formats.videos ?? false,
      podcast: formats.podcast ?? false,
      thinglink: formats.thinglink ?? false,
      simulations: formats.simulations ?? false,
      chatbots: formats.chatbots ?? false,
    },
    content_format_notes: payload.content_format_notes ?? "",
    accessibility_notes: payload.accessibility_notes ?? "",
    style_guide: {
      file_naming: styleGuide.file_naming ?? "",
      video_styles: styleGuide.video_styles ?? "",
      podcast: styleGuide.podcast ?? "",
      graphics_background: styleGuide.graphics_background ?? "",
      colour_palette: styleGuide.colour_palette ?? "",
      punctuation: styleGuide.punctuation ?? "",
      font: styleGuide.font ?? "",
      bulleted_lists: styleGuide.bulleted_lists ?? "",
      capitalization: styleGuide.capitalization ?? "",
      active_passive_voice: styleGuide.active_passive_voice ?? "",
      writing_style: styleGuide.writing_style ?? "",
      references_and_citations: styleGuide.references_and_citations ?? "",
      terminology_and_acronyms: styleGuide.terminology_and_acronyms ?? "",
      blocks: styleGuide.blocks ?? "",
    },
    exercise_notes: payload.exercise_notes ?? "",
    workload_activities: (payload.workload_activities ?? []).map((activity) => {
      const activityType = activity.activity_type ?? "acquisition_reading"
      return {
        id: activity.id ?? newDesignItemId(),
        title: activity.title ?? "",
        activity_type: activityType,
        count: activity.count ?? 0,
        minutes_each: activity.minutes_each ?? defaultMinutesFor(activityType),
      }
    }),
  }
}

/** Builds the stored Design workspace from form values. */
export function toDesignWorkspace(values: DesignFormValues): CourseDesignerStageWorkspace {
  return {
    schema: DESIGN_WORKSPACE_SCHEMA_V1,
    payload: {
      ...values,
      learning_goals: values.learning_goals.map((goal) => goal.text),
      chapters: values.chapters.map((chapter) => ({
        ...chapter,
        learning_objectives: chapter.learning_objectives.map((objective) => objective.text),
      })),
      workload_activities: values.workload_activities.map((activity) => ({
        ...activity,
        count: activity.count ?? 0,
        minutes_each: activity.minutes_each ?? 0,
      })),
    },
  }
}

/** Total planned student work in minutes. Empty fields count as zero. */
export function totalWorkloadMinutes(
  activities: readonly Pick<DesignWorkloadActivityFormValues, "count" | "minutes_each">[],
): number {
  return activities.reduce(
    (sum, activity) => sum + (activity.count ?? 0) * (activity.minutes_each ?? 0),
    0,
  )
}
