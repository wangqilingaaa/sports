import { computed, ref } from 'vue'
import { useAtlas } from './useAtlas'
import { EXERCISE_MAP } from '@/data/exercises'
import type { Exercise } from '@/data/types'

/** 一次动作的相位划分：向心 → 顶峰等长 → 离心 → 间歇 */
const HOLD = 0.22
const REST = 0.4

const DEFAULT_EXERCISE = 'barbell-bench-press'

// 全局时钟：3D 模型与 2D 示意共用同一个收缩相位
const clock = ref(0)
let raf = 0
let lastTs = 0
let running = false

const atlas = useAtlas()

function frame(ts: number) {
  raf = requestAnimationFrame(frame)
  if (!lastTs) lastTs = ts
  const dt = Math.min(0.06, (ts - lastTs) / 1000)
  lastTs = ts
  if (atlas.isPlaying.value) clock.value += dt * atlas.speed.value
}

function start() {
  if (running) return
  running = true
  raf = requestAnimationFrame(frame)
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

export function useContraction() {
  start()

  const subject = computed<Exercise>(
    () => atlas.activeExercise.value ?? atlas.results.value[0] ?? EXERCISE_MAP.get(DEFAULT_EXERCISE)!,
  )

  const isIsometric = computed(() => subject.value.tempo[0] === 0 && subject.value.tempo[1] === 0)

  const cycleLen = computed(() => {
    const [conc, ecc] = subject.value.tempo
    if (conc === 0 && ecc === 0) return 2.4
    return conc + ecc + HOLD + REST
  })

  /** 0 = 完全拉长，1 = 最短 */
  const c = computed(() => {
    if (isIsometric.value) return 0.72
    const [conc, ecc] = subject.value.tempo
    const p = clock.value % cycleLen.value
    if (p < conc) return ease(p / conc)
    if (p < conc + HOLD) return 1
    const e = p - conc - HOLD
    if (e < ecc) return 1 - ease(e / ecc)
    return 0
  })

  const phase = computed<'concentric' | 'isometric' | 'eccentric'>(() => {
    if (isIsometric.value) return 'isometric'
    const [conc] = subject.value.tempo
    const p = clock.value % cycleLen.value
    if (p < conc) return 'concentric'
    if (p < conc + HOLD) return 'isometric'
    return 'eccentric'
  })

  const reps = computed(() => Math.floor(clock.value / cycleLen.value))

  const phaseProgress = computed(() => (clock.value % cycleLen.value) / cycleLen.value)

  const tensionOsc = computed(() => (isIsometric.value ? 0.94 + 0.05 * Math.sin(clock.value * 7) : 1))

  return {
    clock,
    subject,
    isIsometric,
    cycleLen,
    c,
    phase,
    reps,
    phaseProgress,
    tensionOsc,
    stop() {
      cancelAnimationFrame(raf)
      running = false
    },
  }
}
