"use client"

import { css, cx } from "@emotion/css"
import { useTabListState } from "@react-stately/tabs"
import { usePathname } from "next/navigation"
import React, { useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useTabList } from "react-aria"
import { Control, Form, FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import SectionCollapsibleHeader from "../course-plans/[id]/workspace/components/analysis-form/SectionCollapsibleHeader"
import {
  analysisSectionBodyId,
  analysisSectionHeadingId,
  SECTION_DOM_PREFIX,
  sectionAccentByIndex,
  sectionBodyStyles,
  sectionCardStyles,
  sectionNavLinkActiveStyles,
  sectionNavLinkStyles,
  staticTextStyles,
  stickyNavStyles,
  stickyToolbarStyles,
  subsectionTitleStyles,
  toolbarRowStyles,
  twoColGridStyles,
  uhCalloutStyles,
  uhCalloutTitleStyles,
  uhLineStyles,
} from "../course-plans/[id]/workspace/components/analysis-form/analysisFormDomain"

import type { CourseFilter } from "./page"

import type { AnalysisCourseType, CourseToAudit } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import {
  Button,
  Checkbox,
  ComboBox,
  nullIfEmpty,
  Select,
  TextArea,
  TextField,
} from "@/shared-module/components"

interface CourseAuditingFilterProps {
  onFilterChange: Dispatch<SetStateAction<CourseFilter>>
}

const FilterMenu: React.FC<React.PropsWithChildren<CourseAuditingFilterProps>> = ({
  onFilterChange,
}) => {
  const { t } = useTranslation()

  const [expanded, setExpanded] = useState<boolean>(false)

  const methods = useForm<CourseFilter>({
    defaultValues: {
      searchCourse: "",
      emptyUhCourseCode: false,
    },
  })

  const { control, register, handleSubmit, setValue, reset, subscribe } = methods

  useEffect(() => {
    const callback = subscribe({
      formState: {
        values: true,
      },
      callback: ({ values }) => {
        onFilterChange(values)
      },
    })
    return () => callback()
  }, [subscribe, onFilterChange])

  return (
    <section
      className={cx(sectionCardStyles, sectionAccentByIndex[0])}
      id={`${SECTION_DOM_PREFIX}1`}
      aria-labelledby={analysisSectionHeadingId(1)}
    >
      <SectionCollapsibleHeader
        sectionNum={1}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        title={t("course-auditing-filter-title")}
      />
      {expanded && (
        <div id={analysisSectionBodyId(1)} className={sectionBodyStyles}>
          <h3 className={subsectionTitleStyles}>{t("course-auditing-advanced-filter")}</h3>
          <TextField
            name="searchCourse"
            control={control}
            rules={nullIfEmpty}
            label={t("course-auditing-filter-search-course")}
          />
          <Checkbox
            name="emptyUhCourseCode"
            control={control}
            label={t("course-auditing-filter-empty-uh-course-codes")}
          />
        </div>
      )}
    </section>
  )
}

export default FilterMenu
