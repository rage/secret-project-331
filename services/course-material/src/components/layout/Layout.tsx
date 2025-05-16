import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import LayoutContext from "../../contexts/LayoutContext"
import PageContext, { getDefaultPageState } from "../../contexts/PageContext"
import useCourseLanguageVersions from "../../hooks/useCourseLanguageVersions"
import { PageState } from "../../reducers/pageStateReducer"
import SearchDialog from "../SearchDialog"
import { useFigureOutNewUrl } from "../modals/ChooseCourseLanguage"
import UserNavigationControls from "../navigation/UserNavigationControls"

import PartnersSectionBlock from "./PartnersSection"
import ScrollIndicator from "./ScrollIndicator"

import { fetchPrivacyLink } from "@/services/backend"
import Centered from "@/shared-module/common/components/Centering/Centered"
import Footer from "@/shared-module/common/components/Footer"
import LanguageSelection, {
  LanguageOption,
} from "@/shared-module/common/components/LanguageSelection"
import {
  NavBar,
  NavContainer,
  NavItem,
  NavItems,
} from "@/shared-module/common/components/Navigation/NavBar"
import { getDir } from "@/shared-module/common/hooks/useLanguage"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import withNoSsr from "@/shared-module/common/utils/withNoSsr"

const LANGUAGE_SELECTION_PLACEMENTPLACEMENT = "bottom-end"

interface LayoutProps {
  children: ReactNode
}

const DynamicToaster = dynamicImport(
  () => import("@/shared-module/common/components/Notifications/ToasterNotifications"),
)

const DEFAULT_TITLE = process.env.NEXT_PUBLIC_SITE_TITLE ?? "Secret Project 331"

const Layout: React.FC<React.PropsWithChildren<LayoutProps>> = ({ children }) => {
  const router = useRouter()
  const { i18n } = useTranslation()

  const [title, setTitle] = useState<string | null>(null)
  const fullTitle = title ? `${title} - ${DEFAULT_TITLE}` : DEFAULT_TITLE
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [hideFromSearchEngines, setHideFromSearchEngines] = useState<boolean>(false)
  const [pageState, setPageState] = useState<PageState>(getDefaultPageState())
  // When set, this will trigger a redirect to the same page in the selected language
  const [changeLanguageToThisCourseId, setChangeLanguageToThisCourseId] = useState<string | null>(
    null,
  )
  const getPrivacyLink = useQuery({
    queryKey: ["privacy-link", courseId],
    queryFn: () => fetchPrivacyLink(courseId as NonNullable<string>),
    enabled: !!courseId,
  })

  const customPrivacyLinks =
    getPrivacyLink.isSuccess && Array.isArray(getPrivacyLink.data)
      ? getPrivacyLink.data.map((link) => ({
          linkTitle: link.title,
          linkUrl: link.url,
        }))
      : []

  const languageVersions = useCourseLanguageVersions(courseId)
  const languages: LanguageOption[] = (languageVersions?.data ?? []).map((languageVersion) => ({
    tag: languageVersion.language_code,
    name: ietfLanguageTagToHumanReadableName(languageVersion.language_code),
  }))
  const currentLanguageVersion = languageVersions.data?.find(
    (languageVersionCourse) => languageVersionCourse.id === courseId,
  )
  const currentLanguageCode = currentLanguageVersion?.language_code

  const changedLanguageUrl = useFigureOutNewUrl(
    changeLanguageToThisCourseId,
    pageState.pageData?.page_language_group_id ?? null,
  )

  useEffect(() => {
    const hrefWithSlash = `${document.location.href}/`
    if (
      changedLanguageUrl !== null &&
      document.location.href !== changedLanguageUrl &&
      hrefWithSlash !== changedLanguageUrl
    ) {
      console.info(`Redirecting to ${changedLanguageUrl} from ${document.location.href}`)
      setChangeLanguageToThisCourseId(null)
      router.push(changedLanguageUrl)
    }
  }, [changedLanguageUrl, router])

  useEffect(() => {
    if (!currentLanguageCode) {
      return
    }
    if (i18n.language !== currentLanguageCode) {
      i18n.changeLanguage(currentLanguageCode)
    }
    const htmlElement = document.querySelector("html")
    if (!htmlElement || !currentLanguageCode) {
      return
    }
    setTimeout(() => {
      htmlElement.setAttribute("lang", currentLanguageCode)

      htmlElement.setAttribute("dir", getDir(currentLanguageCode))
    }, 100)
  }, [currentLanguageCode, i18n])

  const layoutContextValue = useMemo(() => {
    return {
      title,
      setTitle,
      organizationSlug,
      setOrganizationSlug,
      courseId,
      setCourseId,
      hideFromSearchEngines,
      setHideFromSearchEngines,
      setPageState,
    }
  }, [courseId, hideFromSearchEngines, organizationSlug, title])
  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />

        {hideFromSearchEngines && <meta name="robots" content="noindex" />}
      </Head>
      <div
        // Push footer to bottom of page, e.g. on empty body
        className={css`
          height: 100%;
          min-height: 100vh;
        `}
      >
        <ScrollIndicator />
        <PageContext.Provider value={pageState}>
          <NavBar variant={"simple"}>
            <NavContainer>
              <NavItems>
                {courseId && organizationSlug && (
                  <NavItem>
                    <SearchDialog courseId={courseId} organizationSlug={organizationSlug} />
                  </NavItem>
                )}
                <NavItem>
                  <LanguageSelection
                    placement={LANGUAGE_SELECTION_PLACEMENTPLACEMENT}
                    languages={languages}
                    handleLanguageChange={(newLanguage) => {
                      console.info("Language changing to", newLanguage)
                      if (!languageVersions.data) {
                        console.error("No language versions found")
                        return
                      }
                      const newLanguageVersion = languageVersions.data.find(
                        (languageVersion) => languageVersion.language_code === newLanguage,
                      )
                      if (!newLanguageVersion) {
                        console.error("No language version found for", newLanguage)
                        return
                      }
                      setChangeLanguageToThisCourseId(newLanguageVersion.id)
                    }}
                  />
                </NavItem>
              </NavItems>
            </NavContainer>
            <UserNavigationControls currentPagePath={router.asPath} courseId={courseId} />
          </NavBar>
        </PageContext.Provider>

        <main>
          <Centered variant="narrow">
            <LayoutContext.Provider value={layoutContextValue}>{children}</LayoutContext.Provider>
          </Centered>
        </main>
      </div>
      <div
        className={css`
          margin-top: 2rem;
        `}
      >
        <DynamicToaster />
        {courseId && <PartnersSectionBlock courseId={courseId} />}
        <Footer privacyLinks={customPrivacyLinks} />
      </div>
    </>
  )
}

export default withNoSsr(Layout)
