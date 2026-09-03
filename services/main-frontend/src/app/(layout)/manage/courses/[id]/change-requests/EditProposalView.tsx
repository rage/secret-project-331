"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { parseISO } from "date-fns"
import { diffWords } from "diff"
import React, { useMemo } from "react"
import { VisuallyHidden } from "react-aria"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type {
  BlockProposal,
  BlockProposalInfo,
  PageProposal,
} from "@/generated/api/types.generated"
import { usePageInfo } from "@/hooks/usePageInfo"
import DiffFormatter from "@/shared-module/common/components/DiffFormatter"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, primaryFont, typography } from "@/shared-module/common/styles"
import { pageRoute } from "@/shared-module/common/utils/routes"
import { Button, Radio, RadioGroup, TextArea } from "@/shared-module/components"

const ImportantText = styled.div`
  white-space: pre-wrap;
  border: 1px solid #ccc;
  padding: 0.5rem;
  margin: 0;
  font-family: ${primaryFont};
`

const ProposalExplanation = styled.p`
  margin-top: 0.5rem;
  font-weight: 500;
  color: ${baseTheme.colors.gray[600]};
  font-size: 0.9rem;
  line-height: 1.4;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-left: 3px solid #6c757d;
  border-radius: 0 4px 4px 0;
`

type EditedBlockStillExistsProposal = Extract<BlockProposal, { type: "edited-block-still-exists" }>

const isEditedBlockStillExistsData = (
  block: BlockProposal,
): block is EditedBlockStillExistsProposal => block.type === "edited-block-still-exists"

/**
 * Return true when the student's proposal exactly matches the text that will
 * finally appear on the page – i.e. there is nothing extra to show.
 */
const isProposedTextRedundant = (block: BlockProposal) => {
  if (isEditedBlockStillExistsData(block)) {
    // During the "pending" phase we compare the proposal against the current accept preview.
    return block.changed_text === (block.accept_preview ?? "")
  }
  // For other block types, we don't need to show the proposed text
  return true
}

type ProposalDecision = "accept" | "edit" | "reject"

interface ProposalFormFields {
  decisions: Record<string, ProposalDecision | "">
  editedTexts: Record<string, string>
}

/**
 * Turns one block's radio choice into the payload the backend expects, or `null` while there
 * is nothing valid to send yet (undecided, or "accept"/"edit" with no preview text to accept).
 */
function resolveBlockProposalInfo(
  block: BlockProposal,
  decision: ProposalDecision | "",
  editedText: string,
): BlockProposalInfo | null {
  if (decision === "reject") {
    // oxlint-disable-next-line i18next/no-literal-string
    return { id: block.id, action: { tag: "Reject" } }
  }
  if (decision === "accept" || decision === "edit") {
    const acceptPreview = isEditedBlockStillExistsData(block) ? block.accept_preview : undefined
    const data = decision === "edit" ? editedText : acceptPreview
    // oxlint-disable-next-line i18next/no-literal-string
    return data === null || data === undefined
      ? null
      : { id: block.id, action: { tag: "Accept", data } }
  }
  return null
}

export interface Props {
  proposal: PageProposal
  handleProposal: (
    pageId: string,
    pageProposalId: string,
    blockProposals: BlockProposalInfo[],
  ) => Promise<void>
}

