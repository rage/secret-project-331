"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { Infobox } from "@/shared-module/components"

interface DeletedUserNoticeProps {
  userId: string
  className?: string
}

const textContainerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`

const userIdStyle = css`
  font-size: 0.9rem;
`

const DeletedUserNotice: React.FC<DeletedUserNoticeProps> = ({ userId, className }) => {
  const { t } = useTranslation()

  return (
    <div className={className}>
      <Infobox>
        <div className={textContainerStyle}>
          <span>{t("message-user-likely-deleted")}</span>
          <span className={userIdStyle}>
            {t("label-user-id")}: {userId}
          </span>
        </div>
      </Infobox>
    </div>
  )
}

export default DeletedUserNotice
