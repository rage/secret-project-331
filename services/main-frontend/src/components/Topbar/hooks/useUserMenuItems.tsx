"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ReactElement, useContext, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useUserDetails } from "@/hooks/course-material/useUserDetails"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { logout } from "@/shared-module/common/services/backend/auth"
import { userSettingsRoute } from "@/shared-module/common/utils/routes"

export interface UserMenuItem {
  id: string
  type: "link" | "action" | "separator"
  label?: string
  href?: string
  onAction?: () => void
  icon?: ReactElement
  isDestructive?: boolean
}

export interface UseUserMenuItemsProps {
  menuOptions?: Array<{
    type: "link" | "action" | "separator"
    label?: string
    href?: string
    onAction?: () => void
    icon?: ReactElement
    isDestructive?: boolean
  }>
  onMenuClose?: () => void
}

export interface UseUserMenuItemsResult {
  items: UserMenuItem[]
  displayName: string
  displayInitial: string
  displayEmail: string
  fullDisplayName: string
  shouldShow: boolean
}

export function useUserMenuItems({
  menuOptions,
  onMenuClose,
}: UseUserMenuItemsProps = {}): UseUserMenuItemsResult {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const queryClient = useQueryClient()
  const userDetails = useUserDetails()

  const displayName = useMemo(() => {
    const data = userDetails.data
    if (!data) {
      return ""
    }

    const firstName = data.first_name?.trim()
    const lastName = data.last_name?.trim()
    const email = data.email?.trim()

    if (firstName && firstName.length > 0 && lastName && lastName.length > 0) {
      return `${firstName} ${lastName}`
    }
    if (firstName && firstName.length > 0) {
      return firstName
    }
    if (lastName && lastName.length > 0) {
      return lastName
    }
    if (email && email.length > 0) {
      return email
    }
    return ""
  }, [userDetails.data])

  const displayInitial = useMemo(() => {
    if (displayName.length > 0) {
      return displayName[0].toUpperCase()
    }
    return "?"
  }, [displayName])

  const fullDisplayName = useMemo(() => {
    if (userDetails.data) {
      const fullName = [userDetails.data.first_name, userDetails.data.last_name]
        .map((n) => n?.trim())
        .filter((n) => n && n.length > 0)
        .join(" ")
      return fullName || displayName
    }
    return displayName
  }, [userDetails.data, displayName])

  const displayEmail = userDetails.data?.email || ""

  const submitLogout = async () => {
    await logout()
    queryClient.removeQueries()
    await loginStateContext.refresh()
    setTimeout(() => {
      queryClient.refetchQueries()
    }, 100)
    onMenuClose?.()
  }

  const defaultUserMenuItems = [
    { type: "link" as const, href: userSettingsRoute(), label: t("user-settings") },
    {
      type: "action" as const,
      label: t("log-out"),
      onAction: submitLogout,
      isDestructive: true,
    },
  ] as const

  const userMenuItems = menuOptions || defaultUserMenuItems

  const items: UserMenuItem[] = useMemo(() => {
    return userMenuItems.map((item, i) => {
      if (item.type === "separator") {
        return {
          // eslint-disable-next-line i18next/no-literal-string
          id: `user-sep-${i}`,
          type: "separator" as const,
        }
      }

      return {
        // eslint-disable-next-line i18next/no-literal-string
        id: `user-${"href" in item ? item.href : "label" in item ? item.label : i}`,
        type: item.type,
        label: "label" in item ? item.label : undefined,
        href: "href" in item ? item.href : undefined,
        onAction:
          "onAction" in item && item.onAction
            ? () => {
                item.onAction?.()
                onMenuClose?.()
              }
            : undefined,
        icon: "icon" in item ? item.icon : undefined,
        isDestructive: "isDestructive" in item ? item.isDestructive : undefined,
      }
    })
  }, [userMenuItems, onMenuClose])

  return {
    items,
    displayName,
    displayInitial,
    displayEmail,
    fullDisplayName,
    shouldShow: loginStateContext.signedIn === true,
  }
}
