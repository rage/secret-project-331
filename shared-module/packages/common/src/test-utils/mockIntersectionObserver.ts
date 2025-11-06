type ObserverInit = IntersectionObserverInit & { scrollMargin?: string }

const instances = new Set<MockIntersectionObserver>()
const elementToObserver = new Map<Element, MockIntersectionObserver>()

export class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null
  readonly rootMargin: string
  readonly scrollMargin: string
  readonly thresholds: ReadonlyArray<number>
  private elements: Set<Element>

  constructor(
    public callback: IntersectionObserverCallback,
    public options?: ObserverInit,
  ) {
    this.root = options?.root instanceof Element ? options.root : null
    this.rootMargin = options?.rootMargin ?? "0px 0px 0px 0px"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.scrollMargin = (options as any)?.scrollMargin ?? "0px 0px 0px 0px"
    this.thresholds = Array.isArray(options?.threshold)
      ? options!.threshold!.slice().sort((a, b) => a - b)
      : [options?.threshold ?? 0]

    this.elements = new Set<Element>()
    instances.add(this)
  }

  observe = (el: Element) => {
    this.elements.add(el)
    elementToObserver.set(el, this)
  }

  unobserve = (el: Element) => {
    this.elements.delete(el)
    elementToObserver.delete(el)
  }

  disconnect = () => {
    this.elements.forEach((el) => elementToObserver.delete(el))
    this.elements.clear()
    instances.delete(this)
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

export function setupIntersectionObserverMock() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).IntersectionObserver = MockIntersectionObserver
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).IntersectionObserver = MockIntersectionObserver
}

export function triggerIntersection(
  el: Element,
  opts: Partial<IntersectionObserverEntry> & {
    isIntersecting: boolean
    intersectionRatio?: number
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    boundingClientRect: opts.boundingClientRect ?? el.getBoundingClientRect?.() ?? ({} as any),
    rootBounds: opts.rootBounds ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    intersectionRect: opts.intersectionRect ?? ({} as any),
  }

  inst.callback([entry], inst as unknown as IntersectionObserver)
}
