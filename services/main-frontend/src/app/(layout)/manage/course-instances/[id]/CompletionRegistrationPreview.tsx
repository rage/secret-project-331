"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Collapsible from "@/components/Collapsible"
import type { ManualCompletionPreview } from "@/generated/api/types.generated"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import { Button, Infobox } from "@/shared-module/components"

import PreviewUserList from "./PreviewUserList"

export interface CompletionRegistrationPreviewProps {
  manualCompletionPreview: ManualCompletionPreview
  onSubmit: (options: CompletionRegistrationSubmitOptions) => void
}

export interface CompletionRegistrationSubmitOptions {
  skipDuplicateCompletions: boolean
}

const CompletionRegistrationPreview: React.FC<CompletionRegistrationPreviewProps> = ({
  manualCompletionPreview,
  onSubmit,
}) => {
  const [skipDuplicateCompletions, setSkipDuplicateCompletions] = useState(false)
  const { t } = useTranslation()

  return (
    <div
      className={css`
        margin: 1rem 0;
      `}
    >
      <Infobox>
        <p>{t("please-check-the-following-preview-results-before-submitting")}</p>
        <div
          className={css`
            margin: 1rem 0;
          `}
        >
          <Collapsible
            title={
              t("users-receiving-a-completion-for-the-first-time") +
              " (" +
              manualCompletionPreview.first_time_completing_users.length +
              ")"
            }
          >
            <PreviewUserList users={manualCompletionPreview.first_time_completing_users} />
          </Collapsible>
        </div>
        <div
          className={css`
            margin: 1rem 0;
          `}
        >
          <Collapsible
            title={
              t("users-that-will-be-enrolled-on-the-course-as-a-part-of-completion-registration") +
              " (" +
              manualCompletionPreview.non_enrolled_users.length +
              ")"
            }
          >
            <PreviewUserList users={manualCompletionPreview.non_enrolled_users} />
          </Collapsible>
        </div>
        <div
          className={css`
            margin: 1rem 0;
          `}
        >
          <Collapsible
            title={
              t("users-that-already-have-a-completion-and-are-about-to-get-a-duplicate-one") +
              " (" +
              manualCompletionPreview.already_completed_users.length +
              ")"
            }
          >
            <PreviewUserList users={manualCompletionPreview.already_completed_users} />
          </Collapsible>
        </div>
        <CheckBox
          label={t("do-not-add-duplicate-completions-for-these-users")}
          checked={skipDuplicateCompletions}
          onChangeByValue={setSkipDuplicateCompletions}
        />
        <Button
          variant="primary"
          size="medium"
          type="button"
          onClick={() => onSubmit({ skipDuplicateCompletions })}
        >
          {t("button-text-submit")}
        </Button>
      </Infobox>
    </div>
  )
}

export default CompletionRegistrationPreview
