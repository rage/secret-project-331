/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import ChapterProgressEditor from "./ChapterProgressEditor"
import ChapterProgressSave from "./ChapterProgressSave"

const ChapterProgressConfiguration: BlockConfiguration = {
  title: "Chapter Progress",
  description: "Chapter Progress block.",
  category: "design",
  attributes: {},
  edit: ChapterProgressEditor,
  save: ChapterProgressSave,
}

export default ChapterProgressConfiguration
