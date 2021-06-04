import { BlockConfiguration } from "@wordpress/blocks"
import CourseGridEditor from "./CourseGridEditor"
import CourseGridSave from "./CourseGridSave"

const CourseGridConfiguration: BlockConfiguration = {
  title: "Course Parts Grid",
  description: "Course Parts Grid.",
  category: "design",
  attributes: {},
  edit: CourseGridEditor,
  save: CourseGridSave,
}

export default CourseGridConfiguration
