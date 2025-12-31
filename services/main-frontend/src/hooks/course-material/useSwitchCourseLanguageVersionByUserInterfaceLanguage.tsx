"use client"
import { useAtomValue } from "jotai"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import useCourseLanguageVersionNavigationInfos from "./useCourseLanguageVersionNavigationInfos"

import { courseMaterialAtom } from "@/state/course-material"
import { currentPageDataAtom } from "@/state/course-material/selectors"
import { buildLanguageSwitchedUrl } from "@/utils/course-material/urlBuilder"

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`
}

const useSwitchCourseLanguageVersionByUserInterfaceLanguage = () => {
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const currentPageData = useAtomValue(currentPageDataAtom)
  const currentCourse = courseMaterialState.course
  const { i18n } = useTranslation()
  const router = useRouter()
  const hasRedirectedRef = useRef(false)

  const courseLanguageVersionsQuery = useCourseLanguageVersionNavigationInfos(
    currentCourse?.id,
    currentPageData?.id,
  )

  useEffect(() => {
    if (!currentCourse?.id || !currentPageData?.id || !courseLanguageVersionsQuery.data) {
      return
    }

    const currentCourseLanguageCode = currentCourse.language_code
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
    currentCourse?.id,
    currentCourse?.language_code,
    currentPageData?.id,
    courseLanguageVersionsQuery.data,
    courseLanguageVersionsQuery.isLoading,
    courseLanguageVersionsQuery.error,
    i18n.language,
    router,
  ])
}

export default useSwitchCourseLanguageVersionByUserInterfaceLanguage
