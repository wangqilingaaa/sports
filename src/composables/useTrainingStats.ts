import { computed, ref, watch } from 'vue'
import { effortFactor, useTraining, type LogEntry } from '@/composables/useTraining'
import { EXERCISE_MAP } from '@/data/exercises'
import {
  LEVEL_VOLUME_SCALE,
  SPLIT_VOLUME_SCALE,
  VOLUME_GROUP_DEFS,
  VOLUME_TARGETS,
  type VolumeGroupType,
} from '@/data/training-plan'
import type { MuscleId } from '@/data/types'

export type StatsRange = 'all' | '8w' | '12w' | '6m'
export type StatsGranularity = 'week' | 'month'

export const STATS_RANGES: { id: StatsRange; zh: string }[] = [
  { id: '8w', zh: '近 8 周' },
  { id: '12w', zh: '近 12 周' },
  { id: '6m', zh: '近 6 个月' },
  { id: 'all', zh: '全部' },
]

export const STATS_GRANULARITIES: { id: StatsGranularity; zh: string }[] = [
  { id: 'week', zh: '按周' },
  { id: 'month', zh: '按月' },
]

export interface StatsBucket {
  start: number
  label: string
  sessions: number
  sets: number
  volume: number
  bodyweightSets: number
}

export interface StatsOverview {
  sessions: number
  sets: number
  volume: number
  bodyweightSets: number
  activeWeeks: number
  cycles: number
  sessionsPerWeek: number
  avgRpe: number
}

export interface MusclePoint {
  start: number
  label: string
  value: number
}

export interface MuscleGroupSeries {
  id: string
  zh: string
  type: VolumeGroupType
  totalSets: number
  weeklyAvg: number
  target: [number, number]
  points: MusclePoint[]
}

export interface StrengthExerciseOption {
  id: string
  zh: string
  entries: number
  lastAt: number
  compound: boolean
}

export interface StrengthPoint {
  start: number
  label: string
  value: number | null
  title: string
}

export interface StrengthSeries {
  id: string
  zh: string
  points: StrengthPoint[]
}

export interface PrLift {
  id: string
  zh: string
  entries: number
  bestE1rm: { value: number; weight: number; reps: number; at: number }
  bestWeight: { weight: number; reps: number; at: number }
  lastAt: number
}

const DAY = 86_400_000

const MUSCLE_GROUP_MAP = new Map<MuscleId, string>()
for (const group of VOLUME_GROUP_DEFS) {
  for (const id of group.members) MUSCLE_GROUP_MAP.set(id, group.id)
}

