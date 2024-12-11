import { useQuery } from "@tanstack/react-query"
import { t } from "i18next"
import React, { useEffect, useState } from "react"

import { fetchUserMarketingConsent } from "@/services/backend"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface SelectMarketingConsentFormProps {
  courseId: string
  onEmailSubscriptionConsentChange: (isChecked: boolean) => void
  onMarketingConsentChange: (isChecked: boolean) => void
}

const SelectMarketingConsentForm: React.FC<SelectMarketingConsentFormProps> = ({
  courseId,
  onEmailSubscriptionConsentChange,
  onMarketingConsentChange,
}) => {
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [emailSubscriptionConsent, setEmailSubscriptionConsent] = useState(false)

  const fetchInitialMarketingConsent = useQuery({
    queryKey: ["marketing-consent", courseId],
    queryFn: () => fetchUserMarketingConsent(assertNotNullOrUndefined(courseId)),
    enabled: courseId !== undefined,
  })

  const handleEmailSubscriptionConsentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked
    onEmailSubscriptionConsentChange(isChecked)
    setEmailSubscriptionConsent(isChecked)
  }

  const handleMarketingConsentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked
    onMarketingConsentChange(isChecked)
    setMarketingConsent(isChecked)
  }

  useEffect(() => {
    if (fetchInitialMarketingConsent.isSuccess) {
      setMarketingConsent(fetchInitialMarketingConsent.data.consent)
      const emailSub =
        fetchInitialMarketingConsent.data.email_subscription_in_mailchimp === "subscribed"
      setEmailSubscriptionConsent(emailSub)
    }
  }, [fetchInitialMarketingConsent.data, fetchInitialMarketingConsent.isSuccess])

  return (
    <>
      <CheckBox
        label={t("marketing-consent-checkbox-text")}
        type="checkbox"
        checked={marketingConsent}
        onChange={handleMarketingConsentChange}
      ></CheckBox>
      <CheckBox
        label={t("marketing-consent-privacy-policy-checkbox-text")}
        type="checkbox"
        checked={emailSubscriptionConsent}
        onChange={handleEmailSubscriptionConsentChange}
      ></CheckBox>
    </>
  )
}

export default SelectMarketingConsentForm
