import { BlockConfiguration } from "@wordpress/blocks"
import CoursePartProgressEditor from "./CoursePartProgressEditor"
import CoursePartProgressSave from "./CoursePartProgressSave"

const CoursePartProgressConfiguration: BlockConfiguration = {
  title: "Course Part Progress",
  description: "Course Part Progress block.",
  category: "design",
  attributes: {},
  edit: CoursePartProgressEditor,
  save: CoursePartProgressSave,
}

export default CoursePartProgressConfiguration
