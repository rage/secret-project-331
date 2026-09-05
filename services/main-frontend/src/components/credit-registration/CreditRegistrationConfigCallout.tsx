"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CourseModuleCreditRegistrationConfig } from "@/generated/api/types.generated"
import { Disclosure, Infobox, Link } from "@/shared-module/components"

import { TONE } from "./constants"
import { dividedListCss, monospaceCss, noteCss, sectionCss } from "./styles"

/** One enabled module's saved credit-registration configuration, named for the callout. */
export interface CreditRegistrationConfigCalloutModule {
  moduleName: string
  config: CourseModuleCreditRegistrationConfig | undefined
}

interface Props {
  configs: CreditRegistrationConfigCalloutModule[]
  /** Where the fields are edited, for callers that are not already on that page. */
  fixHref?: string
}

/** Whether the module's saved configuration failed its last check; a module with one always has a config. */
export const hasCreditRegistrationConfigProblem = (
  config: CourseModuleCreditRegistrationConfig | undefined,
): config is CourseModuleCreditRegistrationConfig =>
  config?.enable_credit_registration_via_suotar === true &&
  Boolean(config.credit_registration_config_check_message)

/** One callout naming every enabled module whose last configuration check failed; the raw diagnostic sits behind a Disclosure. */
const CreditRegistrationConfigCallout: React.FC<Props> = ({ configs, fixHref }) => {
  const { t } = useTranslation()
  const failing = configs.flatMap(({ moduleName, config }) =>
    hasCreditRegistrationConfigProblem(config) ? [{ moduleName, config }] : [],
  )
  if (failing.length === 0) {
    return null
  }
  const shouldNameModule = configs.length > 1

  return (
    <Infobox tone={TONE.WARNING}>
      <ul className={dividedListCss}>
        {failing.map(({ moduleName, config }) => (
          <li key={moduleName} className={sectionCss}>
            <div>
              {shouldNameModule
                ? t("heading-credit-registration-config-problem-in-module", { module: moduleName })
                : t("heading-credit-registration-config-problem")}
            </div>
            {config.credit_registration_course_code_resolves === false && (
              <div>{t("credit-registration-config-course-code-unknown")}</div>
            )}
            {config.credit_registration_product_token_found === false && (
              <div>{t("credit-registration-config-no-product-token")}</div>
            )}
            {/* Written for an integrator and stored untranslated; it is what a teacher quotes to support. */}
            <Disclosure title={t("credit-registration-config-diagnostic-for-support")}>
              <div className={cx(noteCss, monospaceCss)}>
                {config.credit_registration_config_check_message}
              </div>
            </Disclosure>
          </li>
        ))}
      </ul>
      {fixHref && <Link href={fixHref}>{t("link-edit-course-modules")}</Link>}
    </Infobox>
  )
}

export default CreditRegistrationConfigCallout
