import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { parseISO } from "date-fns"
import { diffChars } from "diff"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { usePageInfo } from "@/hooks/usePageInfo"
import {
  BlockProposal,
  BlockProposalAction,
  BlockProposalInfo,
  PageProposal,
} from "@/shared-module/common/bindings"
import { isEditedBlockStillExistsData } from "@/shared-module/common/bindings.guard"
import Button from "@/shared-module/common/components/Button"
import DiffFormatter from "@/shared-module/common/components/DiffFormatter"
import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"
import TextArea from "@/shared-module/common/components/InputFields/TextAreaField"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, primaryFont, typography } from "@/shared-module/common/styles"
import { pageRoute } from "@/shared-module/common/utils/routes"

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
  const [blockActions, setBlockActions] = useState<Map<string, BlockProposalAction>>(new Map())
  const [editingBlocks, setEditingBlocks] = useState<Set<string>>(new Set())

  const pageInfo = usePageInfo(proposal.page_id)

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
    let diffChanges = null
    if (isEditedBlockStillExistsData(block)) {
      diffChanges = diffChars(block.current_text, block.accept_preview ?? "")
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

        {editingBlocks.has(block.id) && isEditedBlockStillExistsData(block) && (
          <TextArea
            className={css`
              width: 100%;
            `}
            autoResize
            label={t(`change-request-edited-result-label`)}
            defaultValue={block.accept_preview ?? undefined}
            onChangeByValue={(newValue) =>
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
        <div
          className={css`
            display: flex;
            flex-direction: row;
            gap: 4px;
          `}
        >
          {isEditedBlockStillExistsData(block) && (
            <RadioButton
              value="accept"
              label={t("button-text-accept")}
              // eslint-disable-next-line i18next/no-literal-string
              name="accept-or-reject-proposal"
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
          {isEditedBlockStillExistsData(block) && (
            <RadioButton
              value="edit"
              label={t("edit-and-accept")}
              // eslint-disable-next-line i18next/no-literal-string
              name="accept-or-reject-proposal"
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
          )}
          <RadioButton
            value="reject"
            label={t("button-text-reject")}
            // eslint-disable-next-line i18next/no-literal-string
            name="accept-or-reject-proposal"
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
        </div>
      </div>
    )
  }

  const acceptedBlock = (block: BlockProposal) => {
    let diffChanges = null
    if (block.type == "edited-block-still-exists") {
      diffChanges = diffChars(block.original_text, block.changed_text ?? "")
    }
    return (
      <>
        {isEditedBlockStillExistsData(block) && diffChanges !== null ? (
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
        )}
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
