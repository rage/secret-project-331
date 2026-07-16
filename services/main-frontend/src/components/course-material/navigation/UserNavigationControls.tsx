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

// Styles an anchor to match the buttons rendered inside the menu tooltip, so
// page-navigation entries are single links instead of a link wrapping a button.
const menuLink = css`
  display: block;
  text-decoration: none;
  border: none;
  margin: 0;
  padding: 12px 25px;
  font-size: 16px;
  background: inherit;
  text-transform: none;
  text-align: center;
  width: 100%;
  color: ${baseTheme.colors.green[600]};

  &:hover {
    background: inherit;
    color: ${baseTheme.colors.green[700]};
  }
`

const menuButtonColor = css`
  color: ${baseTheme.colors.green[600]} !important;
`

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
              <a className={menuLink} href={manageCourseRoute(courseId)}>
                {t("button-text-manage-course")}
              </a>
            </li>
          )}
          <li>
            <Button
              className={menuButtonColor}
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
            <a className={menuLink} href={"/user-settings"}>
              {t("user-settings")}
            </a>
          </li>

          <li className={cx(styles)}>
            <Button className={menuButtonColor} size="medium" variant="primary" onClick={logout}>
              {t("log-out")}
            </Button>
          </li>
        </>
      </Menu>
    </>
  ) : (
    <Menu>
      <li className={cx(styles)}>
        <a className={menuLink} href={signUpPathWithReturnTo}>
          {t("create-new-account")}
        </a>
      </li>
      <li className={cx(styles)}>
        <a className={menuLink} href={loginPathWithReturnTo}>
          {t("log-in")}
        </a>
      </li>
    </Menu>
  )
}

export default UserNavigationControls
