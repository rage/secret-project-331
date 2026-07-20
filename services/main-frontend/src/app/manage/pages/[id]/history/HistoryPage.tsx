"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import React from "react"
import { useTranslation } from "react-i18next"

import { getPageHistoryOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { PageHistory } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import { QueryResult } from "@/shared-module/components"

interface Props {
  pageId: string
  page: number
  limit: number
  selectedRevisionId: string | null
  onCompare: (ph: PageHistory) => void
  onRestore: (ph: PageHistory) => void
}

const HistoryPage: React.FC<React.PropsWithChildren<Props>> = ({
  pageId,
  page,
  limit,
  selectedRevisionId,
  onCompare,
  onRestore,
}) => {
  const { t } = useTranslation()
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
                </div>
                <div>
                  <Button variant={"primary"} size={"medium"} onClick={() => onCompare(h)}>
                    {t("button-compare")}
                  </Button>{" "}
                  <Button variant={"primary"} size={"medium"} onClick={() => onRestore(h)}>
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
