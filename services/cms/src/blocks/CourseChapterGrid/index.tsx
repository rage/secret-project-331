import { BlockConfiguration } from "@wordpress/blocks"

import CourseGridEditor from "./CourseChapterGridEditor"
import CourseGridSave from "./CourseChapterGridSave"

const CourseChapterGridConfiguration: BlockConfiguration = {
  title: "Chapters Grid",
  description: "Chapters Grid.",
  category: "design",
  attributes: {},
  edit: CourseGridEditor,
  save: CourseGridSave,
}

export default CourseChapterGridConfiguration
