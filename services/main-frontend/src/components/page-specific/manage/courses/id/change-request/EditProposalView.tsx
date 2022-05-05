import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { FormControl, FormControlLabel, Radio, RadioGroup } from "@mui/material"
import { diffChars } from "diff"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchPageInfo } from "../../../../../../services/backend/pages"
import {
  BlockProposal,
  BlockProposalAction,
  BlockProposalInfo,
  PageProposal,
} from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import DiffFormatter from "../../../../../../shared-module/components/DiffFormatter"
import HideTextInSystemTests from "../../../../../../shared-module/components/HideTextInSystemTests"
import TextArea from "../../../../../../shared-module/components/InputFields/TextAreaField"
import TimeComponent from "../../../../../../shared-module/components/TimeComponent"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { primaryFont, typography } from "../../../../../../shared-module/styles"
import { pageRoute } from "../../../../../../shared-module/utils/routes"

const ImportantText = styled.div`
  white-space: pre-wrap;
  border: 1px solid #ccc;
  padding: 0.5rem;
  margin: 0;
  font-family: ${primaryFont};
`

export interface Props {
  proposal: PageProposal
  handleProposal: (
    pageId: string,
    pageProposalId: string,
    blockProposals: BlockProposalInfo[],
  ) => Promise<void>
}

