"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import LogoLinkEditor from "./LogoLinkEditor"
import LogoLinkSave from "./LogoLinkSave"

const LogoLinkConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: "Logo Link",
  description: "Logo Link",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  allowedBlocks: ["core/image", "core/columns"],
  innerBlocksArea: {
    template: [
      [
        "core/columns",
        { isStackedOnMobile: true },
        [
          ["core/column", {}, [["core/image"]]],
          ["core/column", {}, [["core/image"]]],
          ["core/column", {}, [["core/image"]]],
        ],
      ],
    ],
    templateLock: "all",
  },
  edit: LogoLinkEditor,
  save: LogoLinkSave,
}

export default LogoLinkConfiguration
