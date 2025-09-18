import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "@/shared-module/common/styles"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"

export interface InformationItem {
  label: string
  value: React.ReactNode
  key: string
}

export interface InformationCardProps {
  title: string
  items: InformationItem[]
  actionButton?: React.ReactNode
  className?: string
  maxWidth?: number
}

/**
 * Displays key-value pairs in a card layout with optional action button.
 *
 * @example
 * <KeyValueCard
 *   title="User Information"
 *   items={[
 *     { key: "id", label: "ID", value: "12345" },
 *     { key: "name", label: "Name", value: "John Doe" }
 *   ]}
 *   actionButton={<Button>View Details</Button>}
 * />
 */
const KeyValueCard: React.FC<InformationCardProps> = ({
  title,
  items,
  actionButton,
  className,
  maxWidth = narrowContainerWidthRem,
}) => {
  return (
    <div
      className={css`
        background-color: ${baseTheme.colors.clear[100]};
        border: 1px solid ${baseTheme.colors.clear[200]};
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 2rem;
        max-width: ${maxWidth}rem;
        margin-left: auto;
        margin-right: auto;
        ${className}
      `}
    >
      <h2
        className={css`
          margin: 0 0 1rem 0;
          font-size: 1.2rem;
          color: black;
        `}
      >
        {title}
      </h2>
      <div
        className={css`
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.5rem 1rem;
          align-items: center;
        `}
      >
        {items.map((item) => (
          <React.Fragment key={item.key}>
            <strong>{item.label}:</strong>
            <span>{item.value}</span>
          </React.Fragment>
        ))}
      </div>
      {actionButton && (
        <div
          className={css`
            margin-top: 1rem;
            text-align: right;
          `}
        >
          {actionButton}
        </div>
      )}
    </div>
  )
}

export default KeyValueCard
