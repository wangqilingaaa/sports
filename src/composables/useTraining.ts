import { computed, ref, watch } from 'vue'
import { EXERCISE_MAP } from '@/data/exercises'
import {
  buildPlan,
  PLAN_WEEKS,
  type DaysPerWeek,
  type GoalId,
  type Level,
  type PlanConfig,
  type PlannedExercise,
  type PlanWeek,
} from '@/data/training-plan'
import type { MuscleId } from '@/data/types'

export type HeatRange = 'week' | 'month' | 'all'

export interface LogEntry {
  id: string
  /** 打卡日期 YYYY-MM-DD */
  date: string
  exerciseId: string
  sets: number
  reps: number
  /** 负重 kg；自重动作记 0 */
  weight: number
  rpe: number
  /** 来自计划的训练日 key；自由打卡为空 */
  sessionKey?: string
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
  date: string
  exerciseId: string
  sets: number
  reps: number
  weight: number
  rpe: number
  sessionKey?: string
}

export interface WeekStats {
  completed: number
  planned: number
  sets: number
  volume: number
  minutes: number
}

const STORAGE_KEY = 'atlas.training.v1'

export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(key: string, days: number): string {
  const d = parseDate(key)
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

/** 取所在周的周一 */
export function mondayOf(key: string): string {
  const d = parseDate(key)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return dateKey(d)
}

export function formatShortDate(key: string): string {
  const d = parseDate(key)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function weekdayName(key: string): string {
  const d = parseDate(key)
  return WEEKDAY_NAMES[(d.getDay() + 6) % 7]
}

function defaultConfig(): PlanConfig {
  return {
    goal: 'hypertrophy',
    level: 2,
    days: 4,
    startDate: mondayOf(dateKey(new Date())),
  }
}

const VALID_GOALS: GoalId[] = ['hypertrophy', 'strength', 'recondition']
const VALID_DAYS: DaysPerWeek[] = [2, 3, 4, 5, 6]
const VALID_LEVELS: Level[] = [1, 2, 3]

const config = ref<PlanConfig>(defaultConfig())
const logs = ref<LogEntry[]>([])

/** 从本地存档恢复；损坏数据直接忽略，不阻断页面 */
function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { config?: Partial<PlanConfig>; logs?: LogEntry[] }
    const c = parsed.config
    if (c) {
      if (c.goal && VALID_GOALS.includes(c.goal)) config.value.goal = c.goal
      if (c.level && VALID_LEVELS.includes(c.level)) config.value.level = c.level
      if (c.days && VALID_DAYS.includes(c.days)) config.value.days = c.days
      if (typeof c.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.startDate)) {
        config.value.startDate = mondayOf(c.startDate)
      }
    }
    if (Array.isArray(parsed.logs)) logs.value = parsed.logs.filter(isLogEntry)
  } catch {
    /* 存档不可用时按默认计划运行 */
  }
}

function isLogEntry(v: unknown): v is LogEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Partial<LogEntry>
  return (
    typeof e.id === 'string' &&
    typeof e.date === 'string' &&
    typeof e.exerciseId === 'string' &&
    typeof e.sets === 'number' &&
    typeof e.reps === 'number'
  )
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ config: config.value, logs: logs.value }))
  } catch {
    /* 隐私模式或配额不足时静默失败 */
  }
}

hydrate()
watch([config, logs], persist, { deep: true })

function weekFromStart(start: string, today = dateKey(new Date())): number {
  const diff = Math.floor((parseDate(today).getTime() - parseDate(start).getTime()) / 86400000)
  return Math.min(PLAN_WEEKS, Math.max(1, Math.floor(diff / 7) + 1))
}

const selectedWeek = ref<number>(weekFromStart(config.value.startDate))
const selectedDay = ref(0)
const heatRange = ref<HeatRange>('week')

const plan = computed<PlanWeek[]>(() => buildPlan(config.value))
const week = computed(() => plan.value[selectedWeek.value - 1])
const selectedSession = computed(() => week.value.days[selectedDay.value] ?? week.value.days[0])

/** 计划中某个训练日对应的真实日期 */
function dateFor(weekNo: number, dayIndex: number): string {
  const w = plan.value[weekNo - 1]
  const day = w.days[dayIndex] ?? w.days[0]
  return addDays(config.value.startDate, (weekNo - 1) * 7 + day.weekday)
}

const activeDate = computed(() => dateFor(selectedWeek.value, selectedDay.value))

const logDates = computed(() => new Set(logs.value.map((l) => l.date)))
const sessionDates = computed(
  () => new Set(logs.value.filter((l) => l.sessionKey).map((l) => l.date)),
)

function logsForDate(date: string): LogEntry[] {
  return logs.value.filter((l) => l.date === date)
}

function logFor(date: string, exerciseId: string): LogEntry | null {
  return logs.value.find((l) => l.date === date && l.exerciseId === exerciseId) ?? null
}

function lastLogFor(exerciseId: string): LogEntry | null {
  let latest: LogEntry | null = null
  for (const l of logs.value) {
    if (l.exerciseId !== exerciseId) continue
    if (!latest || l.date > latest.date || (l.date === latest.date && l.createdAt > latest.createdAt)) {
      latest = l
    }
  }
  return latest
}

