"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useContext, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseMaterialCustomPrivacyPolicyCheckboxTexts,
  getCourseMaterialUserMarketingConsent,
} from "@/generated/course-material-api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
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
    queryFn: () =>
      getCourseMaterialUserMarketingConsent({
        path: {
          course_id: courseId,
        },
      }),
    enabled: courseId !== undefined && loginStateContext.signedIn === true,
  })

  const customPrivacyPolicyCheckboxTextsQuery = useQuery({
    queryKey: ["customPrivacyPolicyCheckboxTexts", courseId],
    queryFn: () =>
      getCourseMaterialCustomPrivacyPolicyCheckboxTexts({
        path: {
          course_id: courseId,
        },
      }),
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

  // Initialize the saved consent values once per course. A background refetch must not re-sync them,
  // or it would silently overwrite the user's unsaved checkbox edits (and submit stale values).
  const initializedConsentCourseId = useRef<string | null>(null)
  useEffect(() => {
    if (
      !initialMarketingConsentQuery.isSuccess ||
      initializedConsentCourseId.current === courseId
    ) {
      return
    }
    const marketing = initialMarketingConsentQuery.data?.consent ?? false
    const emailSub =
      initialMarketingConsentQuery.data?.email_subscription_in_mailchimp === "subscribed"
    setMarketingConsent(marketing)
    setEmailSubscriptionConsent(emailSub)
    // Sync the parent with the saved values so it initializes correctly on (re)open.
    onMarketingConsentChange(marketing)
    onEmailSubscriptionConsentChange(emailSub)
    initializedConsentCourseId.current = courseId
  }, [
    courseId,
    initialMarketingConsentQuery.data,
    initialMarketingConsentQuery.isSuccess,
    onMarketingConsentChange,
    onEmailSubscriptionConsentChange,
  ])

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
  }, [
    customPrivacyPolicyCheckboxTextsQuery.data,
    customPrivacyPolicyCheckboxTextsQuery.isSuccess,
    t,
  ])

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
  }, [
    customPrivacyPolicyCheckboxTextsQuery.data,
    customPrivacyPolicyCheckboxTextsQuery.isSuccess,
    t,
  ])

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
