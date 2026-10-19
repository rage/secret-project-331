"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { CopyButton } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "./constants"
import { codeValueCss } from "./styles"

/**
 * A Sisu course code with its copy button, for a `Trans` component slot.
 *
 * A component rather than inline markup, so `Trans` keeps the copy button when it fills the tag.
 */
export const SisuCourseCode: React.FC<{ code: string }> = ({ code }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <>
      <span className={codeValueCss}>{code}</span>{" "}
      <CopyButton value={code} label={t("button-text-copy-sisu-course-code")} />
    </>
  )
}
