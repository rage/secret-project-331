/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import CourseObjectiveSectionEditor from "./CourseObjectiveSectionEditor"
import CourseObjectiveSectionSave from "./CourseObjectiveSectionSave"

export interface CourseObjectiveSectionAttributes {
  title: string
}

const CourseObjectiveSectionConfiguration: BlockConfiguration<CourseObjectiveSectionAttributes> = {
  title: "Course Objective Section",
  description: "Course Objective section where you describe what you will learn in this course.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h2",
      default: "In this course you'll...",
    },
  },
  edit: CourseObjectiveSectionEditor,
  save: CourseObjectiveSectionSave,
}

export default CourseObjectiveSectionConfiguration
