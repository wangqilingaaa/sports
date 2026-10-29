import { nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAtlas } from '@/composables/useAtlas'
import { EQUIPMENT_MAP } from '@/data/equipment'
import { EXERCISE_MAP } from '@/data/exercises'
import { MUSCLE_MAP } from '@/data/muscles'
import type { EquipmentId, MuscleId } from '@/data/types'

/** 深链参数：q 关键词 / eq 器械 / m 肌群 / lv 难度 / ex 打开详情的动作 */
const LEVEL_PARAMS = new Set(['1', '2', '3'])

function readParam(value: unknown): string | null {
  if (typeof value === 'string' && value) return value
  if (Array.isArray(value)) {
    for (const item of value) if (typeof item === 'string' && item) return item
  }
  return null
}

/** 排序序列化，用来比较「当前状态」与 URL，避免 replace 自激循环 */
function canonical(query: Record<string, unknown>): string {
  const entries: [string, string][] = []
  for (const [key, value] of Object.entries(query)) {
    const param = readParam(value)
    if (param) entries.push([key, param])
  }
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

/**
 * 动作库状态与 route.query 双向同步：
 * 进站/前进后退时把 URL 读回状态，筛选或选中变化时用 replace 写回 URL（不堆历史）。
 */
export function useAtlasQuerySync() {
  const route = useRoute()
  const router = useRouter()
  const atlas = useAtlas()

  function applyFromRoute() {
    if (route.name !== 'atlas') return

    const q = readParam(route.query.q) ?? ''
    if (atlas.query.value !== q) atlas.query.value = q

    const eq = readParam(route.query.eq)
    const equipment = eq && EQUIPMENT_MAP.has(eq as EquipmentId) ? (eq as EquipmentId) : 'all'
    if (atlas.equipment.value !== equipment) atlas.equipment.value = equipment

    const m = readParam(route.query.m)
    const muscle = m && MUSCLE_MAP.has(m as MuscleId) ? (m as MuscleId) : null
    if (atlas.muscleFilter.value !== muscle) atlas.muscleFilter.value = muscle

    const lv = readParam(route.query.lv)
    const level = lv && LEVEL_PARAMS.has(lv) ? (Number(lv) as 1 | 2 | 3) : 0
    if (atlas.levelFilter.value !== level) atlas.levelFilter.value = level

    const ex = readParam(route.query.ex)
    if (!ex || !EXERCISE_MAP.has(ex)) {
      if (atlas.drawerOpen.value) atlas.closeDrawer()
      return
    }
    if (atlas.selectedId.value === ex && atlas.drawerOpen.value) return
    // 关键词变化会触发 clearSelection，等这一轮 watcher 走完再把动作钉住
    void nextTick(() => atlas.selectExercise(ex))
  }

  function currentQuery(): Record<string, string> {
    const query: Record<string, string> = {}
    if (atlas.query.value.trim()) query.q = atlas.query.value
    if (atlas.equipment.value !== 'all') query.eq = atlas.equipment.value
    if (atlas.muscleFilter.value) query.m = atlas.muscleFilter.value
    if (atlas.levelFilter.value !== 0) query.lv = String(atlas.levelFilter.value)
    if (atlas.drawerOpen.value && atlas.selectedId.value) query.ex = atlas.selectedId.value
    return query
  }

  function syncToRoute() {
    if (route.name !== 'atlas') return
    const query = currentQuery()
    if (canonical(query) === canonical(route.query)) return
    // 保留锚点，交给 scrollBehavior 判断同路径时不做滚动
    void router.replace({ name: 'atlas', query, hash: route.hash })
  }

  watch(() => route.fullPath, applyFromRoute, { immediate: true })

  watch(
    [atlas.query, atlas.equipment, atlas.muscleFilter, atlas.levelFilter, atlas.selectedId, atlas.drawerOpen],
    syncToRoute,
  )
}
