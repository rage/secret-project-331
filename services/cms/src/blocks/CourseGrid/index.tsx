import { BlockConfiguration } from "@wordpress/blocks"
import CourseGridEditor from "./CourseGridEditor"
import CourseGridSave from "./CourseGridSave"

export interface CourseGridAttributes {
  hidden: boolean
}

const CourseGridConfiguration: BlockConfiguration<CourseGridAttributes> = {
  title: "Course Grid",
  description: "Course parts grid.",
  category: "design",
  attributes: {
    hidden: {
      type: "boolean",
      default: false,
    },
  },
  edit: CourseGridEditor,
  save: CourseGridSave,
}

export default CourseGridConfiguration
