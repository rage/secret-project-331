"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { manageCourseLanguageVersionsRoute } from "@/shared-module/common/utils/routes"
import { LanguageChip, Link, Tooltip } from "@/shared-module/components"

const chipsCss = css`
  margin-left: auto;
  display: flex;
  gap: 0.5rem;
`

interface Props {
  courseId: string
  /** Languages the item has no counterpart in. */
  languageCodes: string[]
}

/** Struck-through language chips, each with a tooltip linking to the Language versions tab. */
const MissingLanguageChips: React.FC<Props> = ({ courseId, languageCodes }) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  return (
    <div className={chipsCss}>
      {languageCodes.map((code) => (
        <Tooltip
          key={code}
          aria-label={t("language-versions-no-counterpart", { language: languageName(code) })}
          trigger={<LanguageChip code={code} missing />}
        >
          <Link href={manageCourseLanguageVersionsRoute(courseId)}>
            {t("language-versions-no-counterpart-link", { language: languageName(code) })}
          </Link>
        </Tooltip>
      ))}
    </div>
  )
}

export default MissingLanguageChips
