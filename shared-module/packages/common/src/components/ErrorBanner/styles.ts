import styled from "@emotion/styled"

import { baseTheme, monospaceFont } from "../../styles"

export const BannerWrapper = styled.div<{ compact?: boolean; isFrontendCrash?: boolean }>`
  background: ${(p) => (p.isFrontendCrash ? "#fff0f6" : "#fff5f5")};
  width: 100%;
  position: relative;
  margin: 0 auto;
  display: block;
  border-left: 4px solid ${(p) => (p.isFrontendCrash ? "#e64980" : "#da4453")};
  box-shadow: ${(p) => (p.isFrontendCrash ? "inset 0 0 0 1px #e64980" : "none")};
`

export const Content = styled.div<{ compact?: boolean }>`
  padding-top: ${(p) => (p.compact ? "1rem" : "3rem")};
  padding-bottom: ${(p) => (p.compact ? "1rem" : "3rem")};
  max-width: 100%;
  font-weight: 500;
  font-size: ${(p) => (p.compact ? "0.95rem" : "1rem")};
  line-height: 1.4;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;

  a {
    text-decoration: none;
    max-width: 100%;
    cursor: pointer;
    display: flex;
    height: 1rem;
    line-height: 1rem;
    margin-top: 1rem;

    span {
      display: flex;
      align-items: center;
      margin-left: 0.5rem;
    }
  }
`

export const Text = styled.div<{ compact?: boolean }>`
  padding: 0 ${(p) => (p.compact ? "1.5rem" : "2rem")};

  h2 {
    font-size: ${(p) => (p.compact ? "1.2rem" : "1.5rem")};
    margin: ${(p) => (p.compact ? "0 0 0.5rem 0" : "0 0 1rem 0")};
  }
`

export const DetailTag = styled.div`
  background: #ffe8ec;
  margin: 0 2rem;
  border-radius: 10px;
  overflow: hidden;
  details {
    padding: 0;
  }

  details[open] summary ~ * {
    color: ${baseTheme.colors.gray[700]};
  }

  details[open] > div {
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
  }

  details summary {
    padding: 0.75rem 1rem;
    position: relative;
    cursor: pointer;
    font-size: 1.1rem;
    font-weight: medium;
    list-style: none;
    color: ${baseTheme.colors.gray[700]};
    outline: 0;
    ::-webkit-details-marker {
      display: none;
    }
    &:hover {
      text-decoration: underline;
    }
  }

  details[open] > summary {
    color: #1c1c1c;
  }

  details[open] summary {
    opacity: 0.9;
  }

  ul {
    padding: 0;
    margin: 0;
    padding-bottom: 2rem;
  }

  ul li {
    font-size: 0.9rem;
    margin: 0 0 0.2rem;
    padding: 15px 30px;
    line-height: 1.7;
    list-style: none;
    background: #ffe3e8;
    border: 2px solid #f5b5c1;
    border-radius: 10px;

    &:nth-child(even) {
      background: #ffd6df;
    }
  }

  ul li pre {
    white-space: pre-wrap;
    font-family: ${monospaceFont};
    margin: 0;
  }

  ul li pre span {
    display: block;
    padding: 2px 0;
  }

  ul li pre span:nth-of-type(even) {
    background: #ffd6df;
  }
`
