"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import CourseObjectiveSectionEditor from "./CourseObjectiveSectionEditor"
import CourseObjectiveSectionSave from "./CourseObjectiveSectionSave"

export interface CourseObjectiveSectionAttributes {
  title: string
}

const CourseObjectiveSectionConfiguration: BlockConfiguration<CourseObjectiveSectionAttributes> = {
  apiVersion: 3,
  title: "Course Objective Section",
  description: "Course Objective section where you describe what you will learn in this course.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    title: {
      type: "string",
      isRichText: true,
      default: "In this course you'll...",
    },
  },
  allowedBlocks: ["core/heading", "core/buttons", "core/paragraph", "core/columns"],
  innerBlocksArea: {
    template: [
      [
        "core/columns",
        { isStackedOnMobile: true },
        [
          [
            "core/column",
            {},
            [
              [
                "core/heading",
                {
                  placeholder: "Objective #1",
                  level: 3,
                  textAlign: "center",
                  anchor: "objective-1",
                },
              ],
              ["core/paragraph", { placeholder: "Insert text...", align: "center" }],
            ],
          ],
          [
            "core/column",
            {},
            [
              [
                "core/heading",
                {
                  placeholder: "Objective #2",
                  level: 3,
                  textAlign: "center",
                  anchor: "objective-2",
                },
              ],
              ["core/paragraph", { placeholder: "Insert text...", align: "center" }],
            ],
          ],
          [
            "core/column",
            {},
            [
              [
                "core/heading",
                {
                  placeholder: "Objective #3",
                  level: 3,
                  textAlign: "center",
                  anchor: "objective-2",
                },
              ],
              ["core/paragraph", { placeholder: "Insert text...", align: "center" }],
            ],
          ],
        ],
      ],
    ],
  },
  edit: CourseObjectiveSectionEditor,
  save: CourseObjectiveSectionSave,
}

export default CourseObjectiveSectionConfiguration
