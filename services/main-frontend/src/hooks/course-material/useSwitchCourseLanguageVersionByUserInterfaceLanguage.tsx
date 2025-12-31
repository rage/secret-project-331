"use client"
import { useRouter } from "next/navigation"
import { useContext, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import useCourseLanguageVersionNavigationInfos from "./useCourseLanguageVersionNavigationInfos"

import PageContext from "@/contexts/course-material/PageContext"
import { buildLanguageSwitchedUrl } from "@/utils/course-material/urlBuilder"

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`
}

const useSwitchCourseLanguageVersionByUserInterfaceLanguage = () => {
  const pageState = useContext(PageContext)
  const { pageData, course } = pageState
  const { i18n } = useTranslation()
  const router = useRouter()
  const hasRedirectedRef = useRef(false)

  const courseLanguageVersionsQuery = useCourseLanguageVersionNavigationInfos(
    course?.id,
    pageData?.id,
  )

  useEffect(() => {
    if (!course?.id || !pageData?.id || !courseLanguageVersionsQuery.data) {
      return
    }

    const currentCourseLanguageCode = course.language_code
    const userInterfaceLanguage = i18n.language

    if (!currentCourseLanguageCode || !userInterfaceLanguage) {
      return
    }

    if (currentCourseLanguageCode === userInterfaceLanguage) {
      hasRedirectedRef.current = false
      return
    }

    if (hasRedirectedRef.current) {
      return
    }

    const matchingLanguageVersion = courseLanguageVersionsQuery.data.find(
      (version) => version.language_code === userInterfaceLanguage,
    )

    if (!matchingLanguageVersion) {
      return
    }

    const currentUrl = window.location.href
    const newUrl = buildLanguageSwitchedUrl(
      currentUrl,
      matchingLanguageVersion.course_slug,
      matchingLanguageVersion.page_path,
    )

    const normalizedCurrentUrl = normalizeUrl(currentUrl)
    const normalizedTargetUrl = normalizeUrl(newUrl)

    if (normalizedCurrentUrl !== normalizedTargetUrl) {
      hasRedirectedRef.current = true
      const url = new URL(newUrl)
      router.push(url.pathname + url.search)
    }
  }, [
    course?.id,
    course?.language_code,
    pageData?.id,
    courseLanguageVersionsQuery.data,
    courseLanguageVersionsQuery.isLoading,
    courseLanguageVersionsQuery.error,
    i18n.language,
    router,
  ])
}

export default useSwitchCourseLanguageVersionByUserInterfaceLanguage
