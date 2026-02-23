"use client"

import { css } from "@emotion/css"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { StudentsContextProvider, useStudentsContext } from "./StudentsContext"
import * as styles from "./StudentsPageStyles"

import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { manageCourseStudentsRoute } from "@/shared-module/common/utils/routes"

const DOWN_SYMBOL = "▼"

const KEY_USERS = "users"
const KEY_COMPLETIONS = "completions"
const KEY_PROGRESS = "progress"
const KEY_CERTIFICATES = "certificates"

const tableSection = css`
  padding-left: 0;
  padding-right: 0;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  width: 100%;

  ${respondToOrLarger.md} {
    padding-left: 16px;
    padding-right: 16px;
  }

  ${respondToOrLarger.lg} {
    padding-left: 2vw;
    padding-right: 2vw;
  }

  ${respondToOrLarger.xl} {
    padding-left: 4vw;
    padding-right: 4vw;
  }
`

function StudentsLayoutContent({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const { t } = useTranslation()
  const { inputValue, setSearchQuery } = useStudentsContext()

  const crumbs = useMemo(
    () => [
      {
        isLoading: false as const,
        label: t("label-students"),
        href: `${manageCourseStudentsRoute(courseId)}/users`,
      },
    ],
    [courseId, t],
  )

  useRegisterBreadcrumbs({ key: `course:${courseId}:students`, order: 30, crumbs })

  const tabs = useMemo((): RouteTabDefinition[] => {
    const base = manageCourseStudentsRoute(courseId)
    return [
      { key: KEY_USERS, title: t("users"), href: `${base}/${KEY_USERS}` },
      { key: KEY_COMPLETIONS, title: t("completions"), href: `${base}/${KEY_COMPLETIONS}` },
      { key: KEY_PROGRESS, title: t("progress"), href: `${base}/${KEY_PROGRESS}` },
      { key: KEY_CERTIFICATES, title: t("certificates"), href: `${base}/${KEY_CERTIFICATES}` },
    ]
  }, [courseId, t])

  return (
    <BreakFromCentered sidebar={false}>
      <div>
        <div className={styles.headerTopSection}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerTitleWrap}>
              <div className={styles.title}>{t("label-students")}</div>
              <div className={styles.chatbotInfo}>{t("chatbot-student-page-info")}</div>
            </div>
            <div className={styles.dropdownTop}>
              {t("all-instances")}
              <span className={styles.dropdownIcon}>{DOWN_SYMBOL}</span>
            </div>
          </div>
          <hr className={styles.divider} />
        </div>

        <div className={styles.headerControlsSection}>
          <div className={styles.controlsRow}>
            <div className={styles.searchBoxWrap}>
              <input
                className={styles.searchInput}
                placeholder={t("search-students")}
                value={inputValue}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className={styles.searchIcon}>🔍</span>
            </div>

            <RouteTabList tabs={tabs} />
          </div>
        </div>

        <div className={tableSection}>{children}</div>
      </div>
    </BreakFromCentered>
  )
}

export default function StudentsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const courseId = params.id

  return (
    <StudentsContextProvider courseId={courseId}>
      <StudentsLayoutContent>{children}</StudentsLayoutContent>
    </StudentsContextProvider>
  )
}
