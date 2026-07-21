"use client"

import { fireEvent, render, screen, within } from "@testing-library/react"

import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import type { LoginState } from "@/shared-module/common/contexts/LoginStateContext"

import UserNavigationControls from "../UserNavigationControls"

jest.mock("@/shared-module/common/init/registerAuthApiClients", () => ({}))

jest.mock("@/shared-module/common/hooks/useLogout", () => ({
  __esModule: true,
  default: () => ({ logout: jest.fn() }),
}))

jest.mock("@/shared-module/common/hooks/useAuthorizeMultiple", () => ({
  __esModule: true,
  default: () => ({ isSuccess: false, data: undefined }),
}))

jest.mock("@/shared-module/common/utils/redirectBackAfterLoginOrSignup", () => ({
  useCurrentPagePathForReturnTo: (path: string) => path,
}))

jest.mock("jotai", () => ({
  useAtomValue: () => null,
}))

jest.mock("@/state/course-material/selectors", () => ({
  currentCourseIdAtom: {},
}))

jest.mock("../../modals/CourseSettingsModal", () => ({
  __esModule: true,
  default: () => null,
}))

const renderWithLoginState = (signedIn: boolean) => {
  const loginState: LoginState = {
    isLoading: false,
    refresh: () => Promise.resolve(),
    signedIn,
  }
  return render(
    <LoginStateContext.Provider value={loginState}>
      <UserNavigationControls currentPagePath="/some-page" />
    </LoginStateContext.Provider>,
  )
}

const openMenu = () => {
  // The toggle's accessible name comes from t("navigation-menu"); react-i18next is
  // mocked in the global jest setup to return the key.
  fireEvent.click(screen.getByRole("button", { name: "navigation-menu" }))
}

describe("UserNavigationControls", () => {
  describe("when signed in", () => {
    it("renders page-navigation entries as links with no nested button", () => {
      renderWithLoginState(true)
      openMenu()

      const userSettingsLink = screen.getByRole("link", { name: "user-settings" })
      expect(userSettingsLink.tagName).toBe("A")
      expect(userSettingsLink.getAttribute("href")).toBe("/user-settings")
      expect(within(userSettingsLink).queryByRole("button")).toBeNull()
      expect(userSettingsLink.querySelector("button")).toBeNull()
    })

    it("keeps settings and log out as real buttons, not links", () => {
      renderWithLoginState(true)
      openMenu()

      const settingsButton = screen.getByRole("button", { name: "settings" })
      expect(settingsButton.tagName).toBe("BUTTON")

      const logoutButton = screen.getByRole("button", { name: "log-out" })
      expect(logoutButton.tagName).toBe("BUTTON")

      expect(screen.queryByRole("link", { name: "settings" })).toBeNull()
      expect(screen.queryByRole("link", { name: "log-out" })).toBeNull()
    })
  })

  describe("when signed out", () => {
    it("renders sign up and log in as links with no nested button", () => {
      renderWithLoginState(false)
      openMenu()

      const signUpLink = screen.getByRole("link", { name: "create-new-account" })
      expect(signUpLink.tagName).toBe("A")
      expect(signUpLink.querySelector("button")).toBeNull()

      const loginLink = screen.getByRole("link", { name: "log-in" })
      expect(loginLink.tagName).toBe("A")
      expect(loginLink.querySelector("button")).toBeNull()

      // No stray buttons other than the menu toggle itself.
      expect(screen.getAllByRole("button")).toHaveLength(1)
    })
  })
})
