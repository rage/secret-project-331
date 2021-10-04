import { css } from "@emotion/css"
import { FormControl, FormControlLabel, Radio, RadioGroup, TextField } from "@material-ui/core"
import React, { useState } from "react"

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
  const [blockActions, setBlockActions] = useState<Map<string, BlockProposalAction>>(new Map())
  const [editingBlocks, setEditingBlocks] = useState<Set<string>>(new Set())

  const pendingBlock = (block: BlockProposal) => {
    return (
      <>
        <div>{`Block: ${block.block_id}`}</div>
        <div
          className={css`
            max-height: 100px;
            overflow: scroll;
          `}
        >{`Current: "${block.current_text}"`}</div>
        <div
          className={css`
            max-height: 100px;
            overflow: scroll;
          `}
        >{`Proposal: "${block.changed_text}"`}</div>
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
                    ba.set(block.id, { tag: "Accept", data: ev.currentTarget.value })
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
          >{`Result: "${block.accept_preview}"`}</div>
        )}
        <FormControl component="fieldset">
          <RadioGroup row aria-label="accept or reject proposal" name="radio-buttons-group">
            {block.accept_preview !== null && (
              <FormControlLabel
                value="accept"
                control={<Radio />}
                label="Accept"
                onChange={() => {
                  setEditingBlocks((eb) => {
                    eb.delete(block.id)
                    return new Set(eb)
                  })
                  setBlockActions((ba) => {
                    if (block.accept_preview !== null) {
                      ba.set(block.id, { tag: "Accept", data: block.accept_preview })
                    }
                    return new Map(ba)
                  })
                }}
              />
            )}
            <FormControlLabel
              value="edit"
              control={<Radio />}
              label="Edit and accept"
              onChange={() => {
                setEditingBlocks((eb) => {
                  eb.add(block.id)
                  return new Set(eb)
                })
                setBlockActions((ba) => {
                  if (block.accept_preview !== null) {
                    ba.set(block.id, { tag: "Accept", data: block.accept_preview })
                  }
                  return new Map(ba)
                })
              }}
            />
            <FormControlLabel
              value="reject"
              control={<Radio />}
              label="Reject"
              onChange={() => {
                setEditingBlocks((eb) => {
                  eb.delete(block.id)
                  return new Set(eb)
                })
                setBlockActions((ba) => {
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
        {block.status === "Accepted" ? <div>Accepted</div> : <div>Rejected</div>}
        <div>{`Block: ${block.block_id}`}</div>
        <div>{`Current: "${block.current_text}"`}</div>
        <div>{`Proposal: "${block.changed_text}"`}</div>
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
      <div>{`Page: "${proposal.page_id}"`}</div>
      <ul>
        {proposal.block_proposals.map((b) => {
          return <li key={b.id}>{b.status === "Pending" ? pendingBlock(b) : acceptedBlock(b)}</li>
        })}
      </ul>
      <div>
        Sent by {proposal.user_id} at {proposal.created_at.toISOString()}
      </div>
      {blockActions.size < proposal.block_proposals.length && (
        <div>You have not selected an action for every change yet.</div>
      )}
      {proposal.pending && (
        <>
          <Button
            variant={"primary"}
            size={"medium"}
            onClick={onSend}
            disabled={blockActions.size < proposal.block_proposals.length}
          >
            Send
          </Button>
        </>
      )}
    </>
  )
}

export default EditProposalView
