import { readFile } from 'node:fs/promises'; import assert from 'node:assert/strict';
const source = await readFile(new URL('../desktop/plugin.js', import.meta.url), 'utf8');
assert.match(source, /id:\s*['"]sessioncrew['"]/); assert.doesNotMatch(source, /fixtureIntent|meta\.sessions|meta\.projects/); assert.match(source, /host\.openSession/); assert.doesNotMatch(source, /Boolean\(connectionId/); console.log('PASS runtime contract');
