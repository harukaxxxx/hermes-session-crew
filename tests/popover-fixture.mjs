// React state/structure fixture only; real SDK positioning is covered in Chromium.
export function createPopoverFixture(React) {
  // JSDOM has no layout or animation frames; geometry runs in Chromium suites.
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = () => 0
    globalThis.cancelAnimationFrame = () => {}
  }
  const Context = React.createContext(null)
  function Popover({children, open: controlled, defaultOpen = false, onOpenChange}) {
    const [internal, setInternal] = React.useState(defaultOpen)
    const open = controlled === undefined ? internal : controlled
    const setOpen = value => { if (controlled === undefined) setInternal(value); onOpenChange?.(value) }
    return React.createElement(Context.Provider, {value: {open, setOpen}}, children)
  }
  const PopoverTrigger = React.forwardRef(function Trigger({children, asChild, onClick, ...props}, ref) {
    const context = React.useContext(Context)
    if (!context) throw Error('PopoverTrigger requires Popover')
    const child = asChild ? React.Children.only(children) : null
    const childRef = child?.props.ref
    const setRef = node => { for (const r of [childRef, ref]) { if (typeof r === 'function') r(node); else if (r) r.current = node } }
    const click = event => {
      child?.props.onClick?.(event)
      if (!event.defaultPrevented) onClick?.(event)
      if (!event.defaultPrevented) context.setOpen(!context.open)
    }
    const attrs = {...props, 'aria-expanded': context.open, onClick: click, ref: setRef}
    return asChild ? React.cloneElement(child, attrs) : React.createElement('button', {...attrs, type:'button'}, children)
  })
  const PopoverContent = React.forwardRef(function Content({children, style, className, id, role}, ref) {
    const context = React.useContext(Context)
    if (!context) throw Error('PopoverContent requires Popover')
    return context.open ? React.createElement('div', {ref, style, className, id, role}, children) : null
  })
  return {Popover, PopoverTrigger, PopoverContent}
}
