"use client"

import React, { ReactElement, useState } from "react"
import { useTranslation } from "react-i18next"

import DropdownMenu from "./DropdownMenu"
import { useQuickActionsItems } from "./hooks/useQuickActionsItems"

import CourseSettingsModal from "@/components/course-material/modals/CourseSettingsModal"

interface MenuOption {
  type: "link" | "action" | "separator"
  label?: string
  href?: string
  onAction?: () => void
  icon?: ReactElement
  isDestructive?: boolean
}

interface QuickActionsMenuProps {
  menuOptions?: MenuOption[]
  courseId?: string | null
}

const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ menuOptions, courseId }) => {
  const { t } = useTranslation()
  const [showCourseSettings, setShowCourseSettings] = useState(false)

  const { items, shouldShow } = useQuickActionsItems({
    menuOptions,
    courseId,
    onCourseSettingsOpen: () => {
      setShowCourseSettings(true)
    },
  })

  if (!shouldShow) {
    return null
  }

  return (
    <>
      {courseId && showCourseSettings && (
        <CourseSettingsModal
          onClose={() => {
            setShowCourseSettings(false)
          }}
          manualOpen={showCourseSettings}
        />
      )}
      <DropdownMenu
        // eslint-disable-next-line i18next/no-literal-string
        menuTestId="topbar-quick-actions-menu"
        // eslint-disable-next-line i18next/no-literal-string
        menuButtonTestId="topbar-quick-actions"
        items={items}
        navLabel={t("quick-actions")}
        controlButtonAriaLabel={t("open-quick-actions-menu")}
        controlButtonTooltipText={t("quick-actions")}
      ></DropdownMenu>
    </>
  )
}

export default QuickActionsMenu
