import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import PageContext from "../../contexts/PageContext"
import { fetchCourseById, fetchCourseLanguageVersions } from "../../services/backend"
import Language, {
  DEFAULT_FLAG_CLIP_PATH,
} from "../../shared-module/components/LanguageSelection/Language"
import languageCodesToNamesList from "../modals/LanguageCodesToNames.json"

export const formatLanguageVersionsQueryKey = (courseId: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  return `course-${courseId}-language-versions`
}

export const formatCourseQueryKey = (courseId: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  return `courses-${courseId}`
}

const FigureOutNewUrl = (selectedLangCourseId: string) => {
  const course = useQuery([formatCourseQueryKey(selectedLangCourseId)], () =>
    fetchCourseById(selectedLangCourseId ?? ""),
  )
  const pageState = useContext(PageContext)
  const currentPagePath = pageState.pageData?.url_path ?? ""
  const orgSlug = window.location.pathname.split("/")
  const newUrl = window.location.origin.concat(
    "/",
    orgSlug[1],
    "/",
    orgSlug[2],
    "/",
    orgSlug[3],
    "/",
    course.data?.slug || "",
    currentPagePath,
  )
  return newUrl
}

const FigureOutNewLangCode = (selectedLangCourseId: string) => {
  const course = useQuery([formatCourseQueryKey(selectedLangCourseId)], () =>
    fetchCourseById(selectedLangCourseId ?? ""),
  )
  return course.data?.language_code
}

const FigureOutNewCourseId = (newLangCode: string) => {
  const pageState = useContext(PageContext)
  const currentCourseId = pageState.pageData?.course_id

  const CourseLanguageVersionsList = useQuery(
    [formatLanguageVersionsQueryKey(currentCourseId ?? "")],
    () => fetchCourseLanguageVersions(currentCourseId ?? ""),
  )
  let newCourseId = ""

  CourseLanguageVersionsList.data?.map((course) => {
    if (course.language_code === newLangCode) {
      newCourseId = course.id
    }
  })

  return newCourseId
}

const GetLanguageName = (languageCode: string): string => {
  const langCode = languageCode.split("-")[0]
  const languageObject = Object.entries(languageCodesToNamesList).find(([k, _]) => {
    return k === langCode
  })
  const nativeLanguageName = languageObject ? languageObject[1].nativeName : ""
  const nativeNameUppercase =
    nativeLanguageName.charAt(0).toUpperCase() + nativeLanguageName.slice(1)
  return nativeNameUppercase
}

const GetLanguageFlag = (LangCode: string) => {
  const LanguageComponent = Language[LangCode]

  return (
    <div>
      {LanguageComponent && (
        <LanguageComponent.image
          className={css`
            width: 37px;
            height: 37px;
            clip-path: ${LanguageComponent.clipPath ?? DEFAULT_FLAG_CLIP_PATH};
            margin-left: 35px;
          `}
        />
      )}
    </div>
  )
}

export {
  FigureOutNewUrl,
  FigureOutNewLangCode,
  FigureOutNewCourseId,
  GetLanguageName,
  GetLanguageFlag,
}
