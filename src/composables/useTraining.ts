import { computed, ref, watch } from 'vue'
import { EXERCISE_MAP } from '@/data/exercises'
import {
  buildPlan,
  DAYS_TO_SPLIT,
  LEVEL_VOLUME_SCALE,
  PHASE_VOLUME_SCALE,
  PLAN_ROUNDS,
  SPLIT_MAP,
  SPLITS,
  VOLUME_GROUP_DEFS,
  VOLUME_TARGETS,
  type DaysPerWeek,
  type GoalId,
  type Level,
  type PlanConfig,
  type PlanSwaps,
  type SplitId,
} from '@/data/training-plan'
import type { MuscleId } from '@/data/types'

export type HeatRange = 'session' | 'recent' | 'all'

export interface LogEntry {
  id: string
  /** 全程第几次训练，从 1 开始 */
  sessionIndex: number
  exerciseId: string
  sets: number
  reps: number
  /** 负重 kg；自重动作记 0 */
  weight: number
  rpe: number
  /** 来自计划的训练日 key；自由打卡为空 */
  sessionKey?: string
  /** 记录时间，仅用于排序，界面不展示日期 */
  createdAt: number
}

export interface MuscleLoad {
  id: MuscleId
  /** 有效组数 = 组数 × 激活占比 × RPE 系数 */
  sets: number
  /** 外部负重的训练容量 kg */
  volume: number
  /** 参与的动作次数 */
  hits: number
}

export interface LogInput {
  sessionIndex: number
  exerciseId: string
  sets: number
  reps: number
  weight: number
  rpe: number
  sessionKey?: string
}

export interface SessionStats {
  sets: number
  volume: number
  minutes: number
}

export type VolumeStatus = 'low' | 'ok' | 'high'

export interface VolumeAuditItem {
  id: string
  zh: string
  sets: number
  min: number
  max: number
  status: VolumeStatus
}

const STORAGE_KEY = 'atlas.training.v1'

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** 旧版计划把训练日固定在星期几；迁移旧记录时用它将日期换算成训练次序 */
const LEGACY_WEEKDAY_OFFSETS: Record<DaysPerWeek, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
}

interface LegacyLog {
  id?: unknown
  date?: unknown
  sessionIndex?: unknown
  exerciseId?: unknown
  sets?: unknown
  reps?: unknown
  weight?: unknown
  rpe?: unknown
  sessionKey?: unknown
  createdAt?: unknown
}

function defaultConfig(): PlanConfig {
  return {
    goal: 'hypertrophy',
    level: 2,
    split: 'ul',
  }
}

const VALID_GOALS: GoalId[] = ['hypertrophy', 'strength', 'recondition']
const VALID_DAYS: DaysPerWeek[] = [2, 3, 4, 5, 6]
const VALID_LEVELS: Level[] = [1, 2, 3]
const VALID_SPLITS: SplitId[] = SPLITS.map((split) => split.id)

const config = ref<PlanConfig>(defaultConfig())
const logs = ref<LogEntry[]>([])
/** 用户自己换过的动作位；计划本身仍由配置推导，这里是覆盖层 */
const swaps = ref<PlanSwaps>({})

/** 存档里的替换表只认仍在动作库里的 id，避免数据更新后留下空动作 */
function normalizeSwaps(raw: unknown): PlanSwaps {
  if (!raw || typeof raw !== 'object') return {}
  const out: PlanSwaps = {}
  for (const [slotKey, exerciseId] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof exerciseId === 'string' && EXERCISE_MAP.has(exerciseId)) out[slotKey] = exerciseId
  }
  return out
}

/** 旧版按日期存储的记录：用旧 startDate 折算成「第几次训练」 */
function legacyIndexForDate(date: string, startDate: string, days: DaysPerWeek): number {
  const diff = Math.floor(
    (parseDateKey(date).getTime() - parseDateKey(startDate).getTime()) / 86400000,
  )
  if (diff < 0) return 1
  const round = Math.min(PLAN_ROUNDS, Math.floor(diff / 7) + 1)
  const d = parseDateKey(date)
  const weekday = (d.getDay() + 6) % 7
  const dayIndex = LEGACY_WEEKDAY_OFFSETS[days].indexOf(weekday)
  // 自由记录可能落在非训练日，归入该轮第一个训练日，避免丢失
  return (round - 1) * days + (dayIndex >= 0 ? dayIndex + 1 : 1)
}

