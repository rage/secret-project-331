import { BlockConfiguration } from "@wordpress/blocks"

import CourseObjectiveSectionEditor from "./CourseObjectiveSectionEditor"
import CourseObjectiveSectionSave from "./CourseObjectiveSectionSave"

const CourseObjectiveSectionConfiguration: BlockConfiguration = {
  title: "Course Objective Section",
  description: "Course Objective section where you describe what you will learn in this course.",
  category: "design",
  attributes: {},
  edit: CourseObjectiveSectionEditor,
  save: CourseObjectiveSectionSave,
}

export default CourseObjectiveSectionConfiguration
