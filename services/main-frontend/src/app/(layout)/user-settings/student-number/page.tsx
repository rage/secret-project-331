"use client"

import { useRouter } from "next/navigation"
import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"

import StudentNumberCard from "@/components/credit-registration/StudentNumberCard"
import { sectionsCss } from "@/components/credit-registration/styles"
import { useIsInCreditRegistrationPipeline } from "@/components/credit-registration/useIsInCreditRegistrationPipeline"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { userSettingsRoute } from "@/shared-module/common/utils/routes"

const StudentNumberSettingsPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("heading-student-number"), { order: 10 })
  const router = useRouter()
  const isInPipeline = useIsInCreditRegistrationPipeline()

  // The tab is hidden for these students, so only a typed or stale URL lands here.
  useEffect(() => {
    if (isInPipeline === false) {
      router.replace(userSettingsRoute())
    }
  }, [isInPipeline, router])

  if (!isInPipeline) {
    return null
  }
  return (
    <div className={sectionsCss}>
      <StudentNumberCard />
    </div>
  )
}

export default StudentNumberSettingsPage
