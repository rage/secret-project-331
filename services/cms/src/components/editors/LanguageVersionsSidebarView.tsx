"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useForm } from "react-hook-form"

import type { LanguageVersionPage, PageLanguageVersion } from "@/generated/api"
import {
  getCmsPageLanguageVersionsOptions,
  getCmsPageLanguageVersionsQueryKey,
  linkCmsPageCounterpartMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { manageCreateCounterpartRoute } from "@/shared-module/common/utils/routes"
import {
  Button,
  Dialog,
  ErrorNotice,
  LanguageChip,
  Link,
  LoadingRegion,
  Select,
  type SelectOption,
} from "@/shared-module/components"
import { useTranslation } from "@/utils/useCmsTranslation"

import { coursePageRoute } from "../../utils/routing"

interface LinkFormFields {
  counterpartPageId: string
}

const rowCss = css`
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr);
  gap: var(--space-1) var(--space-2);
  align-items: baseline;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-gray-200);

  &:last-child {
    border-bottom: 1px solid var(--color-gray-200);
  }
`

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  margin-top: var(--space-1);
`

const chipCss = css`
  justify-self: start;
`

const mutedCss = css`
  color: var(--color-gray-600);
`

const problemCss = css`
  color: var(--color-red-700);
  font-weight: 600;
`

// oxlint-disable-next-line i18next/no-literal-string
const PATH_SEPARATOR = "›"
const POST = "POST"

const PagePath: React.FC<{ page: LanguageVersionPage }> = ({ page }) => {
  const { t } = useTranslation()
  return (
    <>
      {typeof page.chapter_number === "number" && (
        <span className={mutedCss}>
          {page.chapter_name ||
            t("language-versions-chapter-prefix", { number: page.chapter_number })}{" "}
          {PATH_SEPARATOR}{" "}
        </span>
      )}
      {page.title}
    </>
  )
}

interface LinkExistingPageDialogProps {
  pageId: string
  version: PageLanguageVersion
  open: boolean
  onClose: () => void
}

const LinkExistingPageDialog: React.FC<LinkExistingPageDialogProps> = ({
  pageId,
  version,
  open,
  onClose,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const suggestedPageId =
    version.link_candidates.find((candidate) => candidate.is_suggested && !candidate.is_linked)
      ?.page.id ?? ""
  const { control, handleSubmit, watch } = useForm<LinkFormFields>({
    defaultValues: { counterpartPageId: suggestedPageId },
  })
  const linkMutation = useToastMutationOptions(
    linkCmsPageCounterpartMutation(),
    { notify: true, method: POST },
    {
      onSuccess: (languageVersions) => {
        queryClient.setQueryData(
          getCmsPageLanguageVersionsQueryKey({ path: { page_id: pageId } }),
          languageVersions,
        )
        onClose()
      },
    },
  )

  const options: SelectOption[] = version.link_candidates.map((candidate) => ({
    value: candidate.page.id,
    isDisabled: candidate.is_linked,
    textValue: candidate.page.title,
    label: (
      <>
        <PagePath page={candidate.page} />
        {candidate.is_linked ? ` (${t("language-versions-already-linked")})` : ""}
        {candidate.is_suggested && !candidate.is_linked
          ? ` (${t("language-versions-suggested")})`
          : ""}
      </>
    ),
  }))
  const selectedPageId = watch("counterpartPageId")

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="small"
      title={t("language-versions-link-existing-page")}
      actions={[
        { label: t("cancel"), variant: "secondary", onClick: onClose },
        {
          label: t("language-versions-link"),
          variant: "primary",
          disabled: !selectedPageId,
          isLoading: linkMutation.isPending,
          onClick: handleSubmit(({ counterpartPageId }) =>
            linkMutation.mutate({
              path: { page_id: pageId },
              body: { counterpart_page_id: counterpartPageId },
            }),
          ),
        },
      ]}
    >
      <Select
        name="counterpartPageId"
        control={control}
        label={t("language-versions-page-select-label", { course: version.course_name })}
        options={options}
        searchEnabled
      />
    </Dialog>
  )
}

interface LanguageVersionRowProps {
  pageId: string
  /** The course of `pageId`; the create-counterpart page looks the page up there. */
  pageCourseId: string
  version: PageLanguageVersion
  /** Fixes change links in every language version, so they need edit rights to all of them. */
  canEditAllCourses: boolean
}

const LanguageVersionRow: React.FC<LanguageVersionRowProps> = ({
  pageId,
  pageCourseId,
  version,
  canEditAllCourses,
}) => {
  const { t } = useTranslation()
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
  const counterpart = version.counterpart
  const hasCounterpart = counterpart && !counterpart.is_deleted

  return (
    <li className={rowCss}>
      <LanguageChip code={version.language_code} missing={!hasCounterpart} className={chipCss} />
      <span>
        {hasCounterpart ? (
          <>
            <PagePath page={counterpart} />
            <span className={actionsCss}>
              <Link href={coursePageRoute(counterpart.id)} isCrossService>
                {t("language-versions-open")}
              </Link>
            </span>
          </>
        ) : (
          <>
            <span className={problemCss}>{t("language-versions-missing")}</span>
            {canEditAllCourses ? (
              <span className={actionsCss}>
                <Link
                  href={manageCreateCounterpartRoute(pageCourseId, pageId, version.language_code)}
                  isCrossService
                >
                  {t("language-versions-create-counterpart")}
                </Link>
                <Button variant="link" size="small" onClick={() => setIsLinkDialogOpen(true)}>
                  {t("language-versions-link-existing-page")}
                </Button>
              </span>
            ) : (
              <span className={mutedCss}>
                {" "}
                {version.can_edit
                  ? t("language-versions-cannot-edit-all")
                  : t("language-versions-cannot-edit")}
              </span>
            )}
            <LinkExistingPageDialog
              pageId={pageId}
              version={version}
              open={isLinkDialogOpen}
              onClose={() => setIsLinkDialogOpen(false)}
            />
          </>
        )}
      </span>
    </li>
  )
}

interface LanguageVersionsSidebarViewProps {
  pageId: string
}

/** The page's counterparts in the course's other language versions, with fixes for missing ones. */
const LanguageVersionsSidebarView: React.FC<LanguageVersionsSidebarViewProps> = ({ pageId }) => {
  const { t } = useTranslation()
  const query = useQuery(getCmsPageLanguageVersionsOptions({ path: { page_id: pageId } }))
  const languageVersions = query.data

  return (
    <div
      className={css`
        width: 100%;
        padding: var(--space-4);
        font-size: var(--font-size-1);
      `}
    >
      <h3
        className={css`
          margin: 0 0 var(--space-1);
          font-size: inherit;
          font-weight: 600;
        `}
      >
        {t("language-versions")}
      </h3>
      <p
        className={css`
          margin: 0 0 var(--space-3);
          color: var(--color-gray-600);
        `}
      >
        {t("language-versions-hint")}
      </p>
      {query.isError && <ErrorNotice error={query.error} />}
      {query.isPending && <LoadingRegion />}
      {languageVersions && (
        <ul
          className={css`
            margin: 0;
            padding: 0;
            list-style: none;
          `}
        >
          <li className={rowCss}>
            <LanguageChip code={languageVersions.page.language_code} className={chipCss} />
            <span className={mutedCss}>{t("language-versions-this-page")}</span>
          </li>
          {languageVersions.versions.map((version) => (
            <LanguageVersionRow
              key={version.course_id}
              pageId={pageId}
              pageCourseId={languageVersions.page.course_id}
              version={version}
              canEditAllCourses={languageVersions.can_edit_all_courses}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default LanguageVersionsSidebarView