function startOfWeek(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

function startOfMonth(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  return d.getTime()
}

function bucketStart(ts: number, granularity: StatsGranularity): number {
  return granularity === 'week' ? startOfWeek(ts) : startOfMonth(ts)
}

function nextBucket(start: number, granularity: StatsGranularity): number {
  const d = new Date(start)
  if (granularity === 'week') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  return d.getTime()
}

function bucketLabel(start: number, granularity: StatsGranularity): string {
  const d = new Date(start)
  if (granularity === 'week') return `${d.getMonth() + 1}.${d.getDate()}`
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function epley(log: LogEntry): number {
  return round1(log.weight * (1 + log.reps / 30))
}

export function formatVolume(value: number): string {
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return `${Math.round(value)}`
}

export function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

const range = ref<StatsRange>('12w')
const granularity = ref<StatsGranularity>('week')
const selectedMuscleId = ref('chest')
const selectedStrengthId = ref('')

export function useTrainingStats() {
  const training = useTraining()
  const logs = training.logs
  const config = training.config
  const now = ref(Date.now())

  const rangeStart = computed<number | null>(() => {
    if (range.value === 'all') return null
    const days = range.value === '8w' ? 56 : range.value === '12w' ? 84 : 182
    return now.value - days * DAY
  })

  const rangeLogs = computed(() => {
    const from = rangeStart.value
    if (from === null) return logs.value
    return logs.value.filter((log) => log.createdAt >= from)
  })

  const overview = computed<StatsOverview>(() => {
    const sessions = new Set<string>()
    const weeks = new Set<number>()
    const cycles = new Set<number>()
    let sets = 0
    let volume = 0
    let bodyweightSets = 0
    let rpeSets = 0

    for (const log of rangeLogs.value) {
      sessions.add(`${log.cycle}:${log.sessionIndex}`)
      weeks.add(startOfWeek(log.createdAt))
      cycles.add(log.cycle)
      sets += log.sets
      volume += log.sets * log.reps * log.weight
      if (log.weight <= 0) bodyweightSets += log.sets
      rpeSets += log.sets * log.rpe
    }

    return {
      sessions: sessions.size,
      sets,
      volume: Math.round(volume),
      bodyweightSets,
      activeWeeks: weeks.size,
      cycles: cycles.size,
      sessionsPerWeek: weeks.size ? round1(sessions.size / weeks.size) : 0,
      avgRpe: sets ? round1(rpeSets / sets) : 0,
    }
  })

  const buckets = computed<StatsBucket[]>(() => {
    const gran = granularity.value
    const end = bucketStart(now.value, gran)
    const firstTs =
      rangeStart.value ??
      (logs.value.length
        ? logs.value.reduce((min, log) => Math.min(min, log.createdAt), Number.POSITIVE_INFINITY)
        : now.value)
    let cursor = bucketStart(firstTs, gran)
    if (cursor > end) cursor = end

    const acc = new Map<
      number,
      { sessions: Set<string>; sets: number; volume: number; bodyweightSets: number }
    >()
    for (const log of rangeLogs.value) {
      const key = bucketStart(log.createdAt, gran)
      const item = acc.get(key) ?? {
        sessions: new Set<string>(),
        sets: 0,
        volume: 0,
        bodyweightSets: 0,
      }
      item.sessions.add(`${log.cycle}:${log.sessionIndex}`)
      item.sets += log.sets
      item.volume += log.sets * log.reps * log.weight
      if (log.weight <= 0) item.bodyweightSets += log.sets
      acc.set(key, item)
    }

    const out: StatsBucket[] = []
    for (let guard = 0; cursor <= end && guard < 1200; guard++) {
      const item = acc.get(cursor)
      out.push({
        start: cursor,
        label: bucketLabel(cursor, gran),
        sessions: item?.sessions.size ?? 0,
        sets: item?.sets ?? 0,
        volume: Math.round(item?.volume ?? 0),
        bodyweightSets: item?.bodyweightSets ?? 0,
      })
      cursor = nextBucket(cursor, gran)
    }
    return out.length > 600 ? out.slice(-600) : out
  })

  const muscleGroups = computed<MuscleGroupSeries[]>(() => {
    const gran = granularity.value
    const bucketStarts = buckets.value.map((bucket) => bucket.start)
    const acc = new Map<string, Map<number, number>>()
    for (const group of VOLUME_GROUP_DEFS) acc.set(group.id, new Map())

    for (const log of rangeLogs.value) {
      const exercise = EXERCISE_MAP.get(log.exerciseId)
      if (!exercise) continue
      const key = bucketStart(log.createdAt, gran)
      const weight = log.sets * effortFactor(log.rpe)
      for (const hit of exercise.muscles) {
        const groupId = MUSCLE_GROUP_MAP.get(hit.id)
        if (!groupId) continue
        const map = acc.get(groupId)
        if (!map) continue
        map.set(key, (map.get(key) ?? 0) + weight * (hit.activation / 100))
      }
    }

    const activeWeeks = Math.max(1, overview.value.activeWeeks)
    const scale = LEVEL_VOLUME_SCALE[config.value.level] * SPLIT_VOLUME_SCALE[config.value.split]

    return VOLUME_GROUP_DEFS.map((group) => {
      const map = acc.get(group.id) ?? new Map<number, number>()
      let totalSets = 0
      const points = bucketStarts.map((start) => {
        const value = round1(map.get(start) ?? 0)
        totalSets += value
        return { start, label: bucketLabel(start, gran), value }
      })
      const [minRaw, maxRaw] = VOLUME_TARGETS[config.value.goal][group.type]
      const min = Math.max(1, Math.floor(minRaw * scale))
      const max = Math.max(min, Math.ceil(maxRaw * scale))
      return {
        id: group.id,
        zh: group.zh,
        type: group.type,
        totalSets: round1(totalSets),
        weeklyAvg: round1(totalSets / activeWeeks),
        target: [min, max],
        points,
      }
    })
  })

  const activeMuscle = computed(
    () =>
      muscleGroups.value.find((group) => group.id === selectedMuscleId.value) ??
      muscleGroups.value[0],
  )

  const strengthExercises = computed<StrengthExerciseOption[]>(() => {
    const map = new Map<string, { entries: number; lastAt: number }>()
    for (const log of rangeLogs.value) {
      if (log.weight <= 0) continue
      const item = map.get(log.exerciseId) ?? { entries: 0, lastAt: 0 }
      item.entries += 1
      item.lastAt = Math.max(item.lastAt, log.createdAt)
      map.set(log.exerciseId, item)
    }
    return [...map.entries()]
      .map(([id, info]) => ({
        id,
        zh: EXERCISE_MAP.get(id)?.zh ?? id,
        entries: info.entries,
        lastAt: info.lastAt,
        compound: EXERCISE_MAP.get(id)?.pattern !== 'isolation',
      }))
      .sort(
        (a, b) =>
          Number(b.compound) - Number(a.compound) ||
          b.entries - a.entries ||
          b.lastAt - a.lastAt,
      )
  })

  watch(
    strengthExercises,
    (list) => {
      if (!list.some((exercise) => exercise.id === selectedStrengthId.value)) {
        selectedStrengthId.value = list[0]?.id ?? ''
      }
    },
    { immediate: true },
  )

  const activeStrength = computed<StrengthSeries | null>(() => {
    const exercise =
      strengthExercises.value.find((item) => item.id === selectedStrengthId.value) ??
      strengthExercises.value[0]
    if (!exercise) return null

    const best = new Map<number, LogEntry>()
    for (const log of rangeLogs.value) {
      if (log.exerciseId !== exercise.id || log.weight <= 0) continue
      const key = bucketStart(log.createdAt, granularity.value)
      const prev = best.get(key)
      if (!prev || epley(log) > epley(prev)) best.set(key, log)
    }

    const points = buckets.value.map((bucket) => {
      const log = best.get(bucket.start)
      return {
        start: bucket.start,
        label: bucket.label,
        value: log ? epley(log) : null,
        title: log
          ? `${formatDate(log.createdAt)} · ${log.weight} kg × ${log.reps} · e1RM ${epley(log)} kg`
          : `${formatDate(bucket.start)} · 无记录`,
      }
    })

    return { id: exercise.id, zh: exercise.zh, points }
  })

  const prs = computed<PrLift[]>(() => {
    const map = new Map<
      string,
      {
        entries: number
        lastAt: number
        bestE1rm: { value: number; weight: number; reps: number; at: number }
        bestWeight: { weight: number; reps: number; at: number }
      }
    >()

    for (const log of logs.value) {
      if (log.weight <= 0) continue
      const e1rm = epley(log)
      const item = map.get(log.exerciseId) ?? {
        entries: 0,
        lastAt: 0,
        bestE1rm: { value: 0, weight: 0, reps: 0, at: 0 },
        bestWeight: { weight: 0, reps: 0, at: 0 },
      }
      item.entries += 1
      item.lastAt = Math.max(item.lastAt, log.createdAt)
      if (e1rm > item.bestE1rm.value) {
        item.bestE1rm = { value: e1rm, weight: log.weight, reps: log.reps, at: log.createdAt }
      }
      if (
        log.weight > item.bestWeight.weight ||
        (log.weight === item.bestWeight.weight && log.reps > item.bestWeight.reps)
      ) {
        item.bestWeight = { weight: log.weight, reps: log.reps, at: log.createdAt }
      }
      map.set(log.exerciseId, item)
    }

    return [...map.entries()]
      .map(([id, info]) => ({
        id,
        zh: EXERCISE_MAP.get(id)?.zh ?? id,
        ...info,
      }))
      .sort((a, b) => b.lastAt - a.lastAt)
  })

  const rangeLabel = computed(() => {
    const rangeText = STATS_RANGES.find((item) => item.id === range.value)?.zh ?? '全部'
    const granText = STATS_GRANULARITIES.find((item) => item.id === granularity.value)?.zh ?? '按周'
    return `${rangeText} · ${granText}`
  })

  function refreshNow() {
    now.value = Date.now()
  }

  return {
    range,
    granularity,
    selectedMuscleId,
    selectedStrengthId,
    rangeLabel,
    hasLogs: computed(() => logs.value.length > 0),
    overview,
    buckets,
    muscleGroups,
    activeMuscle,
    strengthExercises,
    activeStrength,
    prs,
    refreshNow,
  }
}
