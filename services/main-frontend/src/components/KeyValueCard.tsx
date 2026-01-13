"use client"
import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "@/shared-module/common/styles"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export interface InformationItem {
  label: string
  value: React.ReactNode
  key: string
  /** Number of columns to span (1-3, default: auto-fit) */
  colSpan?: number
}

export interface InformationSection {
  title: string
  items: InformationItem[]
  /** Total number of grid columns for this section (default: 3) */
  gridColumns?: number
}

export interface InformationCardProps {
  sections: InformationSection[]
  actionButtons?: React.ReactNode[]
  className?: string
  maxWidth?: number
}

/**
 * Displays key-value pairs in a card layout with optional action buttons.
 * Supports multiple sections with their own titles.
 * Each section can have flexible column spans for custom layouts.
 *
 * @example
 * <KeyValueCard
 *   sections={[
 *     {
 *       title: "Personal Information",
 *       items: [
 *         { key: "name", label: "Name", value: "John Doe" },
 *         { key: "email", label: "Email", value: "john@example.com" }
 *       ]
 *     }
 *   ]}
 *   actionButtons={[
 *     <Button key="edit">Edit</Button>,
 *     <Button key="delete" variant="secondary">Delete</Button>,
 *     <Button key="view">View Details</Button>
 *   ]}
 * />
 */
const KeyValueCard: React.FC<InformationCardProps> = ({
  sections,
  actionButtons,
  className,
  maxWidth = narrowContainerWidthRem,
}) => {
  const renderSection = (section: InformationSection, sectionIndex: number) => (
    <div key={sectionIndex}>
      <h3
        className={css`
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          color: ${baseTheme.colors.gray[700]};
          font-weight: 600;
          padding-bottom: 0.75rem;
          position: relative;

          &::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(
              90deg,
              ${baseTheme.colors.green[400]},
              ${baseTheme.colors.green[500]},
              ${baseTheme.colors.clear[200]}
            );
            border-radius: 1px;
          }
        `}
      >
        {section.title}
      </h3>
      <div
        className={css`
          display: grid;
          gap: 1rem;
          margin-bottom: ${sectionIndex < sections.length - 1 ? "2rem" : "0"};

          ${respondToOrLarger.md} {
            grid-template-columns: repeat(${section.gridColumns || 3}, 1fr);
            gap: 1.25rem;
          }
        `}
      >
        {section.items.map((item) => (
          <div
            key={item.key}
            className={css`
              display: flex;
              flex-direction: column;
              gap: 0.25rem;
              padding: 0.75rem;
              border-radius: 8px;
              background-color: ${baseTheme.colors.clear[100]};
              border: 1px solid ${baseTheme.colors.green[200]};
              position: relative;
              overflow: hidden;
              box-shadow: 0 2px 8px ${baseTheme.colors.clear[200]};

              &::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(
                  90deg,
                  ${baseTheme.colors.green[300]},
                  ${baseTheme.colors.green[400]}
                );
                opacity: 0.3;
              }

              ${respondToOrLarger.md} {
                grid-column: span ${item.colSpan || 1};
              }
            `}
          >
            <span
              className={css`
                font-size: 0.75rem;
                color: ${baseTheme.colors.gray[500]};
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
                margin-bottom: 0.25rem;
              `}
            >
              {item.label}
            </span>
            <span
              className={css`
                font-size: 1rem;
                font-weight: 500;
                color: ${baseTheme.colors.gray[700]};
                line-height: 1.4;
                overflow-wrap: break-word;
              `}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div
      className={css`
        background-color: white;
        border: 1px solid ${baseTheme.colors.green[200]};
        border-radius: 16px;
        padding: 1.5rem;
        margin-bottom: 2rem;
        max-width: ${maxWidth}rem;
        margin-left: auto;
        margin-right: auto;
        box-shadow: 0 4px 16px ${baseTheme.colors.clear[200]};

        ${respondToOrLarger.md} {
          padding: 2rem;
        }

        ${className}
      `}
    >
      {sections.map((section, index) => renderSection(section, index))}
      {actionButtons && actionButtons.length > 0 && (
        <div
          className={css`
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid ${baseTheme.colors.clear[200]};
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
            flex-wrap: wrap;
          `}
        >
          {actionButtons.map((button, index) => (
            <div key={index}>{button}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default KeyValueCard
