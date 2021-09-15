import React from "react"

import { BlockProposal, PageProposal } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

export interface Props {
  proposal: PageProposal
  handleAcceptBlocks: (
    pageId: string,
    pageProposalId: string,
    blockProposals: BlockProposal[],
  ) => Promise<void>
  handleRejectBlocks: (
    pageId: string,
    pageProposalId: string,
    blockProposals: BlockProposal[],
  ) => Promise<void>
}

const EditProposalView: React.FC<Props> = ({
  proposal,
  handleAcceptBlocks,
  handleRejectBlocks,
}) => {
  const pendingBlock = (block: BlockProposal) => {
    return (
      <>
        <div>{`Block: ${block.block_id}`}</div>
        <div>{`Current: "${block.current_text}"`}</div>
        <div>{`Proposal: "${block.changed_text}"`}</div>
        <div>{`Preview: "${block.accept_preview}"`}</div>
        <Button
          variant={"primary"}
          size={"medium"}
          onClick={() => handleAcceptBlocks(proposal.page_id, proposal.id, [block])}
        >
          Accept
        </Button>{" "}
        <Button
          variant={"secondary"}
          size={"medium"}
          onClick={() => handleRejectBlocks(proposal.page_id, proposal.id, [block])}
        >
          Reject
        </Button>
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
      {proposal.pending && (
        <>
          <Button
            variant={"primary"}
            size={"medium"}
            onClick={() =>
              handleAcceptBlocks(proposal.page_id, proposal.id, proposal.block_proposals)
            }
          >
            Accept all
          </Button>
          <Button
            variant={"secondary"}
            size={"medium"}
            onClick={() =>
              handleRejectBlocks(proposal.page_id, proposal.id, proposal.block_proposals)
            }
          >
            Reject all
          </Button>
        </>
      )}
    </>
  )
}

export default EditProposalView
