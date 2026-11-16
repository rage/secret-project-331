"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import React from "react"
import { useTranslation } from "react-i18next"

import { getPageHistoryOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { PageHistory } from "@/generated/api/types.generated"
import { Button, QueryResult } from "@/shared-module/components"

interface Props {
  pageId: string
  page: number
  limit: number
  selectedRevisionId: string | null
  onCompare: (ph: PageHistory) => void
  onRestore: (ph: PageHistory) => void
  /** When set, the selected revision's Restore button takes focus as it mounts, once. */
  focusRestoreOnMount?: React.RefObject<boolean>
}

const HistoryPage: React.FC<React.PropsWithChildren<Props>> = ({
  pageId,
  page,
  limit,
  selectedRevisionId,
  onCompare,
  onRestore,
  focusRestoreOnMount,
}) => {
  const { t, i18n } = useTranslation()
  const getPageHistory = useQuery({
    ...getPageHistoryOptions({
      path: {
        page_id: pageId,
      },
      query: {
        page,
        limit,
      },
    }),
  })

  const formatTime = (iso: string) => parseISO(iso).toLocaleString(i18n.language)

  return (
    <QueryResult
      query={getPageHistory}
      emptyFallback={<div>{t("error-could-not-find-edit-history-for-page")}</div>}
    >
      {(data) => (
        <>
          {data.map((h) => {
            return (
              <div
                key={h.id}
                className={
                  selectedRevisionId === h.id
                    ? /* TODO: Use Color Palette colors */
                      css`
                        background-color: LightBlue;
                      `
                    : ""
                }
              >
                <hr />
                <div>
                  {h.id} ({parseISO(h.created_at).toDateString()})
                </div>
                <div>
                  {h.history_change_reason === "PageSaved" &&
                    t("edited-by-on", {
                      user: h.author_user_id,
                      time: h.created_at,
                    })}
                  {h.history_change_reason === "HistoryRestored" &&
                    t("edited-by-on", {
                      id: h.restored_from_id,
                      user: h.author_user_id,
                      time: h.created_at,
                    })}
                  {h.agent_client_name && (
                    <> {t("edited-via-agent-client", { client: h.agent_client_name })}</>
                  )}
                </div>
                <div>
                  <Button
                    variant={"primary"}
                    size={"medium"}
                    aria-label={t("compare-revision-named", { time: formatTime(h.created_at) })}
                    onClick={() => onCompare(h)}
                  >
                    {t("button-compare")}
                  </Button>{" "}
                  <Button
                    ref={(el) => {
                      if (el && focusRestoreOnMount?.current && selectedRevisionId === h.id) {
                        focusRestoreOnMount.current = false
                        el.focus()
                      }
                    }}
                    variant={"primary"}
                    size={"medium"}
                    aria-label={t("restore-revision-named", { time: formatTime(h.created_at) })}
                    onClick={() => onRestore(h)}
                  >
                    {t("button-restore")}
                  </Button>
                </div>
              </div>
            )
          })}
        </>
      )}
    </QueryResult>
  )
}

export default HistoryPage
