import { computed, ref } from 'vue'
import { EXERCISES, EXERCISE_MAP } from '@/data/exercises'
import { MUSCLES, MUSCLE_MAP } from '@/data/muscles'
import { EQUIPMENT } from '@/data/equipment'
import { searchIndex } from '@/data/search'
import { EXERCISE_INDEX as INDEX } from '@/data/exercise-search'
import type { EquipmentId, MuscleId, Role } from '@/data/types'

const ROLE_RANK: Record<Role, number> = { primary: 3, secondary: 2, stabilizer: 1 }

// ── 全局状态（单例） ──
const query = ref('')
const equipment = ref<EquipmentId | 'all'>('all')
const muscleFilter = ref<MuscleId | null>(null)
const levelFilter = ref<0 | 1 | 2 | 3>(0)
const selectedId = ref<string | null>(null)
/** 详情抽屉是否展开——与 selectedId 解耦，关掉抽屉后动作仍然「钉」在模型上 */
const drawerOpen = ref(false)
const hoveredId = ref<string | null>(null)
const hoveredMuscle = ref<MuscleId | null>(null)
const isPlaying = ref(true)
const speed = ref(1)

const scoreMap = computed(() => (query.value.trim() ? searchIndex(INDEX, query.value) : null))

const results = computed(() => {
  const scores = scoreMap.value
  let list = EXERCISES.filter((ex) => {
    if (equipment.value !== 'all' && ex.equipment !== equipment.value) return false
    if (levelFilter.value !== 0 && ex.level !== levelFilter.value) return false
    if (muscleFilter.value && !ex.muscles.some((h) => h.id === muscleFilter.value)) return false
    if (scores && !scores.has(ex.id)) return false
    return true
  })
  if (scores) {
    list = [...list].sort((a, b) => {
      const d = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)
      return d !== 0 ? d : a.level - b.level
    })
  }
  return list
})

const activeExercise = computed(() => {
  // 悬停只是临时预览，离开后回到「钉住」的动作
  const id = hoveredId.value ?? selectedId.value
  return id ? EXERCISE_MAP.get(id) ?? null : null
})

/** 当前高亮集合：选中动作 → 精确激活；否则 → 筛选结果覆盖 */
const highlight = computed(() => {
  const map = new Map<MuscleId, { role: Role | 'coverage'; activation: number; focus: boolean }>()
  const ex = activeExercise.value
  if (ex) {
    for (const h of ex.muscles) map.set(h.id, { role: h.role, activation: h.activation, focus: false })
    return map
  }
  const narrowed =
    !!query.value.trim() ||
    equipment.value !== 'all' ||
    !!muscleFilter.value ||
    levelFilter.value !== 0
  if (!narrowed) return map
  for (const item of results.value) {
    for (const h of item.muscles) {
      const prev = map.get(h.id)
      map.set(h.id, {
        role: 'coverage',
        activation: prev ? Math.max(prev.activation, h.activation) : h.activation,
        focus: false,
      })
    }
  }
  // 点选的那块肌群单独标出来：模型上给强高亮，其余「会带到」的肌群只做淡提示
  const focusId = muscleFilter.value
  const self = focusId ? map.get(focusId) : undefined
  if (self) self.focus = true
  return map
})

const highlightedMuscles = computed(() =>
  [...highlight.value.entries()]
    .map(([id, v]) => ({ muscle: MUSCLE_MAP.get(id)!, ...v }))
    .sort((a, b) => b.activation - a.activation),
)

const primaryCount = computed(
  () => highlightedMuscles.value.filter((m) => m.role === 'primary').length,
)

const totalExercises = EXERCISES.length
const totalMuscles = MUSCLES.length
const totalEquipment = EQUIPMENT.length

const equipmentCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const ex of EXERCISES) counts[ex.equipment] = (counts[ex.equipment] ?? 0) + 1
  return counts
})

const muscleCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const ex of EXERCISES) for (const h of ex.muscles) counts[h.id] = (counts[h.id] ?? 0) + 1
  return counts
})

/** 选中并打开详情；关闭抽屉用 closeDrawer()，选中状态保留 */
function selectExercise(id: string | null) {
  selectedId.value = id
  drawerOpen.value = !!id
  hoveredId.value = null
}

function closeDrawer() {
  drawerOpen.value = false
}

/** 彻底放弃当前动作，模型回到肌群/筛选高亮 */
function clearSelection() {
  selectedId.value = null
  drawerOpen.value = false
}

function toggleMuscle(id: MuscleId) {
  clearSelection()
  muscleFilter.value = muscleFilter.value === id ? null : id
}

function setEquipment(id: EquipmentId | 'all') {
  equipment.value = equipment.value === id ? 'all' : id
  clearSelection()
}

function resetFilters() {
  query.value = ''
  equipment.value = 'all'
  muscleFilter.value = null
  levelFilter.value = 0
  clearSelection()
}

const hasFilters = computed(
  () =>
    !!query.value.trim() ||
    equipment.value !== 'all' ||
    !!muscleFilter.value ||
    levelFilter.value !== 0,
)

export function useAtlas() {
  return {
    query,
    equipment,
    muscleFilter,
    levelFilter,
    selectedId,
    drawerOpen,
    hoveredId,
    hoveredMuscle,
    isPlaying,
    speed,
    results,
    scoreMap,
    activeExercise,
    highlight,
    highlightedMuscles,
    primaryCount,
    hasFilters,
    totalExercises,
    totalMuscles,
    totalEquipment,
    equipmentCounts,
    muscleCounts,
    selectExercise,
    closeDrawer,
    clearSelection,
    toggleMuscle,
    setEquipment,
    resetFilters,
    ROLE_RANK,
  }
}
