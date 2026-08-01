import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim()
const diff = execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: repository })
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: repository })
  .toString()
  .split('\0')
  .filter(Boolean)
  .sort()
const dirty = diff.length > 0 || untracked.length > 0
const stateHash = createHash('sha256').update(diff)
untracked.forEach((path) => {
  stateHash.update(path)
  stateHash.update(readFileSync(resolve(repository, path)))
})
const diffHash = dirty ? stateHash.digest('hex').slice(0, 12) : null
const sourceState = dirty ? `${commit}+dirty.${diffHash}` : commit
const output = resolve(repository, 'src-tauri/target/build-provenance.json')

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify({
  schema: 'woodshed-build',
  version: 1,
  commit,
  dirty,
  diffHash,
  untrackedCount: untracked.length,
  sourceState,
  builtAt: new Date().toISOString(),
}, null, 2)}\n`, { mode: 0o644 })

const result = spawnSync('npm', ['run', 'build'], {
  cwd: repository,
  env: { ...process.env, VITE_BUILD_SHA: sourceState },
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
