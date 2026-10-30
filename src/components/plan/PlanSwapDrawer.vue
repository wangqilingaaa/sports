<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RotateCcw, Search, X } from '@lucide/vue'
import { useTraining } from '@/composables/useTraining'
import { EXERCISES, EXERCISE_MAP } from '@/data/exercises'
import { EQUIPMENT_MAP, LEVEL_LABEL, PATTERN_LABEL } from '@/data/equipment'
import { MUSCLE_MAP } from '@/data/muscles'
import { EXERCISE_INDEX } from '@/data/exercise-search'
import { searchIndex } from '@/data/search'
import { buildPlan, type PlannedExercise } from '@/data/training-plan'
import type { Exercise, MuscleId } from '@/data/types'

const props = defineProps<{
  open: boolean
  /** 正在替换的动作位；关闭时为空 */
  item: PlannedExercise | null
  sessionIndex: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const training = useTraining()

const current = computed(() =>
  props.item ? EXERCISE_MAP.get(props.item.exerciseId) ?? null : null,
)

const ROLE_LABEL: Record<PlannedExercise['role'], string> = {
  main: '主项',
  secondary: '次项',
  accessory: '孤立',
  core: '核心',
  conditioning: '代谢',
}

/** 该位的目标肌群：优先主动肌，没有主动肌时退回协同肌 */
const targetMuscles = computed<MuscleId[]>(() => {
  const ex = current.value
  if (!ex) return []
  const primary = ex.muscles.filter((m) => m.role === 'primary').map((m) => m.id)
  const ids = primary.length
    ? primary
    : ex.muscles.filter((m) => m.role === 'secondary').map((m) => m.id)
  return [...new Set(ids)]
})

const targetMuscleNames = computed(() =>
  targetMuscles.value
    .map((id) => MUSCLE_MAP.get(id)?.zh)
    .filter(Boolean)
    .join(' · '),
)

/** 候选池：与当前动作共享同一个主动肌；同动作模式、同器械、难度接近的排前面 */
const pool = computed<Exercise[]>(() => {
  const ex = current.value
  if (!ex) return []
  const targets = new Set(targetMuscles.value)
  const affinity = (cand: Exercise): number =>
    (cand.pattern === ex.pattern ? 0 : 4) +
    (cand.equipment === ex.equipment ? 0 : 2) +
    Math.abs(cand.level - ex.level) * 0.5
  return EXERCISES.filter(
    (cand) =>
      cand.id !== ex.id &&
      cand.muscles.some((hit) => hit.role === 'primary' && targets.has(hit.id)),
  ).sort((a, b) => affinity(a) - affinity(b) || a.zh.localeCompare(b.zh))
})

const query = ref('')
const searchRef = ref<HTMLInputElement | null>(null)

const scores = computed(() => (query.value.trim() ? searchIndex(EXERCISE_INDEX, query.value) : null))

const candidates = computed(() => {
  const map = scores.value
  if (!map) return pool.value
  return pool.value
    .filter((ex) => map.has(ex.id))
    .sort((a, b) => (map.get(b.id) ?? 0) - (map.get(a.id) ?? 0))
})

/** 模板给这个动作位的默认动作，用于「恢复默认」的文案与判断 */
const defaultId = computed(() => {
  if (!props.item) return null
  const session = buildPlan(training.config.value)[props.sessionIndex - 1]
  return (
    session?.day.exercises.find((entry) => entry.slotKey === props.item!.slotKey)?.exerciseId ??
    null
  )
})

const defaultName = computed(() =>
  defaultId.value ? EXERCISE_MAP.get(defaultId.value)?.zh ?? '' : '',
)

const swapped = computed(() => (props.item ? training.isSwapped(props.item.slotKey) : false))

const logged = computed(
  () => !!props.item && !!training.logFor(props.sessionIndex, props.item.exerciseId),
)

function equipName(ex: Exercise | null): string {
  return ex ? EQUIPMENT_MAP.get(ex.equipment)?.zh ?? '' : ''
}

function muscleNames(ex: Exercise): string {
  return ex.muscles
    .filter((hit) => hit.role === 'primary')
    .slice(0, 2)
    .map((hit) => MUSCLE_MAP.get(hit.id)?.zh)
    .filter(Boolean)
    .join(' · ')
}

function apply(ex: Exercise) {
  if (!props.item) return
  training.swapExercise(props.item.slotKey, ex.id)
  emit('close')
}

function reset() {
  if (!props.item) return
  training.resetSwap(props.item.slotKey)
  emit('close')
}

watch(
  () => props.open,
  (open) => {
    document.body.classList.toggle('is-locked', open)
    if (!open) return
    query.value = ''
    void nextTick(() => searchRef.value?.focus())
  },
  { immediate: true },
)

onBeforeUnmount(() => document.body.classList.remove('is-locked'))
</script>

<template>
  <Teleport to="body">
    <Transition name="scrim">
      <div v-if="open" class="drawer-scrim" @click="emit('close')"></div>
    </Transition>

    <Transition name="drawer">
      <aside v-if="open" class="drawer swap-drawer" role="dialog" aria-modal="true" aria-label="替换计划动作">
        <div class="drawer-bar">
          <span class="drawer-kicker">替换动作 · {{ item?.label }}</span>
          <button class="drawer-close" aria-label="关闭替换面板" @click="emit('close')">
            <X :size="13" />
          </button>
        </div>

        <div class="drawer-body swap-body">
          <header class="swap-head">
            <div class="swap-current">
              <span class="swap-current-name">{{ current?.zh ?? item?.exerciseId }}</span>
              <span v-if="item" class="swap-role">{{ ROLE_LABEL[item.role] }}</span>
              <span v-if="swapped" class="swap-flag">已调整 · 默认「{{ defaultName }}」</span>
            </div>
            <div class="swap-current-meta">
              {{ equipName(current) }} · {{ current ? LEVEL_LABEL[current.level] : '' }} ·
              {{ current ? PATTERN_LABEL[current.pattern] : '' }}
            </div>
            <p class="swap-hint">
              只换动作，组数、次数、RPE 与休息沿用这个位的处方；本轮容量审计会按新动作重算。
            </p>
            <p v-if="logged" class="swap-warn">
              本次已按「{{ current?.zh }}」打卡，替换后需按新动作重新打卡；旧记录仍保留在本次记录里。
            </p>
          </header>

          <label class="swap-search">
            <Search :size="12" />
            <input
              ref="searchRef"
              v-model="query"
              type="search"
              placeholder="搜索同肌群动作：名称 / 拼音 / 器械"
              aria-label="搜索替换动作"
            />
            <button v-if="query" class="swap-clear" aria-label="清空搜索" @click="query = ''">
              <X :size="11" />
            </button>
          </label>

          <div class="swap-pool-head">
            <span><b>{{ candidates.length }}</b> 个候选</span>
            <span class="swap-pool-target">目标肌群 · {{ targetMuscleNames }}</span>
          </div>

          <p v-if="!candidates.length" class="swap-empty">
            {{
              query.trim()
                ? `同肌群动作里没有匹配「${query.trim()}」的，换个关键词试试。`
                : '这个动作没有可替换的同肌群动作，先恢复默认或换一个训练分化。'
            }}
          </p>
          <div v-else class="swap-list">
            <button
              v-for="ex in candidates"
              :key="ex.id"
              class="swap-item"
              :data-id="ex.id"
              @click="apply(ex)"
            >
              <span class="swap-item-main">
                <span class="swap-item-name">
                  {{ ex.zh }}
                  <em>{{ ex.en }}</em>
                </span>
                <span class="swap-item-meta">
                  {{ equipName(ex) }} · {{ LEVEL_LABEL[ex.level] }} · {{ PATTERN_LABEL[ex.pattern] }}
                </span>
                <span class="swap-item-muscles">{{ muscleNames(ex) }}</span>
              </span>
              <span class="swap-item-tags">
                <span v-if="ex.pattern === current?.pattern" class="swap-tag">同模式</span>
                <span v-if="ex.equipment === current?.equipment" class="swap-tag is-equip">同器械</span>
              </span>
            </button>
          </div>
        </div>

        <div class="drawer-foot swap-foot">
          <button class="swap-reset" :disabled="!swapped" @click="reset">
            <RotateCcw :size="12" />
            {{ swapped ? `恢复默认「${defaultName}」` : '当前为默认动作' }}
          </button>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
