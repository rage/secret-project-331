"use client"

/* oxlint-disable i18next/no-literal-string */
import { code } from "@wordpress/icons"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import EmailOneTimeCodeEditor from "./EmailOneTimeCodeEditor"
import EmailOneTimeCodeSave from "./EmailOneTimeCodeSave"

/** What an email one-time code block stores. */
export interface EmailOneTimeCodeAttributes {
  /** Plain text; usually the `{{CODE}}` placeholder. */
  code: string
}

const EmailOneTimeCodeConfiguration: BlockConfiguration<EmailOneTimeCodeAttributes> = {
  apiVersion: 3,
  title: "One-time code",
  description: "A highlighted, easy-to-copy code for emails.",
  category: "design",
  attributes: {
    code: {
      type: "string",
      default: "{{CODE}}",
    },
  },
  supports: {
    html: false,
    customClassName: false,
  },
  icon: code,
  edit: EmailOneTimeCodeEditor,
  save: EmailOneTimeCodeSave,
}

export default EmailOneTimeCodeConfiguration
