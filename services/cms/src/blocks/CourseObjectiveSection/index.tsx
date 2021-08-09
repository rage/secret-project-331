import { BlockConfiguration } from "@wordpress/blocks"

import CourseObjectiveSectionEditor from "./CourseObjectiveSectionEditor"
import CourseObjectiveSectionSave from "./CourseObjectiveSectionSave"

export interface CourseObjectiveSectionAttributes {
  title: string
}

const CourseObjectiveSectionConfiguration: BlockConfiguration<CourseObjectiveSectionAttributes> = {
  title: "Course Objective Section",
  description: "Course Objective section where you describe what you will learn in this course.",
  category: "design",
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h2",
    },
  },
  edit: CourseObjectiveSectionEditor,
  save: CourseObjectiveSectionSave,
}

export default CourseObjectiveSectionConfiguration
