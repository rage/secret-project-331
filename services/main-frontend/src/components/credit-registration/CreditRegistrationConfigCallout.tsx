"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CourseModuleCreditRegistrationConfig } from "@/generated/api/types.generated"
import { Badge, Infobox, Link } from "@/shared-module/components"

import { TONE } from "./constants"
import { monospaceCss, noteCss } from "./styles"

interface Props {
  config: CourseModuleCreditRegistrationConfig | undefined
  /** Names the module in the heading, for callers that show several modules at once. */
  moduleName?: string
  /** Where the fields are edited, for callers that are not already on that page. */
  fixHref?: string
}

const chipsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.5rem 0;
`

const diagnosticCss = css`
  margin: 0;
  font-size: 0.8125rem;
`

/**
 * What the last configuration check found for one module, or nothing when there is nothing to say.
 *
 * A module that has never been checked gets a neutral line rather than a warning: the pipeline
 * leaves the checks unknown until it has listed the course at least once, and an unchecked module is
 * not a broken one.
 */
const CreditRegistrationConfigCallout: React.FC<Props> = ({ config, moduleName, fixHref }) => {
  const { t } = useTranslation()
  if (!config?.enable_credit_registration_via_suotar) {
    return null
  }
  if (!config.credit_registration_config_checked_at) {
    return <Infobox tone={TONE.INFO}>{t("credit-registration-config-never-checked")}</Infobox>
  }
  if (!config.credit_registration_config_check_message) {
    return null
  }
  const courseCodeFailed = config.credit_registration_course_code_resolves === false
  const productTokenMissing = config.credit_registration_product_token_found === false

  return (
    <Infobox
      tone={TONE.WARNING}
      heading={
        moduleName
          ? t("heading-credit-registration-config-problem-in-module", { module: moduleName })
          : t("heading-credit-registration-config-problem")
      }
    >
      <div className={chipsCss}>
        <Badge tone={courseCodeFailed ? TONE.WARNING : TONE.NEUTRAL}>
          {courseCodeFailed
            ? t("credit-registration-config-course-code-unknown")
            : t("credit-registration-config-course-code-resolves")}
        </Badge>
        <Badge tone={productTokenMissing ? TONE.WARNING : TONE.NEUTRAL}>
          {productTokenMissing
            ? t("credit-registration-config-no-product-token")
            : t("credit-registration-config-product-token-found")}
        </Badge>
      </div>
      <p className={noteCss}>{t("credit-registration-config-diagnostic-for-support")}</p>
      {/* Written for an integrator and stored untranslated; it is what a teacher quotes to support. */}
      <p className={cx(noteCss, monospaceCss, diagnosticCss)}>
        {config.credit_registration_config_check_message}
      </p>
      {fixHref && <Link href={fixHref}>{t("link-edit-course-modules")}</Link>}
    </Infobox>
  )
}

export default CreditRegistrationConfigCallout
