type ObserverInit = IntersectionObserverInit & { scrollMargin?: string }

const instances = new Set<MockIntersectionObserver>()
const elementToObserver = new Map<Element, MockIntersectionObserver>()

export class MockIntersectionObserver implements IntersectionObserver {
  public readonly root: Element | null
  public readonly rootMargin: string
  public readonly scrollMargin: string
  public readonly thresholds: readonly number[]
  private elements: Set<Element>
  public callback: IntersectionObserverCallback
  public options?: ObserverInit

  public constructor(callback: IntersectionObserverCallback, options?: ObserverInit) {
    this.callback = callback
    this.options = options
    this.root = options?.root instanceof Element ? options.root : null
    this.rootMargin = options?.rootMargin ?? "0px 0px 0px 0px"
    // oxlint-disable-next-line typescript/no-explicit-any
    this.scrollMargin = (options as any)?.scrollMargin ?? "0px 0px 0px 0px"
    this.thresholds = Array.isArray(options?.threshold)
      ? // oxlint-disable-next-line typescript/no-non-null-assertion -- Array.isArray guard above ensures both are defined
        options!.threshold!.slice().toSorted((a, b) => a - b)
      : [options?.threshold ?? 0]

    this.elements = new Set<Element>()
    instances.add(this)
  }

  public observe = (el: Element) => {
    this.elements.add(el)
    elementToObserver.set(el, this)
  }

  public unobserve = (el: Element) => {
    this.elements.delete(el)
    elementToObserver.delete(el)
  }

  public disconnect = () => {
    this.elements.forEach((el) => elementToObserver.delete(el))
    this.elements.clear()
    instances.delete(this)
  }

  public takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

export function setupIntersectionObserverMock() {
  // oxlint-disable-next-line typescript/no-explicit-any
  ;(global as any).IntersectionObserver = MockIntersectionObserver
  // oxlint-disable-next-line typescript/no-explicit-any
  ;(window as any).IntersectionObserver = MockIntersectionObserver
}

export function triggerIntersection(
  el: Element,
  opts: Partial<IntersectionObserverEntry> & {
    isIntersecting: boolean
    intersectionRatio?: number
    // oxlint-disable-next-line unicorn/no-object-as-default-parameter -- default applies only when opts is fully omitted
  } = {
    isIntersecting: true,
    intersectionRatio: 1,
  },
) {
  const inst = elementToObserver.get(el)
  if (!inst) {
    throw new Error("No observer registered for element")
  }

  const entry: IntersectionObserverEntry = {
    time: opts.time ?? 0,
    target: el,
    isIntersecting: opts.isIntersecting,
    intersectionRatio: opts.intersectionRatio ?? (opts.isIntersecting ? 1 : 0),
    // oxlint-disable-next-line typescript/no-explicit-any
    boundingClientRect: opts.boundingClientRect ?? el.getBoundingClientRect?.() ?? ({} as any),
    rootBounds: opts.rootBounds ?? null,
    // oxlint-disable-next-line typescript/no-explicit-any
    intersectionRect: opts.intersectionRect ?? ({} as any),
  }

  inst.callback([entry], inst as unknown as IntersectionObserver)
}
