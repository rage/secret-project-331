import { BlockConfiguration } from "@wordpress/blocks"
import CourseProgressEditor from "./CourseProgressEditor"
import CourseProgressSave from "./CourseProgressSave"

const CourseProgressConfiguration: BlockConfiguration = {
  title: "Course Progress",
  description: "Course Progress block.",
  category: "design",
  edit: CourseProgressEditor,
  save: CourseProgressSave,
  attributes: {},
}

export default CourseProgressConfiguration
