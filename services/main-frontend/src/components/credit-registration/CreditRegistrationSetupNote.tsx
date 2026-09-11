"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCourseCreditRegistrationModuleConfigsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseModuleCreditRegistrationConfig } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import { Link } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, MIDDLE_DOT } from "./constants"
import { noteCss, proseCss, rowCss } from "./styles"

interface Props {
  courseId: string
}

/**
 * Whether this course sends credits to Sisu at all, and on what settings.
 *
 * For a roster with nothing on it: an empty table cannot distinguish "nobody has passed yet" from
 * "credit registration was never switched on", and those call for opposite responses.
 */
const CreditRegistrationSetupNote: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const configsQuery = useQuery(
    getCourseCreditRegistrationModuleConfigsOptions({ path: { course_id: courseId } }),
  )
  const structureQuery = useCourseStructure(courseId)

  const configs = configsQuery.data?.modules ?? []
  const enabled = configs.filter((config) => config.enable_credit_registration_via_suotar)
  const modulesRoute = manageCourseModulesRoute(courseId)

  if (configsQuery.isPending) {
    return null
  }
  if (enabled.length === 0) {
    return (
      <p className={rowCss}>
        <span className={noteCss}>{t("credit-registration-not-set-up-for-this-course")}</span>
        <Link href={modulesRoute}>{t("link-edit-course-modules")}</Link>
      </p>
    )
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