function normalizeLog(
  raw: LegacyLog,
  legacyStart: string | null,
  days: DaysPerWeek,
): LogEntry | null {
  if (
    typeof raw.id !== 'string' ||
    typeof raw.exerciseId !== 'string' ||
    typeof raw.sets !== 'number' ||
    typeof raw.reps !== 'number'
  ) {
    return null
  }

  let index: number | null = typeof raw.sessionIndex === 'number' ? raw.sessionIndex : null
  if (index === null && typeof raw.date === 'string' && legacyStart) {
    index = legacyIndexForDate(raw.date, legacyStart, days)
  }
  if (index === null || !Number.isFinite(index)) return null

  const createdAt =
    typeof raw.createdAt === 'number'
      ? raw.createdAt
      : typeof raw.date === 'string'
        ? parseDateKey(raw.date).getTime()
        : Date.now()
  const total = PLAN_ROUNDS * days

  return {
    id: raw.id,
    sessionIndex: Math.min(total, Math.max(1, Math.round(index))),
    exerciseId: raw.exerciseId,
    sets: raw.sets,
    reps: raw.reps,
    weight: typeof raw.weight === 'number' ? raw.weight : 0,
    rpe: typeof raw.rpe === 'number' ? raw.rpe : 7,
    sessionKey: typeof raw.sessionKey === 'string' ? raw.sessionKey : undefined,
    createdAt,
  }
}

/** 同一次训练的同个动作只保留一条记录，优先保留带计划标记的最新记录 */
function dedupeLogs(list: LogEntry[]): LogEntry[] {
  const map = new Map<string, LogEntry>()
  for (const log of list) {
    const key = `${log.sessionIndex}:${log.exerciseId}`
    const prev = map.get(key)
    if (!prev) {
      map.set(key, log)
      continue
    }
    const next = log.createdAt >= prev.createdAt ? log : prev
    map.set(key, { ...next, sessionKey: next.sessionKey ?? prev.sessionKey })
  }
  return [...map.values()]
}

/** 从本地存档恢复；旧版按日期的记录会迁移成训练次序 */
function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as {
      config?: Record<string, unknown>
      logs?: unknown[]
      swaps?: unknown
    }
    const c = parsed.config
    let legacyStart: string | null = null
    let legacyDays: DaysPerWeek = SPLIT_MAP.get(config.value.split)?.days ?? 4
    if (c) {
      if (typeof c.goal === 'string' && VALID_GOALS.includes(c.goal as GoalId)) {
        config.value.goal = c.goal as GoalId
      }
      if (typeof c.level === 'number' && VALID_LEVELS.includes(c.level as Level)) {
        config.value.level = c.level as Level
      }
      if (typeof c.days === 'number' && VALID_DAYS.includes(c.days as DaysPerWeek)) {
        legacyDays = c.days as DaysPerWeek
        config.value.split = DAYS_TO_SPLIT[legacyDays]
      }
      if (typeof c.split === 'string' && VALID_SPLITS.includes(c.split as SplitId)) {
        config.value.split = c.split as SplitId
        legacyDays = SPLIT_MAP.get(config.value.split)?.days ?? legacyDays
      }
      if (typeof c.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.startDate)) {
        legacyStart = c.startDate
      }
    }
    if (Array.isArray(parsed.logs)) {
      logs.value = dedupeLogs(
        parsed.logs
          .map((entry) => normalizeLog(entry as LegacyLog, legacyStart, legacyDays))
          .filter((entry): entry is LogEntry => !!entry),
      )
    }
    swaps.value = normalizeSwaps(parsed.swaps)
  } catch {
    /* 存档不可用时按默认计划运行 */
  }
}

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ config: config.value, logs: logs.value, swaps: swaps.value }),
    )
  } catch {
    /* 隐私模式或配额不足时静默失败 */
  }
}

hydrate()
persist()
watch([config, logs, swaps], persist, { deep: true })

const selectedIndex = ref(1)
const heatRange = ref<HeatRange>('session')

const plan = computed(() => buildPlan(config.value, swaps.value))
const totalSessions = computed(() => plan.value.length)
const activeSplit = computed(() => SPLIT_MAP.get(config.value.split) ?? SPLITS[0])
const activeSession = computed(() => plan.value[selectedIndex.value - 1] ?? plan.value[0])
const activeDay = computed(() => activeSession.value.day)

/** 已完成的训练次序：该次训练存在带计划标记的打卡即视为完成 */
const doneIndexes = computed(() => {
  const set = new Set<number>()
  for (const log of logs.value) {
    if (log.sessionKey && log.sessionIndex <= totalSessions.value) set.add(log.sessionIndex)
  }
  return set
})

const completedCount = computed(() => doneIndexes.value.size)

/** 下一次未完成的训练；全部完成时停留在最后一练 */
const nextIndex = computed(() => {
  for (let i = 1; i <= totalSessions.value; i++) {
    if (!doneIndexes.value.has(i)) return i
  }
  return totalSessions.value
})

const allDone = computed(() => completedCount.value >= totalSessions.value)

function sessionDone(index: number): boolean {
  return doneIndexes.value.has(index)
}

function logsForSession(index: number): LogEntry[] {
  return logs.value.filter((l) => l.sessionIndex === index)
}