function upsertLog(input: LogInput) {
  const idx = logs.value.findIndex(
    (l) => l.date === input.date && l.exerciseId === input.exerciseId,
  )
  const clean = {
    ...input,
    sets: Math.max(1, Math.round(input.sets)),
    reps: Math.max(1, Math.round(input.reps)),
    weight: Math.max(0, Number(input.weight.toFixed(1))),
    rpe: Math.min(10, Math.max(4, input.rpe)),
  }
  if (idx >= 0) {
    logs.value[idx] = { ...logs.value[idx], ...clean }
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

/** 按计划处方一键打卡，负重优先沿用上一次同动作记录 */
function logByPlan(date: string, sessionKey: string, item: PlannedExercise, override?: Partial<LogInput>) {
  upsertLog({
    date,
    sessionKey,
    exerciseId: item.exerciseId,
    sets: item.prescription.sets,
    reps: parsePrescriptionReps(item.prescription.reps),
    weight: lastLogFor(item.exerciseId)?.weight ?? 0,
    rpe: parsePrescriptionRpe(item.prescription.rpe),
    ...override,
  })
}

function parsePrescriptionReps(reps: string): number {
  const nums = reps.match(/\d+/g)?.map(Number) ?? [10]
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function parsePrescriptionRpe(rpe: string): number {
  const nums = rpe.match(/\d+/g)?.map(Number) ?? [7]
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
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

/** 当前热图范围涉及的日期集合 */
const heatDates = computed(() => {
  if (heatRange.value === 'all') return null
  if (heatRange.value === 'month') {
    const from = addDays(dateKey(new Date()), -27)
    return { from, to: dateKey(new Date()) }
  }
  const from = addDays(config.value.startDate, (selectedWeek.value - 1) * 7)
  return { from, to: addDays(from, 6) }
})

const heatLogs = computed(() => {
  const range = heatDates.value
  if (!range) return logs.value
  return logs.value.filter((l) => l.date >= range.from && l.date <= range.to)
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

const weekStats = computed<WeekStats>(() => {
  const from = addDays(config.value.startDate, (selectedWeek.value - 1) * 7)
  const to = addDays(from, 6)
  const list = logs.value.filter((l) => l.date >= from && l.date <= to)
  const done = new Set(list.filter((l) => l.sessionKey).map((l) => l.date))
  let sets = 0
  let volume = 0
  let workSeconds = 0
  for (const l of list) {
    sets += l.sets
    volume += l.sets * l.reps * l.weight
    workSeconds += l.sets * (40 + effortFactor(l.rpe) * 20)
  }
  return {
    completed: done.size,
    planned: config.value.days,
    sets,
    volume: Math.round(volume),
    minutes: Math.round(workSeconds / 60),
  }
})

const streak = computed(() => {
  let cursor = dateKey(new Date())
  if (!logDates.value.has(cursor)) cursor = addDays(cursor, -1)
  let days = 0
  while (logDates.value.has(cursor)) {
    days += 1
    cursor = addDays(cursor, -1)
  }
  return days
})

const completionRatio = computed(() =>
  weekStats.value.planned ? weekStats.value.completed / weekStats.value.planned : 0,
)

const recommendation = computed(() => {
  if (!logs.value.length) {
    return '还没有打卡记录：先按适应期的轻负荷完成两次训练，把动作轨迹和器械高度确定下来。'
  }
  const ratio = completionRatio.value
  if (ratio >= 0.8) {
    return `本周完成度 ${Math.round(ratio * 100)}%：主项可 +2.5kg（下肢 +5kg），孤立动作每组多做 1–2 次。`
  }
  if (ratio >= 0.5) {
    return `本周完成度 ${Math.round(ratio * 100)}%：负荷保持不变，优先补齐组数与动作质量，再考虑加重量。`
  }
  return `本周完成度 ${Math.round(ratio * 100)}%：先减一档负荷重新建立节奏，缺练时不要用跳周或加倍容量补偿。`
})

/** 某个训练周已完成的训练日数量 */
function completedInWeek(weekNo: number): number {
  const w = plan.value[weekNo - 1]
  let done = 0
  for (let i = 0; i < w.days.length; i++) {
    if (sessionDates.value.has(dateFor(weekNo, i))) done += 1
  }
  return done
}

function setConfig(patch: Partial<PlanConfig>) {
  config.value = { ...config.value, ...patch }
  if (patch.startDate) selectedWeek.value = 1
}

function restart(startDate = dateKey(new Date())) {
  config.value.startDate = mondayOf(startDate)
  selectedWeek.value = 1
  selectedDay.value = 0
}

function syncToday() {
  const today = dateKey(new Date())
  const w = weekFromStart(config.value.startDate, today)
  selectedWeek.value = w
  const idx = plan.value[w - 1].days.findIndex((_, i) => dateFor(w, i) === today)
  selectedDay.value = idx >= 0 ? idx : 0
}

function dayDone(weekNo: number, dayIndex: number): boolean {
  return sessionDates.value.has(dateFor(weekNo, dayIndex))
}

export function useTraining() {
  return {
    config,
    logs,
    plan,
    week,
    selectedWeek,
    selectedDay,
    selectedSession,
    activeDate,
    heatRange,
    heatDetail,
    heatScores,
    heatMax,
    trainedMuscleCount,
    weekStats,
    streak,
    recommendation,
    completionRatio,
    dateFor,
    logsForDate,
    logFor,
    lastLogFor,
    upsertLog,
    logByPlan,
    removeLog,
    completedInWeek,
    dayDone,
    setConfig,
    restart,
    syncToday,
  }
}
