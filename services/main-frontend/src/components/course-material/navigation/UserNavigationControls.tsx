"use client"

import { css, cx } from "@emotion/css"
import { useAtomValue } from "jotai"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import { Menu } from "@/shared-module/common/components/Navigation/NavBar"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import useLogout from "@/shared-module/common/hooks/useLogout"
import { baseTheme } from "@/shared-module/common/styles"
import "@/shared-module/common/init/registerAuthApiClients"
import { useCurrentPagePathForReturnTo } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { manageCourseRoute } from "@/shared-module/common/utils/routes"
import { currentCourseIdAtom } from "@/state/course-material/selectors"

import CourseSettingsModal from "../modals/CourseSettingsModal"

export interface UserNavigationControlsProps {
  styles?: string[]
  currentPagePath: string
}

const UserNavigationControls: React.FC<React.PropsWithChildren<UserNavigationControlsProps>> = ({
  styles,
  currentPagePath,
}) => {
  const { t, i18n } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const returnTo = useCurrentPagePathForReturnTo(currentPagePath)
  const { logout } = useLogout()
  const courseId = useAtomValue(currentCourseIdAtom)

  const permissionCheck = useAuthorizeMultiple(
    courseId && loginStateContext.signedIn === true
      ? [
          {
            action: { type: "teach" },
            resource: { type: "course", id: courseId },
          },
        ]
      : [],
  )

  const hasPermission =
    courseId &&
    loginStateContext.signedIn === true &&
    permissionCheck.isSuccess &&
    permissionCheck.data &&
    permissionCheck.data[0] === true

  if (loginStateContext.isLoading) {
    return <Spinner variant="large" />
  }

  // oxlint-disable-next-line i18next/no-literal-string
  const loginPathWithReturnTo = `/login?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`

  // oxlint-disable-next-line i18next/no-literal-string
  const signUpPathWithReturnTo = `/signup?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`

  return loginStateContext.signedIn ? (
    <>
      {showSettings && (
        <CourseSettingsModal
          onClose={() => {
            setShowSettings(false)
          }}
          manualOpen={showSettings}
        />
      )}

      <Menu>
        <>
          {courseId && hasPermission && (
            <li>
              <a href={manageCourseRoute(courseId)}>
                <Button
                  className={css`
                    color: ${baseTheme.colors.green[600]} !important;
                  `}
                  variant="primary"
                  size="medium"
                >
                  {t("button-text-manage-course")}
                </Button>
              </a>
            </li>
          )}
          <li>
            <Button
              className={css`
                color: ${baseTheme.colors.green[600]} !important;
              `}
              size="medium"
              variant="primary"
              onClick={() => {
                setShowSettings(true)
              }}
            >
              {t("settings")}
            </Button>
          </li>

          <li>
            <a href={"/user-settings"}>
              <Button
                className={css`
                  color: ${baseTheme.colors.green[600]} !important;
                `}
                size="medium"
                variant="primary"
              >
                {t("user-settings")}
              </Button>
            </a>
          </li>

          <li className={cx(styles)}>
            <Button
              className={css`
                color: ${baseTheme.colors.green[600]} !important;
              `}
              size="medium"
              variant="primary"
              onClick={logout}
            >
              {t("log-out")}
            </Button>
          </li>
        </>
      </Menu>
    </>
  ) : (
    <Menu>
      <li className={cx(styles)}>
        <a href={signUpPathWithReturnTo}>
          <Button
            className={css`
              color: ${baseTheme.colors.green[600]} !important;
            `}
            size="medium"
            variant="primary"
          >
            {t("create-new-account")}
          </Button>
        </a>
      </li>
      <li className={cx(styles)}>
        <a href={loginPathWithReturnTo}>
          <Button
            className={css`
              color: ${baseTheme.colors.green[600]} !important;
            `}
            size="medium"
            variant="primary"
          >
            {t("log-in")}
          </Button>
        </a>
      </li>
    </Menu>
  )
}

export default UserNavigationControls
