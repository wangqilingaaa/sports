/**
 * 把 workout-guide 里用到的动作素材同步到 public/demo/。
 *
 * 只复制 src/data/demo-map.ts 里登记过的 slug（每个 3 帧），
 * 不把 906 张图全量塞进产物里。
 *
 *   pnpm run sync:demo
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = path.join(root, 'node_modules/@bryllim/workout-guide')
const outDir = path.join(root, 'public/demo')

if (!fs.existsSync(pkgDir)) {
  console.error('✗ 找不到 @bryllim/workout-guide，先跑 pnpm install')
  process.exit(1)
}

const mapSrc = fs.readFileSync(path.join(root, 'src/data/demo-map.ts'), 'utf8')
const slugs = [...mapSrc.matchAll(/^\s*'[^']+':\s*'([a-z0-9-]+)',$/gm)].map((m) => m[1])

if (!slugs.length) {
  console.error('✗ demo-map.ts 里没解析到任何 slug')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'manifest.json'), 'utf8'))
const known = new Set(manifest.map((e) => e.slug))

let copied = 0
let bytes = 0
const problems = []

for (const slug of new Set(slugs)) {
  if (!known.has(slug)) {
    problems.push(`slug 不在上游 manifest 里：${slug}`)
    continue
  }
  const from = path.join(pkgDir, 'assets', slug)
  const to = path.join(outDir, slug)
  if (!fs.existsSync(from)) {
    problems.push(`缺素材目录：${slug}`)
    continue
  }
  fs.mkdirSync(to, { recursive: true })
  for (const n of [1, 2, 3]) {
    const file = `frame-${n}.png`
    const src = path.join(from, file)
    if (!fs.existsSync(src)) {
      problems.push(`缺帧：${slug}/${file}`)
      continue
    }
    fs.copyFileSync(src, path.join(to, file))
    copied++
    bytes += fs.statSync(src).size
  }
}

// 清掉已经不再使用的旧目录
const active = new Set(slugs)
if (fs.existsSync(outDir)) {
  for (const d of fs.readdirSync(outDir)) {
    if (!active.has(d)) {
      fs.rmSync(path.join(outDir, d), { recursive: true, force: true })
      console.log(`- 移除过期素材 ${d}`)
    }
  }
}

console.log(`✓ 同步 ${active.size} 个动作 / ${copied} 帧 / ${(bytes / 1024 / 1024).toFixed(1)} MB → public/demo/`)
if (problems.length) {
  console.log(`\n⚠ ${problems.length} 处问题：`)
  for (const p of problems) console.log('  ' + p)
  process.exitCode = 1
}
