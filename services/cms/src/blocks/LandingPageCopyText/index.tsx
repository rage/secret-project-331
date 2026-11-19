"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import LandingPageCopyTextEditor from "./LandingPageCopyTextEditor"
import LandingPageCopyTextSave from "./LandingPageCopyTextSave"

const LandingPageCopyTextConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: "Landing Page Copy Text",
  description: "Block for adding copy text in landing page",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  allowedBlocks: [
    "core/table",
    "core/paragraph",
    "core/heading",
    "core/list",
    "core/quote",
    "core/columns",
  ],
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
                  placeholder: "About this course",
                  level: 3,
                  anchor: "about-this-course",
                },
              ],
              ["core/paragraph", { placeholder: "Insert text..." }],
            ],
          ],
        ],
      ],
    ],
  },
  edit: LandingPageCopyTextEditor,
  save: LandingPageCopyTextSave,
}

export default LandingPageCopyTextConfiguration
