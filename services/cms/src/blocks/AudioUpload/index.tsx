/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import AudioUploadEditor from "./AudioUploadEditor"
import AudioUploadSave from "./AudioUploadSave"

const AudioUploadConfiguration: BlockConfiguration = {
  title: "Upload Audio",
  description: "Upload Audio block.",
  category: MOOCFI_CATEGORY_SLUG,
  edit: AudioUploadEditor,
  save: AudioUploadSave,
  attributes: {
    src: {
      type: "string",
      default: undefined,
    },
  },
}

export default AudioUploadConfiguration
