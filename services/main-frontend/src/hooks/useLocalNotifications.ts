import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

export type NotificationPermission = "default" | "granted" | "denied" | null

type NotificationOptions = {
  body?: string
  icon?: string
  tag?: string
  [key: string]: unknown
}

export interface UseLocalNotificationsReturn {
  notificationsEnabled: boolean
  notificationPermission: NotificationPermission
  permissionDeniedMessage: string
  notificationsSupported: boolean
  toggleNotifications: () => Promise<void>
  sendNotification: (title: string, options?: NotificationOptions) => void
}

export const useLocalNotifications = (): UseLocalNotificationsReturn => {
  const { t } = useTranslation()
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    () => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return null
      }
      return Notification.permission as NotificationPermission
    },
  )
  const [permissionDeniedMessage, setPermissionDeniedMessage] = useState<string>("")

  const notificationsSupported = typeof window !== "undefined" && "Notification" in window
  const notificationsEnabled = notificationPermission === "granted"

  const toggleNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      return
    }

    if (notificationPermission === "granted") {
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    if (permission === "granted") {
      setPermissionDeniedMessage("")
    } else {
      setPermissionDeniedMessage(t("status-notifications-denied"))
    }
  }, [notificationPermission, t])

  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!("Notification" in window)) {
        return
      }

      if (notificationPermission === "granted") {
        new Notification(title, options)
      } else if (notificationPermission !== "denied") {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission)
          if (permission === "granted") {
            new Notification(title, options)
          }
        })
      }
    },
    [notificationPermission],
  )

  useEffect(() => {
    if (!notificationsSupported) {
      return
    }

    if ("Notification" in window && "permission" in Notification) {
      const permission = Notification.permission
      if (permission !== notificationPermission) {
        setNotificationPermission(permission as NotificationPermission)
      }
    }
  }, [notificationsSupported, notificationPermission])

  return {
    notificationsEnabled,
    notificationPermission,
    permissionDeniedMessage,
    notificationsSupported,
    toggleNotifications,
    sendNotification,
  }
}
