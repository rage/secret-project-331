import { applyLineWrapping } from "../lineHighlightPlugin"

function makeCodeElement(text: string, highlightLines: string): HTMLElement {
  const el = document.createElement("code")
  el.dataset.highlightLines = highlightLines
  el.textContent = text
  return el
}

describe("lineHighlightPlugin", () => {
  describe("applyLineWrapping", () => {
    it("wraps plain text lines into code-line spans", () => {
      const el = makeCodeElement("a\nb\nc", "1")
      applyLineWrapping(el)
      expect(el.querySelectorAll(".code-line").length).toBe(3)
      expect(el.querySelector("[data-line='1']")?.textContent).toBe("a")
    })

    it("applies highlighted-line class only to specified lines", () => {
      const el = makeCodeElement("a\nb\nc", "1,3")
      applyLineWrapping(el)
      const highlighted = el.querySelectorAll(".highlighted-line")
      expect(highlighted.length).toBe(2)
      expect(highlighted[0].textContent).toBe("a")
      expect(highlighted[1].textContent).toBe("c")
    })

    it("does nothing when no data-highlight-lines attribute", () => {
      const el = document.createElement("code")
      el.textContent = "a\nb"
      applyLineWrapping(el)
      expect(el.querySelectorAll(".code-line").length).toBe(0)
    })

    it("splits multi-line hljs span preserving scope", () => {
      const el = document.createElement("code")
      el.dataset.highlightLines = "2"
      el.innerHTML =
        '<span class="hljs-comment">/* <span class="hljs-doctag">@param</span> test\n   next */</span>'
      applyLineWrapping(el)

      const lines = el.querySelectorAll(".code-line")
      expect(lines.length).toBe(2)
      expect(lines[0].querySelector(".hljs-comment")).not.toBeNull()
      expect(lines[0].querySelector(".hljs-doctag")).not.toBeNull()
      expect(lines[1].querySelector(".hljs-comment")).not.toBeNull()
      expect(lines[1].classList.contains("highlighted-line")).toBe(true)
    })

    it("handles three levels of nesting with newline at deepest level", () => {
      const el = document.createElement("code")
      el.dataset.highlightLines = "1,2"
      el.innerHTML = '<span class="a"><span class="b"><span class="c">x\ny</span></span></span>'
      applyLineWrapping(el)

      const lines = el.querySelectorAll(".code-line")
      expect(lines.length).toBe(2)
      expect(lines[0].querySelector(".a .b .c")).not.toBeNull()
      expect(lines[1].querySelector(".a .b .c")).not.toBeNull()
    })

    it("skips if hljsLineWrapped is already set", () => {
      const el = document.createElement("code")
      el.dataset.highlightLines = "1"
      el.dataset.hljsLineWrapped = "true"
      el.innerHTML = "text"
      applyLineWrapping(el)
      expect(el.querySelectorAll(".code-line").length).toBe(0)
    })

    it("re-wraps when flag is cleared and called again", () => {
      const el = document.createElement("code")
      el.dataset.highlightLines = "1"
      el.innerHTML = "a\nb"
      applyLineWrapping(el)
      expect(el.querySelectorAll(".code-line").length).toBe(2)

      delete el.dataset.hljsLineWrapped
      el.innerHTML = "x\ny\nz"
      applyLineWrapping(el)
      expect(el.querySelectorAll(".code-line").length).toBe(3)
    })

    it("ignores NaN and non-positive numbers in data-highlight-lines", () => {
      const el = document.createElement("code")
      el.dataset.highlightLines = "1,NaN,-2,0,abc,3"
      el.innerHTML = "a\nb\nc"
      applyLineWrapping(el)
      const highlighted = el.querySelectorAll(".highlighted-line")
      expect(highlighted.length).toBe(2)
      expect(highlighted[0].getAttribute("data-line")).toBe("1")
      expect(highlighted[1].getAttribute("data-line")).toBe("3")
    })

    it("handles empty lines between spans", () => {
      const el = makeCodeElement("a\n\nc", "3")
      applyLineWrapping(el)
      const lines = el.querySelectorAll(".code-line")
      expect(lines.length).toBe(3)
      expect(lines[1].textContent).toBe("")
      expect(lines[1].querySelector("br")).not.toBeNull()
      expect(lines[2].classList.contains("highlighted-line")).toBe(true)
    })

    it("handles single line with no newlines", () => {
      const el = makeCodeElement("only", "1")
      applyLineWrapping(el)
      const lines = el.querySelectorAll(".code-line")
      expect(lines.length).toBe(1)
      expect(lines[0].classList.contains("highlighted-line")).toBe(true)
    })

    it("handles multi-line template literal span", () => {
      const el = document.createElement("code")
      el.dataset.highlightLines = "2"
      el.innerHTML = '<span class="hljs-string">`line1\nline2\nline3`</span>'
      applyLineWrapping(el)
      const lines = el.querySelectorAll(".code-line")
      expect(lines.length).toBe(3)
      lines.forEach((l) => {
        expect(l.querySelector(".hljs-string")).not.toBeNull()
      })
    })

    it("produces two lines when content ends with trailing newline, second line empty", () => {
      const el = makeCodeElement("a\n", "1")
      applyLineWrapping(el)
      const lines = el.querySelectorAll(".code-line")
      expect(lines.length).toBe(2)
      expect(lines[0].textContent).toBe("a")
      expect(lines[1].textContent).toBe("")
      expect(lines[1].querySelector("br")).not.toBeNull()
    })

    it("has no extra text nodes between code-line spans", () => {
      const el = makeCodeElement("a\nb\nc", "1")
      applyLineWrapping(el)
      const codeLines = el.querySelectorAll(".code-line")
      expect(codeLines.length).toBe(3)
      expect(el.childNodes.length).toBe(3)
      Array.from(el.childNodes).forEach((node) => {
        expect(node.nodeType).toBe(Node.ELEMENT_NODE)
        expect((node as Element).classList.contains("code-line")).toBe(true)
      })
    })

    it("sets aria-label on highlighted line spans for screen readers", () => {
      const el = makeCodeElement("a\nb\nc", "1,3")
      applyLineWrapping(el)
      const line1 = el.querySelector("[data-line='1']")
      const line2 = el.querySelector("[data-line='2']")
      const line3 = el.querySelector("[data-line='3']")
      expect(line1?.getAttribute("aria-label")).toBe("Line 1, highlighted")
      expect(line2?.getAttribute("aria-label")).toBeNull()
      expect(line3?.getAttribute("aria-label")).toBe("Line 3, highlighted")
    })
  })
})
