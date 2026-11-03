import { computed, ref, watch } from 'vue'
import { EXERCISE_MAP } from '@/data/exercises'
import { MUSCLE_MAP } from '@/data/muscles'
import {
  buildPlan,
  DAYS_TO_SPLIT,
  LEVEL_VOLUME_SCALE,
  PHASE_VOLUME_SCALE,
  PLAN_ROUNDS,
  SPLIT_MAP,
  SPLIT_VOLUME_SCALE,
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
  /** 第几个周期，从 1 开始 */
  cycle: number
  /** 本周期内第几次训练，从 1 开始 */
  sessionIndex: number
  exerciseId: string
  /** 计划动作位；自由打卡为空。用于区分同一天重复动作，兼容旧记录 */
  slotKey?: string
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
  slotKey?: string
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
  /** 当前轮已打卡的全部直接组 */
  actualSets: number
  /** 当前轮 RPE 达到硬组阈值的直接组 */
  hardSets: number
  hardStatus: VolumeStatus
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
  cycle?: unknown
  sessionIndex?: unknown
  exerciseId?: unknown
  slotKey?: unknown
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
    cycle: 1,
    compact: false,
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
/** 主项目标：exerciseId → 目标 e1RM kg */
const goals = ref<Record<string, number>>({})

/** 换动作必须保持复合/孤立属性并共享主动肌；防止老存档把主项换成孤立动作 */
function swapCompatible(currentId: string, nextId: string): boolean {
  const current = EXERCISE_MAP.get(currentId)
  const next = EXERCISE_MAP.get(nextId)
  if (!current || !next) return false
  if ((current.pattern === 'isolation') !== (next.pattern === 'isolation')) return false
  const primaries = new Set(
    current.muscles.filter((hit) => hit.role === 'primary').map((hit) => hit.id),
  )
  return next.muscles.some((hit) => hit.role === 'primary' && primaries.has(hit.id))
}

/** 存档里的替换表只认仍在动作库、且与默认动作兼容的 id */
function normalizeSwaps(raw: unknown): PlanSwaps {
  if (!raw || typeof raw !== 'object') return {}
  const defaults = new Map<string, string>()
  for (const session of buildPlan(config.value)) {
    for (const item of session.day.exercises) defaults.set(item.slotKey, item.exerciseId)
  }
  const out: PlanSwaps = {}
  for (const [slotKey, exerciseId] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof exerciseId !== 'string') continue
    const defaultId = defaults.get(slotKey)
    if (defaultId && EXERCISE_MAP.has(exerciseId) && swapCompatible(defaultId, exerciseId)) {
      out[slotKey] = exerciseId
    }
  }
  return out
}

function normalizeGoals(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!EXERCISE_MAP.has(id) || typeof value !== 'number' || !Number.isFinite(value)) continue
    const target = Math.round(value * 2) / 2
    if (target >= 1 && target <= 1000) out[id] = target
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
  const cycle =
    typeof raw.cycle === 'number' && raw.cycle >= 1 ? Math.trunc(raw.cycle) : 1

  return {
    id: raw.id,
    cycle,
    sessionIndex: Math.min(total, Math.max(1, Math.round(index))),
    exerciseId: raw.exerciseId,
    slotKey: typeof raw.slotKey === 'string' ? raw.slotKey : undefined,
    sets: raw.sets,
    reps: raw.reps,
    weight: typeof raw.weight === 'number' ? raw.weight : 0,
    rpe: typeof raw.rpe === 'number' ? raw.rpe : 7,
    sessionKey: typeof raw.sessionKey === 'string' ? raw.sessionKey : undefined,
    createdAt,
  }
}

/** 同一次训练的同个动作位只保留一条记录，优先保留带计划标记的最新记录 */
function dedupeLogs(list: LogEntry[]): LogEntry[] {
  const map = new Map<string, LogEntry>()
  for (const log of list) {
    // 换动作后同一动作位会同时存在新旧动作的记录，key 必须带上 exerciseId
    const key = `${log.cycle}:${log.sessionIndex}:${log.slotKey ?? log.exerciseId}:${log.exerciseId}`
    const prev = map.get(key)
    if (!prev) {
      map.set(key, log)
      continue
    }
    const next = log.createdAt >= prev.createdAt ? log : prev
    map.set(key, {
      ...next,
      slotKey: next.slotKey ?? prev.slotKey,
      sessionKey: next.sessionKey ?? prev.sessionKey,
    })
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
      goals?: unknown
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
      if (typeof c.cycle === 'number' && c.cycle >= 1) {
        config.value.cycle = Math.trunc(c.cycle)
      }
      config.value.compact = typeof c.compact === 'boolean' ? c.compact : false
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
    goals.value = normalizeGoals(parsed.goals)
  } catch {
    /* 存档不可用时按默认计划运行 */
  }
}

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        config: config.value,
        logs: logs.value,
        swaps: swaps.value,
        goals: goals.value,
      }),
    )
  } catch {
    /* 隐私模式或配额不足时静默失败 */
  }
}

