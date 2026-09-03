"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useContext, useEffect, useMemo, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getCourseMaterialCustomPrivacyPolicyCheckboxTexts,
  getCourseMaterialUserMarketingConsent,
} from "@/generated/course-material-api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { Checkbox, LoadingRegion } from "@/shared-module/components"
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
  const { control, setValue } = useForm<{
    marketingConsent: boolean
    emailSubscriptionConsent: boolean
  }>({
    defaultValues: { marketingConsent: false, emailSubscriptionConsent: false },
  })
  // oxlint-disable-next-line i18next/no-literal-string
  const marketingConsent = useWatch({ control, name: "marketingConsent" })
  // oxlint-disable-next-line i18next/no-literal-string
  const emailSubscriptionConsent = useWatch({ control, name: "emailSubscriptionConsent" })
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
    setValue("marketingConsent", marketing)
    setValue("emailSubscriptionConsent", emailSub)
    initializedConsentCourseId.current = courseId
  }, [
    courseId,
    initialMarketingConsentQuery.data,
    initialMarketingConsentQuery.isSuccess,
    setValue,
  ])

  useEffect(() => {
    onMarketingConsentChange(marketingConsent)
  }, [marketingConsent, onMarketingConsentChange])

  useEffect(() => {
    onEmailSubscriptionConsentChange(emailSubscriptionConsent)
  }, [emailSubscriptionConsent, onEmailSubscriptionConsentChange])

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
    return <LoadingRegion />
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
      <Checkbox
        name="marketingConsent"
        control={control}
        label={<span dangerouslySetInnerHTML={{ __html: marketingConsentCheckboxText }} />}
      />
      <Checkbox
        name="emailSubscriptionConsent"
        control={control}
        label={
          <span dangerouslySetInnerHTML={{ __html: marketingConsentPrivacyPolicyCheckboxText }} />
        }
      />
    </>
  )
}

export default SelectMarketingConsentForm
