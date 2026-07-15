"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, Pen } from "@vectopus/atlas-icons-react"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useStudentsContext, useStudentsListParams, useStudentsSorting } from "../StudentsContext"
import { StudentsTable } from "../StudentsTable"
import {
  formatStudentName,
  useCourseStudentsCertificatesDetail,
  useCourseStudentsIdentity,
} from "../studentsQueries"

import { updateGeneratedCertificate } from "@/generated/api/sdk.generated"
import type {
  CertificateUpdateRequest,
  GetCertificateByVerificationIdData,
} from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import DatePickerField from "@/shared-module/common/components/InputFields/DatePickerField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { useCopyToClipboard } from "@/shared-module/common/hooks/useCopyToClipboard"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { formatDateForDateInputs } from "@/shared-module/common/utils/time"
import { buildGeneratedApiUrl } from "@/utils/generatedApiUrl"

const CERTIFICATE_BY_VERIFICATION_PATH: GetCertificateByVerificationIdData["url"] =
  "/api/v0/main-frontend/certificates/{certificate_verification_id}"

const EM_DASH = "—"

interface CertificateRow {
  user_id: string
  student: string
  name_on_certificate: string | null
  date_issued: string | null
  verification_id: string | null
  certificate_id: string | null
}

const iconBtnStyle = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #d0d5dd;
  background: #fff;
  cursor: pointer;
`

const IconButton: React.FC<{
  label: string
  onClick?: () => void
  children: React.ReactNode
}> = ({ label, onClick, children }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} className={iconBtnStyle}>
    {children}
  </button>
)

const actionsCellInner = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding-left: 0;
  padding-right: 0;
  width: 100%;
`

