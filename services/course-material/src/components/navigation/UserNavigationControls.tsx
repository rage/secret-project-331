import { css, cx } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import CourseSettingsModal from "../modals/CourseSettingsModal"

import Button from "@/shared-module/common/components/Button"
import { Menu } from "@/shared-module/common/components/Navigation/NavBar"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { logout } from "@/shared-module/common/services/backend/auth"
import { baseTheme } from "@/shared-module/common/styles"
import { useCurrentPagePathForReturnTo } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { manageCourseRoute } from "@/shared-module/common/utils/routes"

export interface UserNavigationControlsProps {
  styles?: string[]
  currentPagePath: string
  courseId?: string | null
}

const UserNavigationControls: React.FC<React.PropsWithChildren<UserNavigationControlsProps>> = ({
  styles,
  currentPagePath,
  courseId,
}) => {
  const { t, i18n } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const returnTo = useCurrentPagePathForReturnTo(currentPagePath)
  const queryClient = useQueryClient()

  if (loginStateContext.isPending) {
    return <Spinner variant="large" />
  }

  const submitLogout = async () => {
    await logout()
    queryClient.removeQueries()
    await loginStateContext.refresh()
    setTimeout(() => {
      queryClient.refetchQueries()
    }, 100)
  }

  // eslint-disable-next-line i18next/no-literal-string
  const loginPathWithReturnTo = `/login?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`

  // eslint-disable-next-line i18next/no-literal-string
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
          {courseId && (
            <OnlyRenderIfPermissions
              action={{
                type: "teach",
              }}
              resource={{
                type: "course",
                id: courseId,
              }}
            >
              <li>
                <a href={manageCourseRoute(courseId)}>
                  <Button
                    className={css`
                      color: ${baseTheme.colors.green[600]}!important;
                    `}
                    variant="primary"
                    size="medium"
                  >
                    {t("button-text-manage-course")}
                  </Button>
                </a>
              </li>
            </OnlyRenderIfPermissions>
          )}
          <li>
            <Button
              className={css`
                color: ${baseTheme.colors.green[600]}!important;
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
                  color: ${baseTheme.colors.green[600]}!important;
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
                color: ${baseTheme.colors.green[600]}!important;
              `}
              size="medium"
              variant="primary"
              onClick={submitLogout}
            >
              {t("log-out")}
            </Button>
          </li>
        </>
      </Menu>
    </>
  ) : (
    <>
      <Menu>
        <li className={cx(styles)}>
          <a href={signUpPathWithReturnTo}>
            <Button
              className={css`
                color: ${baseTheme.colors.green[600]}!important;
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
                color: ${baseTheme.colors.green[600]}!important;
              `}
              size="medium"
              variant="primary"
            >
              {t("log-in")}
            </Button>
          </a>
        </li>
      </Menu>
    </>
  )
}

export default UserNavigationControls