const EditProposalView: React.FC<React.PropsWithChildren<Props>> = ({
  proposal,
  handleProposal,
}) => {
  const { t } = useTranslation()

  const pageInfo = usePageInfo(proposal.page_id)

  const defaultFormValues = useMemo<ProposalFormFields>(() => {
    const decisions: Record<string, ProposalDecision | ""> = {}
    const editedTexts: Record<string, string> = {}
    for (const block of proposal.block_proposals) {
      decisions[block.id] = ""
      editedTexts[block.id] = isEditedBlockStillExistsData(block)
        ? (block.accept_preview ?? "")
        : ""
    }
    return { decisions, editedTexts }
    // Seeded once from the proposal this view was mounted for; a resolved proposal never
    // reappears with new block data under the same component instance.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const { control, watch } = useForm<ProposalFormFields>({ defaultValues: defaultFormValues })
  const decisions = watch("decisions")
  const editedTexts = watch("editedTexts")

  const resolvedBlocks = useMemo(
    () =>
      proposal.block_proposals
        .map((block) =>
          resolveBlockProposalInfo(block, decisions[block.id] ?? "", editedTexts[block.id] ?? ""),
        )
        .filter((info): info is BlockProposalInfo => info !== null),
    [proposal.block_proposals, decisions, editedTexts],
  )

  const sendMutation = useToastMutation(
    () => handleProposal(proposal.page_id, proposal.id, resolvedBlocks),
    {
      notify: true,
      method: "POST",
    },
  )

  const pendingBlock = (block: BlockProposal) => {
    let diffChanges = null
    if (isEditedBlockStillExistsData(block)) {
      diffChanges = diffWords(block.current_text, block.accept_preview ?? "")
    }
    return (
      <div>
        <div>
          <HideTextInSystemTests
            text={t("block-id", { id: block.block_id })}
            testPlaceholder={t("block-id", { id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" })}
          />
        </div>
        {diffChanges ? (
          <div>
            <div>
              {t("label-current-text")}
              <ImportantText>
                <DiffFormatter dontShowAdded changes={diffChanges} />
              </ImportantText>
            </div>
            {!isProposedTextRedundant(block) && (
              <div>
                <ProposalExplanation>{t("proposal-edited-explanation")}</ProposalExplanation>
                <div>
                  {t("label-proposed-text")} <ImportantText>{block.changed_text}</ImportantText>
                </div>
              </div>
            )}
            <div>
              {t("label-result-after-merging")}
              <ImportantText>
                <DiffFormatter dontShowRemoved changes={diffChanges} />
              </ImportantText>
            </div>
          </div>
        ) : (
          <div>
            <div>
              {t("label-original-text")} <ImportantText>{block.original_text}</ImportantText>
            </div>
            {!isProposedTextRedundant(block) && (
              <div>
                <ProposalExplanation>{t("proposal-edited-explanation")}</ProposalExplanation>
                <div>
                  {t("label-proposed-text")} <ImportantText>{block.changed_text}</ImportantText>
                </div>
              </div>
            )}
          </div>
        )}

        {decisions[block.id] === "edit" && isEditedBlockStillExistsData(block) && (
          <TextArea
            className={css`
              width: 100%;
            `}
            autoResize
            name={`editedTexts.${block.id}`}
            control={control}
            label={t(`change-request-edited-result-label`)}
          />
        )}
        <RadioGroup
          name={`decisions.${block.id}`}
          control={control}
          // oxlint-disable-next-line i18next/no-literal-string
          orientation="horizontal"
          label={<VisuallyHidden>{t("label-proposal-action")}</VisuallyHidden>}
        >
          {isEditedBlockStillExistsData(block) && (
            <Radio value="accept" label={t("button-text-accept")} />
          )}
          {isEditedBlockStillExistsData(block) && (
            <Radio value="edit" label={t("edit-and-accept")} />
          )}
          <Radio value="reject" label={t("button-text-reject")} />
        </RadioGroup>
      </div>
    )
  }

  const acceptedBlock = (block: BlockProposal) => {
    let diffChanges = null
    if (block.type === "edited-block-still-exists") {
      diffChanges = diffWords(block.original_text, block.changed_text ?? "")
    }
    return isEditedBlockStillExistsData(block) && diffChanges !== null ? (
      <div>
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
        {!isProposedTextRedundant(block) && (
          <div>
            <ProposalExplanation>{t("proposal-edited-explanation")}</ProposalExplanation>
            <div>
              {t("label-proposed-text")}
              <ImportantText>
                <DiffFormatter dontShowRemoved changes={diffChanges} />
              </ImportantText>
            </div>
          </div>
        )}
      </div>
    ) : (
      <div>
        {block.status === "Accepted" ? <div>{t("accepted")}</div> : <div>{t("rejected")}</div>}
        <div>
          <HideTextInSystemTests
            text={t("block-id", { id: block.block_id })}
            testPlaceholder={t("block-id", { id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" })}
          />
        </div>
        <div>
          {t("label-original-text")}
          <ImportantText>{block.original_text}</ImportantText>
        </div>
        {!isProposedTextRedundant(block) && (
          <div>
            <ProposalExplanation>{t("proposal-edited-explanation")}</ProposalExplanation>
            <div>
              {t("label-proposed-text")}
              <ImportantText>{block.changed_text} </ImportantText>
            </div>
          </div>
        )}
      </div>
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
        <TimeComponent
          boldLabel={false}
          label={t("label-created")}
          date={parseISO(proposal.created_at)}
        />
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
                padding-top: 1rem;
              `}
              key={b.id}
            >
              {b.status === "Pending" ? pendingBlock(b) : acceptedBlock(b)}
            </li>
          )
        })}
      </ul>

      {proposal.pending && resolvedBlocks.length < proposal.block_proposals.length && (
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {t("message-you-have-not-selected-an-action-for-every-change-yet")}
        </div>
      )}
      {proposal.pending && (
        <Button
          variant={"primary"}
          size={"medium"}
          onClick={() => {
            sendMutation.mutate()
          }}
          disabled={resolvedBlocks.length < proposal.block_proposals.length}
        >
          {t("button-text-send")}
        </Button>
      )}
    </div>
  )
}

export default EditProposalView
