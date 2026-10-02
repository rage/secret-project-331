"use client"

/* oxlint-disable i18next/no-literal-string */
import { info } from "@wordpress/icons"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import EmailCalloutEditor from "./EmailCalloutEditor"
import EmailCalloutSave from "./EmailCalloutSave"

/** Must match `callout_icon_file` in headless-lms `email_processor.rs`. */
export const EMAIL_CALLOUT_ICONS = ["none", "info", "calendar", "warning", "check"] as const

export type EmailCalloutIcon = (typeof EMAIL_CALLOUT_ICONS)[number]

export interface EmailCalloutAttributes {
  icon: EmailCalloutIcon
  /** Rich text HTML. */
  title: string
}

const EmailCalloutConfiguration: BlockConfiguration<EmailCalloutAttributes> = {
  apiVersion: 3,
  title: "Email callout",
  description: "A highlighted box with an icon and a title, for emails.",
  category: "design",
  attributes: {
    icon: {
      type: "string",
      default: "info",
    },
    title: {
      type: "string",
      default: "",
    },
  },
  icon: info,
  edit: EmailCalloutEditor,
  save: EmailCalloutSave,
}

export default EmailCalloutConfiguration
