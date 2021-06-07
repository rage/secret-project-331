import { BlockConfiguration } from "@wordpress/blocks"
import CourseGridEditor from "./CourseGridEditor"
import CourseGridSave from "./CourseGridSave"

const CourseGridConfiguration: BlockConfiguration = {
  title: "Chapters Grid",
  description: "Chapters Grid.",
  category: "design",
  attributes: {},
  edit: CourseGridEditor,
  save: CourseGridSave,
}

export default CourseGridConfiguration
