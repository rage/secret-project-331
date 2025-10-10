import { css } from "@emotion/css"

import languageCodesToNamesList from "../modals/LanguageCodesToNames.json"

import useCourseInfo from "@/hooks/useCourseInfo"
import Language from "@/shared-module/common/components/LanguageSelection/Language"
import { baseTheme } from "@/shared-module/common/styles"

export const formatLanguageVersionsQueryKey = (courseId: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  return `course-${courseId}-language-versions`
}

const useFigureOutNewLangCode = (selectedLangCourseId: string) => {
  const course = useCourseInfo(selectedLangCourseId)
  return course.data?.language_code
}

const getLanguageName = (languageCode: string): string => {
  if (!languageCode) {
    throw new Error("Language code is required")
  }
  const langCode = languageCode.split("-")[0]
  const languageObject = Object.entries(languageCodesToNamesList).find(([k, _]) => {
    return k === langCode
  })
  const nativeLanguageName = languageObject ? languageObject[1].nativeName : ""
  const nativeNameUppercase =
    nativeLanguageName.charAt(0).toUpperCase() + nativeLanguageName.slice(1)
  return nativeNameUppercase
}

const GetLanguageFlag = (langCode: string) => {
  const LanguageComponent = Language[langCode]

  return (
    <div
      id={"language-flag"}
      className={css`
        box-sizing: border-box;
        border: 2px solid ${baseTheme.colors.gray[200]};
        border-radius: 50%;
        overflow: hidden;
        width: 30px;
        height: 30px;
        margin-right: 10px;
        margin-top: 3px;
      `}
    >
      {LanguageComponent && (
        <LanguageComponent.image
          className={css`
            margin-left: -8px;
            height: 28px;
          `}
        />
      )}
    </div>
  )
}

export { useFigureOutNewLangCode, getLanguageName, GetLanguageFlag }
