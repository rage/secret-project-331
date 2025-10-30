import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import styles from "./StudentsPage.module.css"
import { CertificatesTabContent, CompletionsTabContent, UserTabContent } from "./StudentsTableTabs"
import { ProgressTabContent } from "./tabs/ProgressTab"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"

type Props = { courseId?: string; initialTab?: string }

const tableSection = css({
  paddingLeft: "5vw",
  paddingRight: "5vw",
})

const DOWN_SYMBOL = "▼"

// ---- Tabs
const TAB_USER = "User"
const TAB_COMPLETIONS = "Completions"
const TAB_PROGRESS = "Progress"
const TAB_CERTIFICATES = "Certificates"
const TAB_LIST = [TAB_USER, TAB_COMPLETIONS, TAB_PROGRESS, TAB_CERTIFICATES] as const

const TAB_TO_SLUG: Record<(typeof TAB_LIST)[number], string> = {
  [TAB_USER]: "users",
  [TAB_COMPLETIONS]: "completions",
  [TAB_PROGRESS]: "progress",
  [TAB_CERTIFICATES]: "certificates",
}
const SLUG_TO_TAB: Record<string, (typeof TAB_LIST)[number]> = {
  users: TAB_USER,
  completions: TAB_COMPLETIONS,
  progress: TAB_PROGRESS,
  certificates: TAB_CERTIFICATES,
}

const cx = (...arr: Array<string | false | undefined>) => arr.filter(Boolean).join(" ")

const StudentsPage: React.FC<Props> = ({ courseId: courseIdProp, initialTab }) => {
  const { t } = useTranslation()
  const router = useRouter()

  // derive courseId from prop (preferred) or from router as fallback
  const courseId =
    courseIdProp ?? (typeof router.query?.id === "string" ? router.query.id : undefined)

  // read initial tab from parent/router (e.g. "progress" in /students/progress)
  const tabFromUrl = useMemo<(typeof TAB_LIST)[number]>(() => {
    return SLUG_TO_TAB[initialTab ?? ""] ?? TAB_USER
  }, [initialTab])

  const [activeTab, setActiveTab] = useState<(typeof TAB_LIST)[number]>(tabFromUrl)

  // keep UI in sync if URL changes (back/forward)
  useEffect(() => {
    setActiveTab(tabFromUrl)
  }, [tabFromUrl])

  // if user lands on /students (no subtab), gently normalize to /students/users
  useEffect(() => {
    if (!initialTab && courseId) {
      // eslint-disable-next-line i18next/no-literal-string
      router.replace(`/manage/courses/${courseId}/students/users`, undefined, {
        shallow: true,
        scroll: false,
      })
    }
  }, [initialTab, courseId, router])

  const goTab = (tab: (typeof TAB_LIST)[number]) => {
    setActiveTab(tab)
    if (!courseId) {
      return
    }
    const slug = TAB_TO_SLUG[tab]
    // eslint-disable-next-line i18next/no-literal-string
    router.push(`/manage/courses/${courseId}/students/${slug}`, undefined, {
      shallow: true,
      scroll: false,
    })
  }

  const tabContentMap: { [k in (typeof TAB_LIST)[number]]: React.ReactNode } = {
    [TAB_USER]: courseId ? <UserTabContent courseId={courseId} /> : null,
    [TAB_COMPLETIONS]: courseId ? <CompletionsTabContent courseId={courseId} /> : null,
    [TAB_PROGRESS]: courseId ? <ProgressTabContent courseId={courseId} /> : null,
    [TAB_CERTIFICATES]: <CertificatesTabContent />,
  }

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
              <input className={styles.searchInput} placeholder={t("search-students")} />
              <span className={styles.searchIcon}>🔍</span>
            </div>

            <div className={styles.tabsWrap}>
              {TAB_LIST.map((tab, i) => (
                <button
                  key={tab}
                  className={cx(
                    styles.tab,
                    i === TAB_LIST.length - 1 && styles.tabLast,
                    tab === TAB_COMPLETIONS && styles.tabCompletions,
                    activeTab === tab && styles.tabActive,
                  )}
                  onClick={() => goTab(tab)} // URL-syncing click
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TABLE SECTION */}
        <div className={tableSection}>{tabContentMap[activeTab]}</div>
      </div>
    </BreakFromCentered>
  )
}

export default StudentsPage