const EditProposalView: React.FC<Props> = ({ proposal, handleProposal }) => {
  const { t } = useTranslation()
  const [blockActions, setBlockActions] = useState<Map<string, BlockProposalAction>>(new Map())
  const [editingBlocks, setEditingBlocks] = useState<Set<string>>(new Set())

  const pageInfo = useQuery(`page-info-id-${proposal.page_id}`, () => {
    if (!proposal.page_id) {
      return null
    }
    return fetchPageInfo(proposal.page_id)
  })

  const sendMutation = useToastMutation(
    () => {
      const blockInfo: Array<BlockProposalInfo> = Array.from(blockActions).map(([id, action]) => {
        return { id, action }
      })
      return handleProposal(proposal.page_id, proposal.id, blockInfo)
    },
    {
      notify: true,
      method: "POST",
    },
  )

  const pendingBlock = (block: BlockProposal) => {
    const diffChanges = diffChars(block.current_text, block.accept_preview ?? "")
    return (
      <div>
        <div>
          <HideTextInSystemTests
            text={t("block-id", { id: block.block_id })}
            testPlaceholder={t("block-id", { id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" })}
          />
        </div>
        <div>
          {t("label-current-text")}
          <ImportantText>
            <DiffFormatter dontShowAdded changes={diffChanges} />
          </ImportantText>
        </div>
        <div>
          {t("label-proposed-text")} <ImportantText>{block.changed_text}</ImportantText>
        </div>
        <div>
          {t("label-result-after-merging")}
          <ImportantText>
            <DiffFormatter dontShowRemoved changes={diffChanges} />
          </ImportantText>
        </div>

        {editingBlocks.has(block.id) && (
          <TextArea
            className={css`
              width: 100%;
            `}
            autoResize
            label={t(`change-request-edited-result-label`)}
            defaultValue={block.accept_preview ?? undefined}
            onChange={(newValue) =>
              setBlockActions((ba) => {
                if (block.accept_preview !== null) {
                  // eslint-disable-next-line i18next/no-literal-string
                  ba.set(block.id, { tag: "Accept", data: newValue })
                }
                return new Map(ba)
              })
            }
          />
        )}

        {/* eslint-disable-next-line i18next/no-literal-string */}
        <FormControl component="fieldset">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <RadioGroup row aria-label={t("accept-or-reject-proposal")} name="radio-buttons-group">
            {block.accept_preview !== null && (
              <FormControlLabel
                // eslint-disable-next-line i18next/no-literal-string
                value="accept"
                control={<Radio />}
                label={t("button-text-accept")}
                onChange={() => {
                  setEditingBlocks((eb) => {
                    eb.delete(block.id)
                    return new Set(eb)
                  })
                  setBlockActions((ba) => {
                    if (block.accept_preview !== null) {
                      // eslint-disable-next-line i18next/no-literal-string
                      ba.set(block.id, { tag: "Accept", data: block.accept_preview })
                    }
                    return new Map(ba)
                  })
                }}
              />
            )}
            <FormControlLabel
              // eslint-disable-next-line i18next/no-literal-string
              value="edit"
              control={<Radio />}
              label={t("edit-and-accept")}
              onChange={() => {
                setEditingBlocks((eb) => {
                  eb.add(block.id)
                  return new Set(eb)
                })
                setBlockActions((ba) => {
                  if (block.accept_preview !== null) {
                    // eslint-disable-next-line i18next/no-literal-string
                    ba.set(block.id, { tag: "Accept", data: block.accept_preview })
                  }
                  return new Map(ba)
                })
              }}
            />
            <FormControlLabel
              // eslint-disable-next-line i18next/no-literal-string
              value="reject"
              control={<Radio />}
              label={t("button-text-reject")}
              onChange={() => {
                setEditingBlocks((eb) => {
                  eb.delete(block.id)
                  return new Set(eb)
                })
                setBlockActions((ba) => {
                  // eslint-disable-next-line i18next/no-literal-string
                  ba.set(block.id, { tag: "Reject" })
                  return new Map(ba)
                })
              }}
            />
          </RadioGroup>
        </FormControl>
      </div>
    )
  }

  const acceptedBlock = (block: BlockProposal) => {
    const diffChanges = diffChars(block.original_text, block.changed_text ?? "")
    return (
      <>
        {block.status === "Accepted" ? <div>{t("accepted")}</div> : <div>{t("rejected")}</div>}
        <div>
          <HideTextInSystemTests
            text={t("block-id", { id: block.block_id })}
            testPlaceholder={t("block-id", { id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" })}
          />
        </div>
        <div>
          {t("label-current-text")} <ImportantText>{block.current_text}</ImportantText>
        </div>
        <div>
          {t("label-original-text")}
          <ImportantText>
            <DiffFormatter dontShowAdded changes={diffChanges} />
          </ImportantText>
        </div>
        <div>
          {t("label-proposed-text")}
          <ImportantText>
            <DiffFormatter dontShowRemoved changes={diffChanges} />
          </ImportantText>
        </div>
      </>
    )
  }

  return (
    <div
      className={css`
        border: 1px solid #e5e5e5;
        margin-bottom: 2rem;
        margin-top: 2rem;
        padding: 1rem;
      `}
    >
      {proposal.page_url_path && pageInfo.data && (
        <a
          className={css`
            display: block;
            float: right;
          `}
          href={`${pageRoute(
            pageInfo.data,
            proposal.page_url_path,
          )}?highlight-blocks=${proposal.block_proposals.map((bp) => bp.block_id).join(",")}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          <Button variant="secondary" size="medium">
            {t("open-page-in-new-tab")}
          </Button>
        </a>
      )}
      <h2
        className={css`
          font-size: ${typography.h6};
          margin-bottom: 0.5rem;
        `}
      >
        {t("title-change-request")}
      </h2>
      {proposal.page_id && (
        <div>
          {t("label-page")} {proposal.page_title} <small>({proposal.page_url_path})</small>
        </div>
      )}
      <div>
        <HideTextInSystemTests
          text={t("sent-by", { user: proposal.user_id })}
          testPlaceholder="Sent by: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </div>
      <div>
        <TimeComponent boldLabel={false} label={t("label-created")} date={proposal.created_at} />
      </div>
      <ul
        className={css`
          list-style: none;
          padding: 0;
        `}
      >
        {proposal.block_proposals.map((b) => {
          return (
            <li
              className={css`
                padding: 1rem;
              `}
              key={b.id}
            >
              {b.status === "Pending" ? pendingBlock(b) : acceptedBlock(b)}
            </li>
          )
        })}
      </ul>

      {proposal.pending && blockActions.size < proposal.block_proposals.length && (
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {t("message-you-have-not-selected-an-action-for-every-change-yet")}
        </div>
      )}
      {proposal.pending && (
        <>
          <Button
            variant={"primary"}
            size={"medium"}
            onClick={() => {
              sendMutation.mutate()
            }}
            disabled={blockActions.size < proposal.block_proposals.length}
          >
            {t("button-text-send")}
          </Button>
        </>
      )}
    </div>
  )
}

export default EditProposalView
