import { css } from "@emotion/css"
import { FormControl, FormControlLabel, Radio, RadioGroup, TextField } from "@material-ui/core"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  BlockProposal,
  BlockProposalAction,
  BlockProposalInfo,
  PageProposal,
} from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

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

  const pendingBlock = (block: BlockProposal) => {
    return (
      <>
        <div>{t("block-id", { id: block.id })}</div>
        <div
          className={css`
            max-height: 100px;
            overflow: scroll;
          `}
          role="tabpanel"
        >
          {t("current-text", { "current-text": block.current_text })}
        </div>
        <div
          className={css`
            max-height: 100px;
            overflow: scroll;
          `}
          role="tabpanel"
          tabIndex={0}
        >
          {t("proposed-text", { "changed-text": block.changed_text })}
        </div>
        {editingBlocks.has(block.id) && (
          <>
            <TextField
              className={css`
                width: 100%;
              `}
              multiline
              maxRows={4}
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
          <div
            className={css`
              max-height: 100px;
              overflow: scroll;
            `}
          >
            {t("result", { result: block.accept_preview })}
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
      </>
    )
  }

  const acceptedBlock = (block: BlockProposal) => {
    return (
      <>
        {block.status === "Accepted" ? <div>{t("accepted")}</div> : <div>{t("rejected")}</div>}
        <div>{t("block-id", { id: block.block_id })}</div>
        <div>{t("current-text", { "current-text": block.current_text })}</div>
        <div>{t("proposed-text", { "changed-text": block.changed_text })}</div>
      </>
    )
  }

  const onSend = async (): Promise<void> => {
    const blockInfo: Array<BlockProposalInfo> = Array.from(blockActions).map(([id, action]) => {
      return { id, action }
    })
    await handleProposal(proposal.page_id, proposal.id, blockInfo)
  }

  return (
    <>
      <div>{t("title-page-id", { id: proposal.page_id })}</div>
      <ul>
        {proposal.block_proposals.map((b) => {
          return <li key={b.id}>{b.status === "Pending" ? pendingBlock(b) : acceptedBlock(b)}</li>
        })}
      </ul>
      <div>
        {t("sent-by-at", { user: proposal.user_id, time: proposal.created_at.toISOString() })}
      </div>
      {blockActions.size < proposal.block_proposals.length && (
        <div>{t("message-you-have-not-selected-an-action-for-every-change-yet")}</div>
      )}
      {proposal.pending && (
        <>
          <Button
            variant={"primary"}
            size={"medium"}
            onClick={onSend}
            disabled={blockActions.size < proposal.block_proposals.length}
          >
            {t("button-text-send")}
          </Button>
        </>
      )}
    </>
  )
}

export default EditProposalView
