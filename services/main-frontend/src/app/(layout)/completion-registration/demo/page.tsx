"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS, TONE } from "@/components/credit-registration/constants"
import { narrowPageCss } from "@/components/credit-registration/styles"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { postAuthAuthorize } from "@/shared-module/common/generated/auth-api/sdk.generated"
import "@/shared-module/common/init/registerAuthApiClients"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Infobox, QueryResult } from "@/shared-module/components"

import CreditRegistrationDemo from "./CreditRegistrationDemo"

/** Students have no use for the demo and would read its made-up registration as their own. */
const CreditRegistrationDemoPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const accessQuery = useQuery({
    queryKey: ["credit-registration-demo-access"],
    queryFn: () =>
      postAuthAuthorize({
        body: {
          action: { type: "view_credit_registration_demo" },
          resource: { type: "any_course" },
        },
      }),
  })
  return (
    <QueryResult query={accessQuery}>
      {(canView) =>
        canView ? (
          <CreditRegistrationDemo />
        ) : (
          <div className={narrowPageCss}>
            <Infobox tone={TONE.INFO}>{t("credit-registration-demo-no-access")}</Infobox>
          </div>
        )
      }
    </QueryResult>
  )
}

export default withErrorBoundary(withSignedIn(CreditRegistrationDemoPage))
