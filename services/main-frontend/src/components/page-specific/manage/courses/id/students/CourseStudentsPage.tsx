import { css } from "@emotion/css"
import { usePathname, useRouter } from "next/navigation"
import React, { useEffect, useMemo, useState, useTransition } from "react"
import { useTranslation } from "react-i18next"

import * as styles from "./StudentsPageStyles"
import { CertificatesTabContent, CompletionsTabContent, UserTabContent } from "./StudentsTableTabs"
import { ProgressTabContent } from "./tabs/ProgressTab"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { manageCourseStudentsRoute } from "@/shared-module/common/utils/routes"

type Props = { courseId?: string }

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

const StudentsPage: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()

  const subtabFromUrl = useMemo(() => {
    const m = pathname?.match(/\/students\/([^/?#]+)/)
    return m?.[1] // e.g. "users" | "completions" | "progress" | "certificates"
  }, [pathname])

  const tabFromUrl = useMemo<(typeof TAB_LIST)[number]>(() => {
    return SLUG_TO_TAB[subtabFromUrl ?? ""] ?? TAB_USER
  }, [subtabFromUrl])

  const [activeTab, setActiveTab] = useState<(typeof TAB_LIST)[number]>(tabFromUrl)
  const [inputValue, setInputValue] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [_isPending, startTransition] = useTransition()

  useEffect(() => {
    setActiveTab(tabFromUrl)
  }, [tabFromUrl])

  useEffect(() => {
    if (!subtabFromUrl && courseId) {
      // eslint-disable-next-line i18next/no-literal-string
      router.replace(manageCourseStudentsRoute(courseId, "users"))
    }
  }, [subtabFromUrl, courseId, router])

  const goTab = (tab: (typeof TAB_LIST)[number]) => {
    setActiveTab(tab)
    if (!courseId) {
      return
    }
    const slug = TAB_TO_SLUG[tab]
    router.push(manageCourseStudentsRoute(courseId, slug))
  }

  const tabContentMap: { [k in (typeof TAB_LIST)[number]]: React.ReactNode } = {
    [TAB_USER]: courseId ? <UserTabContent courseId={courseId} searchQuery={searchQuery} /> : null,
    [TAB_COMPLETIONS]: courseId ? (
      <CompletionsTabContent courseId={courseId} searchQuery={searchQuery} />
    ) : null,
    [TAB_PROGRESS]: courseId ? (
      <ProgressTabContent courseId={courseId} searchQuery={searchQuery} />
    ) : null,
    [TAB_CERTIFICATES]: <CertificatesTabContent courseId={courseId} searchQuery={searchQuery} />,
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
              <input
                className={styles.searchInput}
                placeholder={t("search-students")}
                value={inputValue}
                onChange={(e) => {
                  const value = e.target.value
                  setInputValue(value)
                  startTransition(() => {
                    setSearchQuery(value)
                  })
                }}
              />
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
                  onClick={() => goTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={tableSection}>{tabContentMap[activeTab]}</div>
      </div>
    </BreakFromCentered>
  )
}

export default StudentsPage
