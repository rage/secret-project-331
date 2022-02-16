import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { FormControl, FormControlLabel, Radio, RadioGroup, TextField } from "@mui/material"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  BlockProposal,
  BlockProposalAction,
  BlockProposalInfo,
  PageProposal,
} from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import HideTextInSystemTests from "../../../../../../shared-module/components/HideTextInSystemTests"
import TimeComponent from "../../../../../../shared-module/components/TimeComponent"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { primaryFont, typography } from "../../../../../../shared-module/styles"

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
    return (
      <div>
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
          {t("label-proposed-text")} <ImportantText>{block.changed_text}</ImportantText>
        </div>
        {editingBlocks.has(block.id) && (
          <>
            <TextField
              className={css`
                width: 100%;
              `}
              multiline
              maxRows={4}
              inputProps={{ "aria-label": t(`proposed-text-input-label`) }}
              defaultValue={block.accept_preview}
              onChange={(ev) =>
                setBlockActions((ba) => {
                  if (block.accept_preview !== null) {
                    // eslint-disable-next-line i18next/no-literal-string
                    ba.set(block.id, { tag: "Accept", data: ev.target.value })
                  }
                  return new Map(ba)
                })
              }
            ></TextField>
            <br />
          </>
        )}
        {!editingBlocks.has(block.id) && (
          <div>
            {t("label-result")}
            <ImportantText>{block.accept_preview}</ImportantText>
          </div>
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
          {t("label-proposed-text")} <ImportantText>{block.changed_text}</ImportantText>
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
