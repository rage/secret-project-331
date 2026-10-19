"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import EmailTeacherNewsletterEditor from "./EmailTeacherNewsletterEditor"
import EmailTeacherNewsletterSave from "./EmailTeacherNewsletterSave"

const EmailTeacherNewsletterConfiguration: BlockConfiguration = {
  apiVersion: 3,
  title: "Teacher newsletter",
  description: "Teacher newsletter block",
  category: "design",
  edit: EmailTeacherNewsletterEditor,
  save: EmailTeacherNewsletterSave,
  attributes: {
    summary: {
      type: "string",
      default: "{{SUMMARY}}",
    },
  },
}

export default EmailTeacherNewsletterConfiguration
