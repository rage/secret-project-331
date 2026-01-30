"use client"

import { useAtomValue } from "jotai"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { useCourseLanguageVersions } from "./useCourseLanguageVersions"

import { getDir } from "@/shared-module/common/hooks/useLanguage"
import { courseMaterialAtom } from "@/state/course-material"
import { currentPageDataAtom } from "@/state/course-material/selectors"
import { courseLanguagePreferenceAtom } from "@/state/courseLanguagePreference"
import { normalizeUrl } from "@/utils/course-material/urlBuilder"

function updateHtmlLangAttribute(languageCode: string) {
  const htmlElement = document.documentElement
  if (!htmlElement) {
    return
  }

  const newDir = getDir(languageCode)
  const currentLang = htmlElement.getAttribute("lang")
  const currentDir = htmlElement.getAttribute("dir")

  if (currentLang !== languageCode) {
    htmlElement.setAttribute("lang", languageCode)
    console.info(`Updated HTML lang attribute: ${currentLang} → ${languageCode}`)
  }

  if (currentDir !== newDir) {
    htmlElement.setAttribute("dir", newDir)
    console.info(`Updated HTML dir attribute: ${currentDir} → ${newDir}`)
  }
}

/**
 * Behavior hook for automatic course material language redirection.
 * Watches courseLanguagePreferenceAtom and redirects when preference changes.
 * This is the ONLY place where course material language redirects should happen.
 */
const useCourseMaterialLanguageRedirection = () => {
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const currentPageData = useAtomValue(currentPageDataAtom)
  const currentCourse = courseMaterialState.course
  const languagePreference = useAtomValue(courseLanguagePreferenceAtom)
  const { i18n } = useTranslation()
  const router = useRouter()
  const hasRedirectedRef = useRef(false)

  const { getLanguageUrl, queryData } = useCourseLanguageVersions({
    currentCourseId: currentCourse?.id ?? null,
    currentPageId: currentPageData?.id ?? null,
  })

  // Reset redirect ref when course changes
  useEffect(() => {
    hasRedirectedRef.current = false
  }, [currentCourse?.id])

  useEffect(() => {
    if (!currentCourse?.id || !currentPageData?.id || !queryData) {
      return
    }

    const currentCourseLanguageCode = currentCourse.language_code

    if (!currentCourseLanguageCode) {
      console.warn(
        `Course ${currentCourse.id} has no language_code, cannot handle language preference`,
      )
      return
    }

    if (languagePreference === "same-as-course") {
      if (i18n.language !== currentCourseLanguageCode) {
        console.info(
          `Syncing UI language to course language: ${i18n.language} → ${currentCourseLanguageCode}`,
        )
        i18n.changeLanguage(currentCourseLanguageCode)
      }
      updateHtmlLangAttribute(currentCourseLanguageCode)
      hasRedirectedRef.current = false
      return
    }

    if (currentCourseLanguageCode === languagePreference) {
      updateHtmlLangAttribute(languagePreference)
      hasRedirectedRef.current = false
      return
    }

    if (hasRedirectedRef.current) {
      console.info(
        `Language preference changed to ${languagePreference}, but redirect already in progress`,
      )
      return
    }

    const matchingLanguageVersion = queryData.find(
      (version) => version.language_code === languagePreference,
    )

    if (!matchingLanguageVersion) {
      console.warn(
        `Language version not found for preference ${languagePreference} (current: ${currentCourseLanguageCode})`,
      )
      return
    }

    const newUrl = getLanguageUrl(languagePreference)
    if (!newUrl) {
      console.error(`Failed to generate URL for language ${languagePreference}, cannot redirect`)
      return
    }

    const currentUrl = window.location.href
    const normalizedCurrentUrl = normalizeUrl(currentUrl)
    const normalizedTargetUrl = normalizeUrl(newUrl)

    if (normalizedCurrentUrl !== normalizedTargetUrl) {
      updateHtmlLangAttribute(languagePreference)
      hasRedirectedRef.current = true
      const url = new URL(newUrl)
      console.info(
        `Redirecting to language version ${languagePreference}: ${url.pathname}${url.search}`,
      )
      try {
        router.push(url.pathname + url.search)
      } catch (err) {
        console.error(`Failed to redirect to language version ${languagePreference}:`, err)
        hasRedirectedRef.current = false
      }
    }
  }, [
    currentCourse?.id,
    currentCourse?.language_code,
    currentPageData?.id,
    queryData,
    languagePreference,
    i18n,
    router,
    getLanguageUrl,
  ])
}

export default useCourseMaterialLanguageRedirection
