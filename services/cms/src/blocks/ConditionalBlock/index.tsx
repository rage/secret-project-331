"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import ConditionalBlockEditor from "./ConditionalBlockEditor"
import ConditionalBlockSave from "./ConditionalBlockSave"

export interface ConditionAttributes {
  module_completion: string[]
  instance_enrollment: string[]
}

const ConditionalBlockConfiguration: BlockConfiguration<ConditionAttributes> = {
  apiVersion: 3,
  title: "ConditionalBlock",
  description: "Conditionally shown block",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    module_completion: {
      type: "array",
      agentSchema: { type: "array", items: { type: "string" } },
      default: [],
    },
    instance_enrollment: {
      type: "array",
      agentSchema: { type: "array", items: { type: "string" } },
      default: [],
    },
  },
  allowedBlocks: [
    "core/heading",
    "core/buttons",
    "core/paragraph",
    "moocfi/exercise-custom-view-block",
    "moocfi/aside",
    "moocfi/chapter-progress",
    "moocfi/congratulations",
    "moocfi/course-chapter-grid",
    "moocfi/course-progress",
    "moocfi/exercises-in-chapter",
    "moocfi/glossary",
    "moocfi/infobox",
    "moocfi/latex",
    "moocfi/learning-objectives",
    "moocfi/pages-in-chapter",
    "moocfi/highlightbox",
    "moocfi/instructionbox",
    "moocfi/tablebox",
    "moocfi/iframe",
    "moocfi/map",
    "moocfi/author",
    "moocfi/conditional-block",
    "moocfi/top-level-pages",
    "moocfi/expandable-content",
    "moocfi/revelable-content",
    "moocfi/aside-with-image",
    "moocfi/flip-card",
    "moocfi/code-giveaway",
    "moocfi/ingress",
    "moocfi/terminology-block",
  ],
  edit: ConditionalBlockEditor,
  save: ConditionalBlockSave,
}

export default ConditionalBlockConfiguration
