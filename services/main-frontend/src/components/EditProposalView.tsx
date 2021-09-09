import React from "react"

import { BlockProposal, PageProposal } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

export interface Props {
  proposal: PageProposal
}

const EditProposalView: React.FC<Props> = ({ proposal }) => {
  async function onAcceptAll() {
    //
  }

  async function onRejectAll() {
    //
  }

  async function onAccept(blockProposal: BlockProposal) {
    //
  }

  async function onReject(blockProposal: BlockProposal) {
    //
  }

  return (
    <>
      <div>{`Page: "${proposal.page_id}"`}</div>
      <ul>
        {proposal.block_proposals.map((b) => {
          return (
            <li key={b.id}>
              <div>{`Block: ${b.block_id}`}</div>
              <div>{`Current: "${b.current_text}"`}</div>
              <div>{`Proposal: "${b.changed_text}"`}</div>
              <div>{`Preview: "${b.accept_preview}"`}</div>
              <Button variant={"primary"} size={"medium"} onClick={() => onAccept(b)}>
                Accept
              </Button>
              <Button variant={"secondary"} size={"medium"} onClick={() => onReject(b)}>
                Reject
              </Button>
            </li>
          )
        })}
      </ul>
      <div>
        Sent by {proposal.user_id} at {proposal.created_at.toISOString()}
      </div>
      <Button variant={"primary"} size={"medium"} onClick={onAcceptAll}>
        Accept all
      </Button>
      <Button variant={"secondary"} size={"medium"} onClick={onRejectAll}>
        Reject all
      </Button>
    </>
  )
}

export default EditProposalView
