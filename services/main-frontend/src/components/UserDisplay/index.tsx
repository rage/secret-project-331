"use client"

import { css, keyframes } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import Link from "next/link"
import React, { useRef } from "react"
import { mergeProps, useButton, useOverlayTrigger } from "react-aria"
import { useTranslation } from "react-i18next"

import { CourseProgressSection } from "./CourseProgressSection"
import { UserDetailsContent } from "./UserDetailsContent"
import { UserDetailsPopover } from "./UserDetailsPopover"

import { extractUserDetail, useUserDetails } from "@/hooks/useUserDetails"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"

function hasName(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0
}

/** Props: userId (required), courseId (optional). */
export interface UserDisplayProps {
  userId: string
  courseId: string | null | undefined
}

const popEnterKeyframes = keyframes`
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`

const popoverStyle = css`
  background: ${baseTheme.colors.primary[100]};
  border: 1px solid ${baseTheme.colors.clear[300]};
  border-radius: 12px;
  padding: 1rem 1.25rem;
  min-width: 280px;
  max-width: 360px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);

  &[data-entering] {
    animation: ${popEnterKeyframes} 120ms ease-out;
  }
`

const badgeStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  background: ${baseTheme.colors.clear[200]};
  border: 1px solid ${baseTheme.colors.clear[300]};
  font-family: ${primaryFont};
  color: ${baseTheme.colors.gray[700]};
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: ${baseTheme.colors.clear[300]};
  }
  &:focus {
    outline: 2px solid ${baseTheme.colors.blue[500]};
    outline-offset: 2px;
  }
`

/** Renders user avatar (first letter) and display name or email. */
const UserDisplay: React.FC<UserDisplayProps> = ({ userId, courseId }) => {
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const state = useOverlayTriggerState({})
  const { triggerProps, overlayProps } = useOverlayTrigger({ type: "dialog" }, state, triggerRef)

  const { data, isLoading, isError, error } = useUserDetails(courseId ? [courseId] : null, userId, {
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const user = extractUserDetail(data)

  const { buttonProps } = useButton(
    mergeProps(triggerProps, {
      onPress: () => state.toggle(),
    }),
    triggerRef,
  )

  if (isLoading) {
    return <Spinner />
  }

  if (isError) {
    return <ErrorBanner error={error} />
  }

  if (!user) {
    return (
      <span
        className={css`
          font-family: ${primaryFont};
          color: ${baseTheme.colors.gray[600]};
          font-size: 0.9rem;
        `}
      >
        {userId}
      </span>
    )
  }

  const firstName = user.first_name?.trim() ?? ""
  const lastName = user.last_name?.trim() ?? ""
  const email = user.email?.trim() ?? ""

  const displayText =
    hasName(firstName) || hasName(lastName)
      ? [firstName, lastName].filter(Boolean).join(" ")
      : email || userId

  const initial = hasName(firstName)
    ? firstName[0].toUpperCase()
    : hasName(lastName)
      ? lastName[0].toUpperCase()
      : email
        ? email[0].toUpperCase()
        : "?"

  const badgeContent = (
    <>
      <span
        className={css`
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 50%;
          background: ${baseTheme.colors.green[200]};
          font-size: 0.8rem;
          font-weight: 600;
          color: ${baseTheme.colors.gray[700]};
        `}
        aria-hidden
      >
        {initial}
      </span>
      {displayText}
    </>
  )

  return (
    <>
      <button
        ref={triggerRef}
        {...buttonProps}
        type="button"
        aria-label={t("view-details")}
        className={badgeStyle}
      >
        {badgeContent}
      </button>
      {state.isOpen && (
        <UserDetailsPopover
          state={state}
          triggerRef={triggerRef}
          overlayProps={overlayProps}
          className={popoverStyle}
          aria-label={t("header-user-details")}
        >
          <UserDetailsContent data={user} userId={userId} />
          {courseId && <CourseProgressSection courseId={courseId} userId={userId} />}
          {courseId && (
            <div
              className={css`
                margin-top: 0.75rem;
                display: flex;
                justify-content: center;
              `}
            >
              <Link
                href={courseUserStatusSummaryRoute(courseId, userId)}
                className={css`
                  text-decoration: none;
                `}
              >
                <Button variant="tertiary" size="small">
                  {t("course-status-summary")}
                </Button>
              </Link>
            </div>
          )}
        </UserDetailsPopover>
      )}
    </>
  )
}

export default UserDisplay
export { UserDisplay }
