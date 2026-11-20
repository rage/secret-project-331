"use client"

import React from "react"
import { Trans, useTranslation } from "react-i18next"

import type { LanguageVersionPage } from "@/generated/api/types.generated"
import { usePageLinksMutation } from "@/hooks/useLanguageVersions"
import { Dialog } from "@/shared-module/components"

import { UNLINK } from "../constants"
import { cancelAction, dialogBodyCss, mutedCss, useListFormatter } from "../shared"

interface Props {
  courseId: string
  page: LanguageVersionPage
  foreignPage: LanguageVersionPage
  foreignCourseName: string
  linkedPages: LanguageVersionPage[]
  onClose: () => void
}

/** Removes a page's link to a page of a course outside the language versions. */
const ForeignCourseLinkDialog: React.FC<Props> = ({
  courseId,
  page,
  foreignPage,
  foreignCourseName,
  linkedPages,
  onClose,
}) => {
  const { t } = useTranslation()
  const list = useListFormatter()
  const linkMutation = usePageLinksMutation()

  const unlink = () => {
    linkMutation.mutate(
      {
        path: { course_id: courseId },
        body: { changes: [{ action: UNLINK, id: foreignPage.id }] },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("language-versions-foreign-link-title", { course: foreignCourseName })}
      actions={[
        cancelAction(t, onClose),
        {
          label: t("language-versions-unlink"),
          variant: "primary",
          isLoading: linkMutation.isPending,
          onPress: unlink,
        },
      ]}
    >
      <div className={dialogBodyCss}>
        <p>
          <Trans
            t={t}
            i18nKey="language-versions-foreign-link-body"
            values={{ page: page.title, foreignPage: foreignPage.title, course: foreignCourseName }}
            components={{ strong: <strong /> }}
          />
        </p>
        <p className={mutedCss}>
          {linkedPages.length > 0
            ? t("language-versions-foreign-link-stays", {
                pages: list(
                  linkedPages.map((linked) => linked.title),
                  linkedPages.length,
                ),
              })
            : t("language-versions-no-content-changes")}
        </p>
      </div>
    </Dialog>
  )
}

export default ForeignCourseLinkDialog