hydrate()
persist()
watch([config, logs, swaps, goals], persist, { deep: true })

const selectedIndex = ref(1)
const heatRange = ref<HeatRange>('session')

const plan = computed(() => buildPlan(config.value, swaps.value))
const totalSessions = computed(() => plan.value.length)
const activeSplit = computed(() => SPLIT_MAP.get(config.value.split) ?? SPLITS[0])
const activeSession = computed(() => plan.value[selectedIndex.value - 1] ?? plan.value[0])
const activeDay = computed(() => activeSession.value.day)

/** 一次训练至少完成 80% 的计划组数才算完成；按动作位封顶，避免一个动作多做几组补掉缺练 */
const SESSION_COMPLETION_RATIO = 0.8

/** 已完成的训练次序：当前周期内计划组数覆盖率达到阈值，且打卡属于当前训练日 */
const doneIndexes = computed(() => {
  const set = new Set<number>()
  const logsBySession = new Map<number, LogEntry[]>()

  for (const log of logs.value) {
    if (log.cycle !== config.value.cycle) continue
    if (!log.sessionKey || log.sessionIndex > totalSessions.value) continue
    const list = logsBySession.get(log.sessionIndex) ?? []
    list.push(log)
    logsBySession.set(log.sessionIndex, list)
  }

  for (const [index, sessionLogs] of logsBySession) {
    const session = plan.value[index - 1]
    if (!session || !session.day.exercises.length) continue
    let plannedSets = 0
    let loggedSets = 0
    for (const item of session.day.exercises) {
      plannedSets += item.prescription.sets
      const log = sessionLogs.find(
        (entry) =>
          entry.sessionKey === session.day.key &&
          (entry.slotKey
            ? entry.slotKey === item.slotKey && entry.exerciseId === item.exerciseId
            : entry.exerciseId === item.exerciseId),
      )
      loggedSets += Math.min(log?.sets ?? 0, item.prescription.sets)
    }
    if (plannedSets > 0 && loggedSets / plannedSets >= SESSION_COMPLETION_RATIO) set.add(index)
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

function logsForSession(index: number, sessionKey?: string): LogEntry[] {
  return logs.value.filter(
    (l) =>
      l.cycle === config.value.cycle &&
      l.sessionIndex === index &&
      (!sessionKey || !l.sessionKey || l.sessionKey === sessionKey),
  )
}

function logFor(index: number, exerciseId: string, slotKey?: string): LogEntry | null {
  return (
    logs.value.find(
      (l) =>
        l.cycle === config.value.cycle &&
        l.sessionIndex === index &&
        (slotKey
          ? (l.slotKey === slotKey && l.exerciseId === exerciseId) ||
            (!l.slotKey && !!l.sessionKey && l.exerciseId === exerciseId)
          : l.exerciseId === exerciseId),
    ) ?? null
  )
}

function lastLogFor(exerciseId: string): LogEntry | null {
  let latest: LogEntry | null = null
  for (const l of logs.value) {
    if (l.exerciseId !== exerciseId) continue
    if (!latest || l.createdAt > latest.createdAt) latest = l
  }
  return latest
}

/** Epley 公式估算 1RM；自重/未填重量返回 null */
function e1rmFor(log: LogEntry): number | null {
  if (log.weight <= 0) return null
  return Math.round(log.weight * (1 + log.reps / 30) * 10) / 10
}

function upsertLog(input: LogInput) {
  const idx = logs.value.findIndex(
    (l) =>
      l.cycle === config.value.cycle &&
      l.sessionIndex === input.sessionIndex &&
      (input.slotKey
        ? (l.slotKey === input.slotKey && l.exerciseId === input.exerciseId) ||
          (!l.slotKey && l.sessionKey === input.sessionKey && l.exerciseId === input.exerciseId)
        : l.exerciseId === input.exerciseId),
  )
  const clean = {
    cycle: config.value.cycle,
    sessionIndex: Math.max(1, Math.round(input.sessionIndex)),
    exerciseId: input.exerciseId,
    slotKey: input.slotKey,
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
      slotKey: clean.slotKey ?? prev.slotKey,
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

export function effortFactor(rpe: number): number {
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
  const keys = new Map<number, string>()
  for (let i = range.from; i <= range.to; i++) {
    const session = plan.value[i - 1]
    if (session) keys.set(i, session.day.key)
  }
  return logs.value.filter(
    (l) =>
      l.cycle === config.value.cycle &&
      l.sessionIndex >= range.from &&
      l.sessionIndex <= range.to &&
      (!l.sessionKey || !keys.has(l.sessionIndex) || l.sessionKey === keys.get(l.sessionIndex)),
  )
})

const heatScopeLabel = computed(() => {
  if (heatRange.value === 'all') return '全部记录（含历史周期）'
  if (heatRange.value === 'recent') {
    const from = Math.max(1, selectedIndex.value - 7)
    return from === selectedIndex.value
      ? `本周期第 ${from} 练`
      : `本周期第 ${from}–${selectedIndex.value} 练`
  }
  return `本周期第 ${selectedIndex.value} 练`
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
  const list = logs.value.filter(
    (l) =>
      l.cycle === config.value.cycle &&
      l.sessionIndex === selectedIndex.value &&
      (!l.sessionKey || l.sessionKey === activeDay.value.key),
  )
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
  const phaseLevelScale =
    PHASE_VOLUME_SCALE[phase.id] * LEVEL_VOLUME_SCALE[config.value.level]
  const roundScale = phaseLevelScale * SPLIT_VOLUME_SCALE[config.value.split]
  const targets = VOLUME_TARGETS[config.value.goal]
  const sessions = plan.value.filter((session) => session.round === activeSession.value.round)
  const totals = new Map<string, number>()

  const conditioningSlots = new Set<string>()

  for (const session of sessions) {
    for (const item of session.day.exercises) {
      // 代谢收尾不计入力量容量，避免把摆荡类动作算成臀部/腘绳组数
      if (item.role === 'conditioning') {
        conditioningSlots.add(item.slotKey)
        continue
      }
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

  // 实际硬组：当前轮已打卡、RPE 达到阈值（适应期 ≥6，其余 ≥7）的直接组
  const roundIndexes = new Set(sessions.map((session) => session.index))
  const actualTotals = new Map<string, number>()
  const hardTotals = new Map<string, number>()
  const hardThreshold = phase.id === 'adaptation' ? 6 : 7
  for (const log of logs.value) {
    if (log.cycle !== config.value.cycle) continue
    if (!roundIndexes.has(log.sessionIndex)) continue
    if (log.slotKey && conditioningSlots.has(log.slotKey)) continue
    const exercise = EXERCISE_MAP.get(log.exerciseId)
    if (!exercise) continue
    for (const group of VOLUME_GROUP_DEFS) {
      let credit = 0
      for (const hit of exercise.muscles) {
        if (!group.members.includes(hit.id)) continue
        credit = Math.max(credit, muscleCredit(hit.role))
      }
      if (credit <= 0) continue
      actualTotals.set(group.id, (actualTotals.get(group.id) ?? 0) + log.sets * credit)
      if (log.rpe >= hardThreshold) {
        hardTotals.set(group.id, (hardTotals.get(group.id) ?? 0) + log.sets * credit)
      }
    }
  }

  return VOLUME_GROUP_DEFS.map((group) => {
    const sets = Math.round((totals.get(group.id) ?? 0) * 10) / 10
    const actualSets = Math.round((actualTotals.get(group.id) ?? 0) * 10) / 10
    const hardSets = Math.round((hardTotals.get(group.id) ?? 0) * 10) / 10
    const [minRaw, maxRaw] = targets[group.type]
    const min = Math.max(1, Math.floor(minRaw * roundScale))
    const max = Math.max(min, Math.ceil(maxRaw * roundScale))
    const status: VolumeStatus = sets < min ? 'low' : sets > max ? 'high' : 'ok'
    const hardStatus: VolumeStatus = hardSets < min ? 'low' : hardSets > max ? 'high' : 'ok'
    return {
      id: group.id,
      zh: group.zh,
      sets,
      min,
      max,
      status,
      actualSets,
      hardSets,
      hardStatus,
    }
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
  if (!logs.value.some((l) => l.cycle === config.value.cycle)) {
    return config.value.cycle > 1
      ? `第 ${config.value.cycle} 周期还没有打卡记录：从第 1 练开始，先沿用上一周期的重量，动作稳定后再加负荷。`
      : '还没有打卡记录：先从第 1 练开始，用适应期的轻负荷把动作轨迹和器械高度确定下来。'
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

/** 每 6 周至少安排一次减载；如果 RPE 持续偏高且完成度下降，也提前提醒 */
const DELOAD_AFTER_WEEKS = 6

const deloadAdvice = computed(() => {
  const currentLogs = logs.value.filter((l) => l.cycle === config.value.cycle)
  if (currentLogs.length < 4) return { due: false, reason: '' }
  if (activeSession.value.phase.id === 'deload') return { due: false, reason: '' }

  const first = Math.min(...currentLogs.map((l) => l.createdAt))
  const weeks = (Date.now() - first) / (7 * 86400000)
  if (weeks >= DELOAD_AFTER_WEEKS) {
    return {
      due: true,
      reason: `本周期已训练约 ${weeks.toFixed(0)} 周，建议插入 1 轮减载再继续。`,
    }
  }

  const recent = [...currentLogs].sort((a, b) => a.createdAt - b.createdAt).slice(-12)
  const avgRpe = recent.reduce((sum, l) => sum + l.rpe, 0) / recent.length
  if (recent.length >= 8 && avgRpe >= 9 && recentRatio.value < SESSION_COMPLETION_RATIO) {
    return {
      due: true,
      reason: `最近记录平均 RPE ${avgRpe.toFixed(1)}，完成度降到 ${Math.round(
        recentRatio.value * 100,
      )}%，建议插入 1 轮减载。`,
    }
  }

  return { due: false, reason: '' }
})

/** 本次训练日的主要肌群如果 48 小时内刚练过，给出恢复间隔提醒 */
const recoveryNote = computed(() => {
  const activePrimary = new Set<MuscleId>()
  for (const item of activeDay.value.exercises) {
    const exercise = EXERCISE_MAP.get(item.exerciseId)
    for (const hit of exercise?.muscles ?? []) {
      if (hit.role === 'primary') activePrimary.add(hit.id)
    }
  }
  if (!activePrimary.size) return ''

  let latest: { createdAt: number; muscleId: MuscleId } | null = null
  for (const log of logs.value) {
    if (log.cycle !== config.value.cycle) continue
    if (log.sessionIndex === activeSession.value.index && log.sessionKey === activeDay.value.key) {
      continue
    }
    const exercise = EXERCISE_MAP.get(log.exerciseId)
    if (!exercise) continue
    const hit = exercise.muscles.find(
      (entry) => entry.role === 'primary' && activePrimary.has(entry.id),
    )
    if (!hit) continue
    if (!latest || log.createdAt > latest.createdAt) {
      latest = { createdAt: log.createdAt, muscleId: hit.id }
    }
  }
  if (!latest) return ''

  const hours = (Date.now() - latest.createdAt) / 3_600_000
  if (hours >= 48) return ''
  const name = MUSCLE_MAP.get(latest.muscleId)?.zh ?? '同一肌群'
  return `距上次训练${name}约 ${hours < 1 ? '不到 1' : Math.round(hours)} 小时；同一肌群建议间隔 ≥48 小时，今天可减 1–2 组或换部位。`
})

function setConfig(patch: Partial<PlanConfig>) {
  config.value = { ...config.value, ...patch }
  selectedIndex.value = Math.min(selectedIndex.value, totalSessions.value)
}

/** 主项目标按 0.5kg 取整；只接受动作库内的负重动作 */
function setLiftGoal(exerciseId: string, target: number) {
  if (!EXERCISE_MAP.has(exerciseId)) return
  const value = Math.round(target * 2) / 2
  if (!Number.isFinite(value) || value < 1 || value > 1000) return
  goals.value = { ...goals.value, [exerciseId]: value }
}

function clearLiftGoal(exerciseId: string) {
  if (!(exerciseId in goals.value)) return
  const next = { ...goals.value }
  delete next[exerciseId]
  goals.value = next
}

/** 记住某个动作位换成的动作；不兼容的替换会被忽略 */
function swapExercise(slotKey: string, exerciseId: string) {
  if (!EXERCISE_MAP.has(exerciseId)) return
  const item = activeDay.value.exercises.find((entry) => entry.slotKey === slotKey)
  if (!item || !swapCompatible(item.exerciseId, exerciseId)) return
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

/** 开始下一周期：保留历史记录，完成度按新周期重新计算 */
function startNextCycle() {
  if (!allDone.value) return
  config.value = { ...config.value, cycle: config.value.cycle + 1 }
  selectedIndex.value = 1
  heatRange.value = 'session'
}

/** 跳到下一次未完成的训练 */
function syncNext() {
  selectedIndex.value = nextIndex.value
}

export function useTraining() {
  return {
    config,
    logs,
    goals,
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
    deloadAdvice,
    recoveryNote,
    nextIndex,
    completedCount,
    allDone,
    sessionDone,
    logsForSession,
    logFor,
    lastLogFor,
    e1rmFor,
    upsertLog,
    removeLog,
    setConfig,
    setLiftGoal,
    clearLiftGoal,
    swapExercise,
    resetSwap,
    isSwapped,
    startNextCycle,
    syncNext,
  }
}
