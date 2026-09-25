"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCourseCreditRegistrationModuleConfigsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseModuleCreditRegistrationConfig } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"

import { CREDIT_REGISTRATION_NS, MIDDLE_DOT } from "./constants"
import { noteCss, proseCss } from "./styles"

interface Props {
  courseId: string
}

/**
 * What this course sends to Sisu, and on what settings.
 *
 * For a roster with nothing on it: an empty table says nothing about where the credits of the
 * students who do pass will go. Renders nothing until a module is on that path — a course nobody
 * has opted in must not learn the path exists from an empty state.
 */
const CreditRegistrationSetupNote: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const configsQuery = useQuery(
    getCourseCreditRegistrationModuleConfigsOptions({ path: { course_id: courseId } }),
  )
  const structureQuery = useCourseStructure(courseId)

  const configs = configsQuery.data ?? []
  const enabled = configs.filter((config) => config.enable_credit_registration_via_suotar)

  if (enabled.length === 0) {
    return null
  }

  const moduleName = (config: CourseModuleCreditRegistrationConfig): string =>
    structureQuery.data?.modules.find((module) => module.id === config.course_module_id)?.name ??
    t("default-module")
  const settings = (config: CourseModuleCreditRegistrationConfig): string =>
    [
      config.uh_course_code,
      config.ects_credits === null || config.ects_credits === undefined
        ? null
        : t("credit-registration-credits", { credits: config.ects_credits }),
    ]
      .filter(Boolean)
      .join(MIDDLE_DOT)

  return (
    <div className={proseCss}>
      {enabled.map((config) => (
        <p key={config.course_module_id} className={noteCss}>
          {t("credit-registration-set-up-for-module", { module: moduleName(config) })}{" "}
          {settings(config)}
        </p>
      ))}
    </div>
  )
}

export default CreditRegistrationSetupNote
