import { useRouter } from "next/router"
import React, { useState } from "react"

import { ProgressTabContent } from "./ProgressTabBackend"
import styles from "./StudentsPage.module.css"
import {
  CertificatesTabContent,
  CompletionsTabContent,
  PointsTabContent,
  UserTabContent,
} from "./StudentsTableTabs"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"

// NEW: import the CSS module

const TAB_USER = "User"
const TAB_COMPLETIONS = "Completions"
const TAB_PROGRESS = "Progress"
const TAB_CERTIFICATES = "Certificates"
const TAB_LIST = [TAB_USER, TAB_COMPLETIONS, TAB_PROGRESS, TAB_CERTIFICATES]

// tiny helper to join classes without bringing a lib
const cx = (...arr: Array<string | false | undefined>) => arr.filter(Boolean).join(" ")

const StudentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(TAB_USER)
  const router = useRouter()
  const courseInstanceId = typeof router.query?.id === "string" ? router.query.id : undefined
  // given your URL: /manage/courses/[id]/students → id is a path param
  const courseId = typeof router.query?.id === "string" ? router.query.id : undefined

  const tabContentMap: { [k: string]: React.ReactNode } = {
    [TAB_USER]: <UserTabContent />,
    [TAB_COMPLETIONS]: <CompletionsTabContent />,
    [TAB_PROGRESS]: <ProgressTabContent courseId={courseId} />,
    [TAB_CERTIFICATES]: <CertificatesTabContent />,
  }

  return (
    <BreakFromCentered>
      <div>
        <div className={styles.headerTopSection}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerTitleWrap}>
              <div className={styles.title}>Students</div>
              <div className={styles.chatbotInfo}>
                Enabling the chatbot will allow automated assistance for students, providing instant
                responses to common questions and guidance throughout the course. You can disable it
                at any time in the settings.
              </div>
            </div>
            <div className={styles.dropdownTop}>
              All instances
              <span className={styles.dropdownIcon}>▼</span>
            </div>
          </div>
          <hr className={styles.divider} />
        </div>

        <div className={styles.headerControlsSection}>
          <div className={styles.controlsRow}>
            <div className={styles.searchBoxWrap}>
              <input className={styles.searchInput} placeholder="Search students..." />
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
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TABLE SECTION */}
        <div style={{ paddingLeft: "5vw", paddingRight: "5vw" }}>{tabContentMap[activeTab]}</div>
      </div>
    </BreakFromCentered>
  )
}

export default StudentsPage
