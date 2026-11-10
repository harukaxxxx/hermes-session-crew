// Boundary regression: the parent SDK PopoverContent is reached only via its ref.
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const source=await readFile(new URL('../desktop/plugin.js',import.meta.url),'utf8')
assert.doesNotMatch(source,/closest\s*\(\s*['"]\[data-slot=[^)]*popover-content/,'never traverse SDK markup to find the parent popover')
assert.match(source,/function Launchers\(\{[^}]*parentContentRef/,'launcher receives explicit parent ref')
assert.match(source,/parentContentRef\.current\?\.getBoundingClientRect\(\)/,'layout measures the referenced parent content')
assert.match(source,/parentContentRef\.current\?\.contains\(e\.target\)/,'outside interaction uses the referenced parent content')
assert.match(source,/children\(avatar,contentRef,[\s\S]*?,content\)/,'callback ref and object ref refer to the same SDK content')
assert.match(source,/Launchers,\{[^}]*parentContentRef/,'SDK content object ref is passed to the launcher')
console.log('PASS parent popover SDK ref boundary')
