"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useContext, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  fetchCustomPrivacyPolicyCheckboxTexts,
  fetchUserMarketingConsent,
} from "@/services/course-material/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

interface SelectMarketingConsentFormProps {
  courseId: string
  dialogLanguage: string
  onEmailSubscriptionConsentChange: (isChecked: boolean) => void
  onMarketingConsentChange: (isChecked: boolean) => void
}

const SelectMarketingConsentForm: React.FC<SelectMarketingConsentFormProps> = ({
  courseId,
  dialogLanguage,
  onEmailSubscriptionConsentChange,
  onMarketingConsentChange,
}) => {
  const { t } = useTranslation("main-frontend", { lng: dialogLanguage })
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [emailSubscriptionConsent, setEmailSubscriptionConsent] = useState(false)
  const loginStateContext = useContext(LoginStateContext)

  const initialMarketingConsentQuery = useQuery({
    queryKey: ["marketing-consent", courseId],
    queryFn: () => fetchUserMarketingConsent(assertNotNullOrUndefined(courseId)),
    enabled: courseId !== undefined && loginStateContext.signedIn === true,
  })

  const customPrivacyPolicyCheckboxTextsQuery = useQuery({
    queryKey: ["customPrivacyPolicyCheckboxTexts", courseId],
    queryFn: () => fetchCustomPrivacyPolicyCheckboxTexts(courseId),
    enabled: courseId !== undefined && dialogLanguage !== undefined,
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
    if (initialMarketingConsentQuery.isSuccess) {
      setMarketingConsent(initialMarketingConsentQuery.data?.consent ?? false)
      const emailSub =
        initialMarketingConsentQuery.data?.email_subscription_in_mailchimp === "subscribed"
      setEmailSubscriptionConsent(emailSub)
    }
  }, [initialMarketingConsentQuery.data, initialMarketingConsentQuery.isSuccess])

  const marketingConsentCheckboxText = useMemo(() => {
    if (customPrivacyPolicyCheckboxTextsQuery.isSuccess) {
      const customText = customPrivacyPolicyCheckboxTextsQuery.data.find(
        (text) => text.text_slug === "marketing-consent",
      )
      if (customText) {
        return sanitizeCourseMaterialHtml(customText.text_html)
      }
    }
    return t("marketing-consent-checkbox-text")
  }, [customPrivacyPolicyCheckboxTextsQuery.data, customPrivacyPolicyCheckboxTextsQuery.isSuccess])

  const marketingConsentPrivacyPolicyCheckboxText = useMemo(() => {
    if (customPrivacyPolicyCheckboxTextsQuery.isSuccess) {
      const customText = customPrivacyPolicyCheckboxTextsQuery.data.find(
        (text) => text.text_slug === "privacy-policy",
      )
      if (customText) {
        return sanitizeCourseMaterialHtml(customText.text_html)
      }
    }
    return t("marketing-consent-privacy-policy-checkbox-text")
  }, [customPrivacyPolicyCheckboxTextsQuery.data, customPrivacyPolicyCheckboxTextsQuery.isSuccess])

  if (initialMarketingConsentQuery.isLoading || customPrivacyPolicyCheckboxTextsQuery.isLoading) {
    return <Spinner variant="small" />
  }
  if (initialMarketingConsentQuery.isError || customPrivacyPolicyCheckboxTextsQuery.isError) {
    return (
      <ErrorBanner
        variant="readOnly"
        error={initialMarketingConsentQuery.error ?? customPrivacyPolicyCheckboxTextsQuery.error}
      />
    )
  }

  return (
    <>
      <CheckBox
        label={marketingConsentCheckboxText}
        labelIsRawHtml
        type="checkbox"
        checked={marketingConsent}
        onChange={handleMarketingConsentChange}
      ></CheckBox>
      <CheckBox
        label={marketingConsentPrivacyPolicyCheckboxText}
        labelIsRawHtml
        type="checkbox"
        checked={emailSubscriptionConsent}
        onChange={handleEmailSubscriptionConsentChange}
      ></CheckBox>
    </>
  )
}

export default SelectMarketingConsentForm