function logFor(index: number, exerciseId: string): LogEntry | null {
  return logs.value.find((l) => l.sessionIndex === index && l.exerciseId === exerciseId) ?? null
}

function lastLogFor(exerciseId: string): LogEntry | null {
  let latest: LogEntry | null = null
  for (const l of logs.value) {
    if (l.exerciseId !== exerciseId) continue
    if (!latest || l.createdAt > latest.createdAt) latest = l
  }
  return latest
}

function upsertLog(input: LogInput) {
  const idx = logs.value.findIndex(
    (l) => l.sessionIndex === input.sessionIndex && l.exerciseId === input.exerciseId,
  )
  const clean = {
    sessionIndex: Math.max(1, Math.round(input.sessionIndex)),
    exerciseId: input.exerciseId,
    sets: Math.max(1, Math.round(input.sets)),
    reps: Math.max(1, Math.round(input.reps)),
    weight: Math.max(0, Number(input.weight.toFixed(1))),
    rpe: Math.min(10, Math.max(4, input.rpe)),
    sessionKey: input.sessionKey,
  }
  if (idx >= 0) {
    const prev = logs.value[idx]
    logs.value[idx] = {
      ...prev,
      ...clean,
      // 自由打卡补记计划动作时保留计划标记，避免把已完成训练退回未完成
      sessionKey: clean.sessionKey ?? prev.sessionKey,
    }
    return
  }
  logs.value.push({
    ...clean,
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  })
}

function removeLog(id: string) {
  logs.value = logs.value.filter((l) => l.id !== id)
}

function effortFactor(rpe: number): number {
  if (rpe >= 9) return 1.1
  if (rpe >= 8) return 1
  if (rpe >= 6) return 0.85
  return 0.7
}

/** 当前热图范围涉及的训练次序 */
const heatIndexes = computed(() => {
  if (heatRange.value === 'all') return null
  if (heatRange.value === 'recent') {
    return { from: Math.max(1, selectedIndex.value - 7), to: selectedIndex.value }
  }
  return { from: selectedIndex.value, to: selectedIndex.value }
})

const heatLogs = computed(() => {
  const range = heatIndexes.value
  if (!range) return logs.value
  return logs.value.filter((l) => l.sessionIndex >= range.from && l.sessionIndex <= range.to)
})

const heatScopeLabel = computed(() => {
  if (heatRange.value === 'all') return '全部记录'
  if (heatRange.value === 'recent') {
    const from = Math.max(1, selectedIndex.value - 7)
    return from === selectedIndex.value ? `第 ${from} 练` : `第 ${from}–${selectedIndex.value} 练`
  }
  return `第 ${selectedIndex.value} 练`
})

