"use client"

import { css } from "@emotion/css"

export const menuItemClass = css`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  margin: 4px 16px 12px 16px;
  font-size: 16px;
  font-weight: 500;
  color: #111827;
  text-decoration: none;
  border-radius: 12px;
  transition: all 150ms ease;
  cursor: pointer;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  width: calc(100% - 32px);
  text-align: left;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

  &:hover,
  &:focus {
    background: #f3f4f6;
    border-color: #d1d5db;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
    outline: none;
  }

  &:active {
    background: #e5e7eb;
    border-color: #9ca3af;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
    transform: translateY(0);
  }

  &[data-focus-visible] {
    outline: 2px solid #111827;
    outline-offset: 2px;
  }

  &[data-destructive="true"] {
    color: #dc2626;
    font-weight: 600;
    background: #fef2f2;
    border-color: #fecaca;

    &:hover,
    &:focus {
      background: #fee2e2;
      border-color: #fca5a5;
    }

    &:active {
      background: #fecaca;
      border-color: #f87171;
    }
  }
`

export const separatorClass = css`
  height: 1px;
  background: #e5e7eb;
  margin: 8px 0;
  border: none;
`

export const iconClass = css`
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
`
