import { css } from "@emotion/react"
import React, { useState } from "react"

import {
  CertificatesTabContent,
  CompletionsTabContent,
  PointsTabContent,
  UserTabContent,
} from "./StudentsTableTabs"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered" // or your relative import

// --- Your Styles (unchanged except for thStyle) ---
const headerTopRowStyle = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
`
const headerTitleWrapStyle = css`
  flex: 1 1 auto;
  min-width: 0;
`
const dropdownTopStyle = css`
  background: #fff;
  border: 1px solid #e4e5e8;
  border-radius: 2px;
  width: 170px;
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  font-size: 14px;
  color: #1a2333;
  cursor: pointer;
  margin-left: 24px;
  margin-top: 0;
  white-space: nowrap;
`
const pageHeaderStyle = css`
  width: 1124px;
  margin: 32px auto 0 auto;
`
const titleStyle = css`
  font-family: "Inter", sans-serif;
  font-weight: 500;
  font-size: 24px;
  line-height: 29px;
  color: #1a2333;
  margin-bottom: 8px;
`
const chatbotInfoStyle = css`
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 140%;
  color: #1a2333;
  opacity: 0.9;
  margin-bottom: 24px;
  max-width: 700px;
`
const dividerStyle = css`
  border: none;
  border-top: 2px solid rgba(206, 209, 215, 0.5);
  margin-bottom: 28px;
`
const controlsRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
`
const dropdownIconStyle = css`
  margin-left: auto;
  color: #4e5562;
  font-size: 18px;
  transform: rotate(180deg);
`
const searchBoxWrapStyle = css`
  position: relative;
  width: 370px;
  height: 36px;
  margin-right: 18px;
`
const searchInputStyle = css`
  width: 100%;
  height: 36px;
  border: 1px solid #dbdbdb;
  border-radius: 4px;
  padding-left: 36px;
  font-size: 14px;
  font-family: "Inter", sans-serif;
  color: #1a2333;
  background: #fff;
`
const searchIconStyle = css`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #5c5f64;
  font-size: 16px;
  opacity: 0.8;
`
const tabsWrapStyle = css`
  display: flex;
  align-items: center;
  background: rgba(6, 88, 83, 0.05);
  border-radius: 2px;
  height: 36px;
  border: 1px solid #dbdbdb;
  overflow: hidden;
  min-width: 0;
`
const tabStyle = (active = false, color = "#1A2333", isLast = false) => css`
  padding: 0 20px;
  height: 36px;
  display: flex;
  align-items: center;
  font-size: 14px;
  font-family: "Inter", sans-serif;
  font-weight: 400;
  color: ${active ? "#065853" : color};
  background: ${active ? "#fff" : "transparent"};
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  ${!isLast && "border-right: 1px solid #dbdbdb;"}
`
const containerStyle = css`
  width: 1124px;
  margin: 0 auto 0 auto;
  background: #fff;
  border: 1px solid #ced1d7;
  border-radius: 8px 8px 0 0;
  font-family: "Inter", sans-serif;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`

// ---- MAIN PAGE ----
const TAB_USER = "User"
const TAB_COMPLETIONS = "Completions"
const TAB_PROGRESS = "Progress"
const TAB_CERTIFICATES = "Certificates"
const TAB_LIST = [TAB_USER, TAB_COMPLETIONS, TAB_PROGRESS, TAB_CERTIFICATES]
const tabContentMap: { [k: string]: React.ReactNode } = {
  [TAB_USER]: <UserTabContent />,
  [TAB_COMPLETIONS]: <CompletionsTabContent />,
  [TAB_PROGRESS]: <PointsTabContent />,
  [TAB_CERTIFICATES]: <CertificatesTabContent />,
}

const StudentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(TAB_USER)

  return (
    <div>
      {/* HEADER SECTION */}
      <div css={pageHeaderStyle}>
        <div css={headerTopRowStyle}>
          <div css={headerTitleWrapStyle}>
            <div css={titleStyle}>Students</div>
            <div css={chatbotInfoStyle}>
              Enabling the chatbot will allow automated assistance for students, providing instant
              responses to common questions and guidance throughout the course. You can disable it
              at any time in the settings.
            </div>
          </div>
          <div css={dropdownTopStyle}>
            All instances
            <span css={dropdownIconStyle}>▼</span>
          </div>
        </div>
        <hr css={dividerStyle} />

        <div css={controlsRowStyle}>
          <div css={searchBoxWrapStyle}>
            <input css={searchInputStyle} placeholder="Search student..." />
            <span css={searchIconStyle}>🔍</span>
          </div>
          <div css={tabsWrapStyle}>
            {TAB_LIST.map((tab, i) => (
              <button
                key={tab}
                css={tabStyle(
                  activeTab === tab,
                  tab === TAB_COMPLETIONS ? "#065853" : "#1A2333",
                  i === TAB_LIST.length - 1,
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
      <BreakFromCentered>
        <div style={{ paddingLeft: "5vw", paddingRight: "5vw" }}>{tabContentMap[activeTab]}</div>
      </BreakFromCentered>
    </div>
  )
}

export default StudentsPage