export const CertificatesTabContent: React.FC = () => {
  const { t } = useTranslation()
  const { courseId } = useStudentsContext()
  const params = useStudentsListParams()
  const { sorting, onSortingChange } = useStudentsSorting()
  const queryClient = useQueryClient()

  const identityQuery = useCourseStudentsIdentity(courseId, params)
  const identityRows = useMemo(() => identityQuery.data?.data ?? [], [identityQuery.data])
  const userIds = useMemo(() => identityRows.map((r) => r.user_id), [identityRows])
  const detailQuery = useCourseStudentsCertificatesDetail(courseId, userIds)

  const [editData, setEditData] = useState<{
    id: string
    name_on_certificate: string
    date: string | null
  } | null>(null)
  const [popupUrl, setPopupUrl] = useState<string | null>(null)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [copied, setCopied] = useState(false)

  const verificationUrl = verificationId
    ? // oxlint-disable-next-line i18next/no-literal-string
      `${window.location.origin}/certificates/validate/${verificationId}`
    : ""
  const copyToClipboard = useCopyToClipboard(verificationUrl)
  const closePopup = () => {
    setPopupUrl(null)
    setVerificationId(null)
    setCopied(false)
    setImageLoaded(false)
  }

  const updateCertificateMutation = useToastMutation(
    (variables: { certificateId: string; body: CertificateUpdateRequest }) =>
      updateGeneratedCertificate({
        body: variables.body,
        path: { certificate_id: variables.certificateId },
      }),
    { notify: true, method: "PUT" },
    {
      onSuccess: () => {
        setEditData(null)
        // oxlint-disable-next-line i18next/no-literal-string
        void queryClient.invalidateQueries({ queryKey: ["course-students/certificates", courseId] })
      },
    },
  )

  const rows = useMemo<CertificateRow[]>(() => {
    const byUser = new Map((detailQuery.data ?? []).map((c) => [c.user_id, c]))
    return identityRows.map((u) => {
      const cert = byUser.get(u.user_id)
      return {
        user_id: u.user_id,
        student: formatStudentName(u, t),
        name_on_certificate: cert?.name_on_certificate ?? null,
        date_issued: cert?.date_issued ?? null,
        verification_id: cert?.verification_id ?? null,
        certificate_id: cert?.certificate_id ?? null,
      }
    })
  }, [detailQuery.data, identityRows, t])

  // Guard the edit dialog's date so an empty / invalid value never reaches new Date(...).toISOString().
  const parsedEditDate = editData?.date ? new Date(editData.date) : null
  const editDateValid = parsedEditDate !== null && !Number.isNaN(parsedEditDate.getTime())

  const columns = useMemo<ColumnDef<CertificateRow, unknown>[]>(
    () => [
      // oxlint-disable-next-line i18next/no-literal-string
      { id: "last_name", accessorKey: "student", header: t("label-student") },
      {
        // oxlint-disable-next-line i18next/no-literal-string
        id: "certificate",
        header: t("certificate"),
        enableSorting: false,
        // Derive the label from certificate presence so it localizes and does not depend on a magic string.
        cell: ({ row }) => {
          const hasCertificate = Boolean(
            row.original.verification_id || row.original.certificate_id,
          )
          return hasCertificate ? t("course_certificate") : t("no_certificate")
        },
      },
      {
        header: t("name-on-certificate"),
        // oxlint-disable-next-line i18next/no-literal-string
        accessorKey: "name_on_certificate",
        enableSorting: false,
        cell: ({ getValue }) => getValue<string | null>() ?? EM_DASH,
      },
      {
        header: t("date-issued"),
        // oxlint-disable-next-line i18next/no-literal-string
        accessorKey: "date_issued",
        enableSorting: false,
        cell: ({ getValue }) => formatDateForDateInputs(getValue<string | null>()) ?? EM_DASH,
      },
      {
        header: t("actions"),
        // oxlint-disable-next-line i18next/no-literal-string
        id: "actions",
        size: 80,
        enableSorting: false,
        cell: ({ row }) => {
          const { verification_id, certificate_id, name_on_certificate, date_issued } = row.original
          // Only certificates that actually exist can be viewed / edited.
          if (!verification_id && !certificate_id) {
            return null
          }
          return (
            <div className={actionsCellInner}>
              {verification_id && (
                <IconButton
                  label={t("view_certificate")}
                  onClick={() => {
                    setPopupUrl(
                      buildGeneratedApiUrl(CERTIFICATE_BY_VERIFICATION_PATH, {
                        certificate_verification_id: verification_id,
                      }),
                    )
                    setVerificationId(verification_id)
                  }}
                >
                  <Eye size={18} />
                </IconButton>
              )}
              {certificate_id && (
                <IconButton
                  label={t("edit_certificate")}
                  onClick={() =>
                    setEditData({
                      id: certificate_id,
                      name_on_certificate: name_on_certificate ?? "",
                      date: date_issued ?? null,
                    })
                  }
                >
                  <Pen size={18} />
                </IconButton>
              )}
            </div>
          )
        },
      },
    ],
    [t],
  )

  if (identityQuery.isError) {
    return <ErrorBanner error={identityQuery.error} />
  }
  if (detailQuery.isError) {
    return <ErrorBanner error={detailQuery.error} />
  }
  if (identityQuery.isPending || (userIds.length > 0 && detailQuery.isLoading)) {
    return <Spinner variant="medium" />
  }

  return (
    <>
      {popupUrl && verificationId && (
        <StandardDialog
          open={true}
          onClose={closePopup}
          title={t("view_certificate")}
          showCloseButton={true}
          isDismissable={true}
          noPadding={false}
          className={css`
            width: auto !important;
            max-width: 95vw !important;
            max-height: 95vh !important;
          `}
        >
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            <div
              className={css`
                position: relative;
                width: 800px;
                aspect-ratio: ${imageLoaded ? "auto" : "297 / 210"};
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f5f5f5;
                border-radius: 4px;
              `}
            >
              {!imageLoaded && (
                <div
                  className={css`
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #999;
                    font-size: 14px;
                  `}
                >
                  <Spinner variant="medium" />
                </div>
              )}
              <img
                src={popupUrl}
                alt={t("certificate")}
                onLoad={() => setImageLoaded(true)}
                className={css`
                  display: block;
                  width: 800px;
                  height: auto;
                  max-width: 90vw;
                  max-height: 70vh;
                  object-fit: contain;
                  opacity: ${imageLoaded ? 1 : 0};
                  transition: opacity 0.2s ease-in-out;
                `}
              />
            </div>
            <div
              className={css`
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                padding: 1rem;
                border-top: 1px solid #e5e5e5;
              `}
            >
              <label
                htmlFor="verification-url-input"
                className={css`
                  font-size: 14px;
                  font-weight: 500;
                `}
              >
                {t("verification-url")}
              </label>
              <div
                className={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <input
                  id="verification-url-input"
                  type="text"
                  readOnly
                  value={verificationUrl}
                  className={css`
                    flex: 1;
                    padding: 8px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                    background: #f5f5f5;
                  `}
                />
                <Button
                  variant="secondary"
                  size="medium"
                  onClick={async () => {
                    const success = await copyToClipboard()
                    if (success) {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }
                  }}
                >
                  {copied ? t("button-text-copied") : t("button-text-copy")}
                </Button>
              </div>
            </div>
          </div>
        </StandardDialog>
      )}

      {editData && (
        <StandardDialog
          open={true}
          onClose={() => setEditData(null)}
          title={t("edit-certificate")}
          showCloseButton={true}
          isDismissable={true}
          noPadding={false}
          className={css`
            width: 360px !important;
            max-width: 90vw !important;
          `}
        >
          <TextField
            type="text"
            label={t("name-on-certificate")}
            placeholder={t("name-on-certificate")}
            value={editData.name_on_certificate}
            onChange={(e) =>
              setEditData((prev) =>
                prev ? { ...prev, name_on_certificate: e.target.value } : prev,
              )
            }
          />

          <DatePickerField
            label={t("date-issued")}
            value={formatDateForDateInputs(editData.date) ?? ""}
            onChangeByValue={(value) =>
              setEditData((prev) => (prev ? { ...prev, date: value } : prev))
            }
          />

          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
              margin-top: 1rem;
            `}
          >
            <Button
              fullWidth
              size="medium"
              variant="primary"
              disabled={!editDateValid || updateCertificateMutation.isPending}
              onClick={() => {
                if (!editData || !parsedEditDate || !editDateValid) {
                  return
                }
                updateCertificateMutation.mutate({
                  certificateId: editData.id,
                  body: {
                    date_issued: parsedEditDate.toISOString(),
                    name_on_certificate:
                      editData.name_on_certificate.trim() === ""
                        ? null
                        : editData.name_on_certificate,
                  },
                })
              }}
            >
              {t("button-text-update")}
            </Button>

            <Button fullWidth size="medium" variant="secondary" onClick={() => setEditData(null)}>
              {t("button-text-cancel")}
            </Button>
          </div>
        </StandardDialog>
      )}

      <StudentsTable
        columns={columns}
        data={rows}
        sorting={sorting}
        onSortingChange={onSortingChange}
      />
    </>
  )
}
