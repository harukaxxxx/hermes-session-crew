// The previous event-tap regression required unsafe unmarked catch-up frames to
// light a badge. Its original is preserved in history; exercise the replacement
// source and the original read/owner/replay safety properties here instead.
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
for (const test of ['catchup-quarantine','snapshot-integration','snapshot-gap','snapshot-owner','snapshot-missing-owner','snapshot-malformed','snapshot-errors']) {
  const path=fileURLToPath(new URL(`./${test}.mjs`,import.meta.url))
  process.stdout.write(execFileSync(process.execPath,['--experimental-vm-modules',path],{encoding:'utf8',stdio:['ignore','pipe','inherit']}))
}
console.log('PASS completion snapshot regressions')
