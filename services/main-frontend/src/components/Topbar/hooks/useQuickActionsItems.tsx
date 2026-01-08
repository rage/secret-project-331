"use client"

import { useAtomValue } from "jotai"
import { useContext, useMemo } from "react"
import { useTranslation } from "react-i18next"

import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import { editPageRoute, manageCourseRoute } from "@/shared-module/common/utils/routes"
import { currentCourseIdAtom, currentPageIdAtom } from "@/state/course-material/selectors"

export interface QuickActionItem {
  id: string
  type: "link" | "action" | "separator"
  label?: string
  href?: string
  onAction?: () => void
  icon?: string
  isDestructive?: boolean
}

export interface UseQuickActionsItemsProps {
  menuOptions?: Array<{
    type: "link" | "action" | "separator"
    label?: string
    href?: string
    onAction?: () => void
    icon?: string
    isDestructive?: boolean
  }>
  courseId?: string | null
  onMenuClose?: () => void
  onCourseSettingsOpen?: () => void
}

export interface UseQuickActionsItemsResult {
  items: QuickActionItem[]
  shouldShow: boolean
}

export function useQuickActionsItems({
  menuOptions,
  courseId,
  onMenuClose,
  onCourseSettingsOpen,
}: UseQuickActionsItemsProps = {}): UseQuickActionsItemsResult {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)

  const courseIdFromState = useAtomValue(currentCourseIdAtom)
  const effectiveCourseId = courseId ?? courseIdFromState ?? null
  const currentPageId = useAtomValue(currentPageIdAtom)

  const permissionCheck = useAuthorizeMultiple(
    effectiveCourseId
      ? [
          {
            action: { type: "teach" },
            resource: { type: "course", id: effectiveCourseId },
          },
        ]
      : [],
  )

  const hasPermission =
    effectiveCourseId &&
    permissionCheck.isSuccess &&
    permissionCheck.data &&
    permissionCheck.data[0] === true

  const hasCustomOptions = menuOptions && menuOptions.some((item) => item.type !== "separator")

  const quickActions = useMemo(() => {
    if (menuOptions) {
      return menuOptions
    }

    const items: QuickActionItem[] = []

    const isSignedIn = loginStateContext.signedIn === true
    const shouldShowCourseSettings = isSignedIn && effectiveCourseId !== null

    if (shouldShowCourseSettings || hasPermission) {
      if (shouldShowCourseSettings) {
        items.push({
          type: "action",
          label: t("course-settings"),
          onAction: () => {
            onCourseSettingsOpen?.()
            onMenuClose?.()
          },
        })
      }

      if (hasPermission && effectiveCourseId) {
        if (items.length > 0) {
          items.push({
            type: "separator",
          })
        }
        if (currentPageId) {
          items.push({
            type: "link",
            label: t("button-text-edit-page"),
            href: editPageRoute(currentPageId),
          })
        }
        items.push({
          type: "link",
          label: t("button-text-manage-course"),
          href: manageCourseRoute(effectiveCourseId),
        })
      }
    }

    return items
  }, [
    menuOptions,
    effectiveCourseId,
    hasPermission,
    loginStateContext.signedIn,
    currentPageId,
    t,
    onCourseSettingsOpen,
    onMenuClose,
  ])

  const hasVisibleOptions = useMemo(() => {
    if (hasCustomOptions) {
      return true
    }
    return quickActions.some((item) => item.type !== "separator")
  }, [hasCustomOptions, quickActions])

  const items: QuickActionItem[] = useMemo(() => {
    return quickActions.map((item, idx) => {
      if (item.type === "separator") {
        return {
          // eslint-disable-next-line i18next/no-literal-string
          id: `quick-sep-${idx}`,
          type: "separator" as const,
        }
      }

      return {
        // eslint-disable-next-line i18next/no-literal-string
        id: `quick-${item.href || item.label || idx}`,
        type: item.type,
        label: item.label,
        href: item.href,
        onAction: item.onAction
          ? () => {
              item.onAction?.()
              onMenuClose?.()
            }
          : undefined,
        icon: "icon" in item ? item.icon : undefined,
        isDestructive: "isDestructive" in item ? item.isDestructive : undefined,
      }
    })
  }, [quickActions, onMenuClose])

  return {
    items,
    shouldShow: hasVisibleOptions,
  }
}