/** 肌群训练强度：有效组 = 组数 × 该动作对该肌群的激活占比 × RPE 系数 */
const heatDetail = computed<MuscleLoad[]>(() => {
  const map = new Map<MuscleId, MuscleLoad>()
  for (const log of heatLogs.value) {
    const ex = EXERCISE_MAP.get(log.exerciseId)
    if (!ex) continue
    const factor = effortFactor(log.rpe)
    for (const hit of ex.muscles) {
      const cur = map.get(hit.id) ?? { id: hit.id, sets: 0, volume: 0, hits: 0 }
      cur.sets += log.sets * (hit.activation / 100) * factor
      cur.volume += log.sets * log.reps * log.weight * (hit.activation / 100)
      cur.hits += 1
      map.set(hit.id, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.sets - a.sets)
})

const heatScores = computed<Partial<Record<MuscleId, number>>>(() => {
  const out: Partial<Record<MuscleId, number>> = {}
  for (const item of heatDetail.value) out[item.id] = item.sets
  return out
})

const heatMax = computed(() => Math.max(1, ...heatDetail.value.map((m) => m.sets)))

const trainedMuscleCount = computed(() => heatDetail.value.filter((m) => m.sets > 0.15).length)

const sessionStats = computed<SessionStats>(() => {
  const list = logs.value.filter((l) => l.sessionIndex === selectedIndex.value)
  let sets = 0
  let volume = 0
  let workSeconds = 0
  for (const l of list) {
    sets += l.sets
    volume += l.sets * l.reps * l.weight
    workSeconds += l.sets * (40 + effortFactor(l.rpe) * 20)
  }
  return {
    sets,
    volume: Math.round(volume),
    minutes: Math.round(workSeconds / 60),
  }
})

/** 主动肌计 1 组、协同肌计 0.5 组；同一动作对同一肌群取最高一次，避免重复累计 */
function muscleCredit(role: 'primary' | 'secondary' | 'stabilizer'): number {
  if (role === 'primary') return 1
  if (role === 'secondary') return 0.5
  return 0
}

/** 当前轮的计划容量：按处方累计每肌群直接组，并按分期与水平折算目标区间 */
const volumeAudit = computed<VolumeAuditItem[]>(() => {
  const phase = activeSession.value.phase
  const scale = PHASE_VOLUME_SCALE[phase.id] * LEVEL_VOLUME_SCALE[config.value.level]
  const targets = VOLUME_TARGETS[config.value.goal]
  const sessions = plan.value.filter((session) => session.round === activeSession.value.round)
  const totals = new Map<string, number>()

  for (const session of sessions) {
    for (const item of session.day.exercises) {
      // 代谢收尾不计入力量容量，避免把摆荡类动作算成臀部/腘绳组数
      if (item.role === 'conditioning') continue
      const exercise = EXERCISE_MAP.get(item.exerciseId)
      if (!exercise) continue
      for (const group of VOLUME_GROUP_DEFS) {
        let credit = 0
        for (const hit of exercise.muscles) {
          if (!group.members.includes(hit.id)) continue
          credit = Math.max(credit, muscleCredit(hit.role))
        }
        if (credit > 0) {
          totals.set(group.id, (totals.get(group.id) ?? 0) + item.prescription.sets * credit)
        }
      }
    }
  }

  return VOLUME_GROUP_DEFS.map((group) => {
    const sets = Math.round((totals.get(group.id) ?? 0) * 10) / 10
    const [minRaw, maxRaw] = targets[group.type]
    const min = Math.max(1, Math.floor(minRaw * scale))
    const max = Math.max(min, Math.ceil(maxRaw * scale))
    const status: VolumeStatus = sets < min ? 'low' : sets > max ? 'high' : 'ok'
    return { id: group.id, zh: group.zh, sets, min, max, status }
  })
})

/** 连续完成的训练次数：从最近一次完成往前数连续编号 */
const streak = computed(() => {
  const done = doneIndexes.value
  let cursor = 0
  for (const i of done) if (i > cursor) cursor = i
  let count = 0
  while (cursor > 0 && done.has(cursor)) {
    count += 1
    cursor -= 1
  }
  return count
})

/** 最近 4 练的完成率，用于给下一次训练提建议 */
const recentRatio = computed(() => {
  const done = doneIndexes.value
  let latest = 0
  for (const i of done) if (i > latest) latest = i
  const to = latest || selectedIndex.value
  const from = Math.max(1, to - 3)
  let hits = 0
  for (let i = from; i <= to; i++) if (done.has(i)) hits += 1
  return hits / (to - from + 1)
})

const recommendation = computed(() => {
  if (!logs.value.length) {
    return '还没有打卡记录：先从第 1 练开始，用适应期的轻负荷把动作轨迹和器械高度确定下来。'
  }
  const ratio = recentRatio.value
  if (ratio >= 0.8) {
    return `最近 4 练完成度 ${Math.round(ratio * 100)}%：主项可 +2.5kg（下肢 +5kg），孤立动作每组多做 1–2 次。`
  }
  if (ratio >= 0.5) {
    return `最近 4 练完成度 ${Math.round(ratio * 100)}%：负荷保持不变，优先补齐组数与动作质量，再考虑加重量。`
  }
  return `最近 4 练完成度 ${Math.round(ratio * 100)}%：先减一档负荷重新建立节奏，缺练时不要用加倍容量补偿。`
})

function setConfig(patch: Partial<PlanConfig>) {
  config.value = { ...config.value, ...patch }
  selectedIndex.value = Math.min(selectedIndex.value, totalSessions.value)
}

/** 记住某个动作位换成的动作；id 不在动作库时忽略 */
function swapExercise(slotKey: string, exerciseId: string) {
  if (!EXERCISE_MAP.has(exerciseId)) return
  swaps.value = { ...swaps.value, [slotKey]: exerciseId }
}

/** 恢复某个动作位的模板默认动作 */
function resetSwap(slotKey: string) {
  if (!(slotKey in swaps.value)) return
  const next = { ...swaps.value }
  delete next[slotKey]
  swaps.value = next
}

function isSwapped(slotKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(swaps.value, slotKey)
}

/** 跳到下一次未完成的训练 */
function syncNext() {
  selectedIndex.value = nextIndex.value
}

export function useTraining() {
  return {
    config,
    logs,
    plan,
    totalSessions,
    activeSplit,
    selectedIndex,
    activeSession,
    activeDay,
    heatRange,
    heatScopeLabel,
    heatDetail,
    heatScores,
    heatMax,
    trainedMuscleCount,
    sessionStats,
    volumeAudit,
    streak,
    recommendation,
    nextIndex,
    completedCount,
    allDone,
    sessionDone,
    logsForSession,
    logFor,
    lastLogFor,
    upsertLog,
    removeLog,
    setConfig,
    swapExercise,
    resetSwap,
    isSwapped,
    syncNext,
  }
}
