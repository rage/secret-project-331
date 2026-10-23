"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import AuthorInnerBlockEditor from "./AuthorInnerBlockEditor"
import AuthorInnerBlockSave from "./AuthorInnerBlockSave"

const AuthorInnerBlockConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: "AuthorInnerBlock",
  description: "Author InnerBlock",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  parent: ["moocfi/author"],
  innerBlocksArea: {
    template: [
      [
        "core/columns",
        { isStackedOnMobile: true },
        [
          ["core/column", {}, [["core/image", {}]]],
          [
            "core/column",
            {},
            [["core/paragraph", { placeholder: "Insert author's bio text...", align: "left" }]],
          ],
        ],
      ],
    ],
    templateLock: "insert",
  },
  edit: AuthorInnerBlockEditor,
  save: AuthorInnerBlockSave,
}

export default AuthorInnerBlockConfiguration
