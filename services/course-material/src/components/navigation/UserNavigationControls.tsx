import { ClassNamesArg, css, cx } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../../shared-module/components/Button"
import { Menu } from "../../shared-module/components/Navigation/NavBar"
import OnlyRenderIfPermissions from "../../shared-module/components/OnlyRenderIfPermissions"
import Spinner from "../../shared-module/components/Spinner"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import { logout } from "../../shared-module/services/backend/auth"
import { baseTheme } from "../../shared-module/styles"
import { useCurrentPagePathForReturnTo } from "../../shared-module/utils/redirectBackAfterLoginOrSignup"
import { manageCourseRoute } from "../../shared-module/utils/routes"
import CourseSettingsModal from "../modals/CourseSettingsModal"

export interface UserNavigationControlsProps {
  styles?: ClassNamesArg[]
  currentPagePath: string
  courseId?: string | null
}

const UserNavigationControls: React.FC<React.PropsWithChildren<UserNavigationControlsProps>> = ({
  styles,
  currentPagePath,
  courseId,
}) => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const returnTo = useCurrentPagePathForReturnTo(currentPagePath)
  const queryClient = useQueryClient()

  if (loginStateContext.isLoading) {
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
  const loginPathWithReturnTo = `/login?return_to=${encodeURIComponent(returnTo)}`

  // eslint-disable-next-line i18next/no-literal-string
  const signUpPathWithReturnTo = `/signup?return_to=${encodeURIComponent(returnTo)}`

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
