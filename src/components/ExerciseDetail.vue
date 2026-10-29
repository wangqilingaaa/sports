<script setup lang="ts">
import { computed } from 'vue'
import { EQUIPMENT_MAP, LEVEL_LABEL, PATTERN_LABEL } from '@/data/equipment'
import { EXERCISE_MAP } from '@/data/exercises'
import { MUSCLE_MAP, ROLE_LABEL } from '@/data/muscles'
import type { Exercise, MuscleId } from '@/data/types'
import MovementDemo from './MovementDemo.vue'

const props = defineProps<{
  exerciseId: string
  /** 同一列表内的浏览序列，决定序号与上一项/下一项的边界；缺省时只含当前动作 */
  scopeIds?: string[]
  /** 动作库语境下点肌群直接筛选；计划页的详情只读 */
  muscleFilterable?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'filter-muscle', id: MuscleId): void
}>()

const ex = computed(() => EXERCISE_MAP.get(props.exerciseId) ?? null)

/** 当前动作所在的浏览序列：去重并剔除不存在的 id */
const scope = computed<Exercise[]>(() => {
  const ids = props.scopeIds?.length ? props.scopeIds : [props.exerciseId]
  const list = [...new Set(ids)]
    .map((id) => EXERCISE_MAP.get(id))
    .filter((item): item is Exercise => !!item)
  return list.length ? list : ex.value ? [ex.value] : []
})

const index = computed(() => scope.value.findIndex((item) => item.id === props.exerciseId))
const position = computed(() => Math.max(0, index.value))

const prev = computed(() => (index.value > 0 ? scope.value[index.value - 1] : null))
const next = computed(() =>
  index.value >= 0 && index.value < scope.value.length - 1 ? scope.value[index.value + 1] : null,
)

const tempoText = computed(() => {
  if (!ex.value) return ''
  const [c, e] = ex.value.tempo
  if (c === 0 && e === 0) return '等长保持'
  return `向心 ${c}s · 离心 ${e}s`
})

const sortedMuscles = computed(() => {
  if (!ex.value) return []
  return [...ex.value.muscles].sort((a, b) => b.activation - a.activation)
})

const equip = computed(() => (ex.value ? EQUIPMENT_MAP.get(ex.value.equipment) : null))

function pick(id: string) {
  emit('select', id)
}

function filterByMuscle(id: MuscleId) {
  if (props.muscleFilterable) emit('filter-muscle', id)
}
</script>

<template>
  <div v-if="ex" class="detail">
    <div class="d-top">
      <span class="d-kicker">{{ String(position + 1).padStart(2, '0') }} / {{ scope.length }}</span>
      <span class="d-kicker">{{ equip?.en }}</span>
    </div>

    <h2 class="d-title">{{ ex.zh }}</h2>
    <div class="d-en">{{ ex.en }}</div>

    <div class="d-badges">
      <span class="badge solid">{{ LEVEL_LABEL[ex.level] }}</span>
      <span class="badge">{{ equip?.zh }}</span>
      <span class="badge">{{ PATTERN_LABEL[ex.pattern] }}</span>
      <span class="badge">{{ tempoText }}</span>
      <span v-if="ex.unilateral" class="badge accent">单侧</span>
    </div>

    <MovementDemo :exercise-id="exerciseId" />

    <div class="d-section">
      <div class="d-label">肌肉激活 <span>Activation</span></div>
      <component
        :is="muscleFilterable ? 'button' : 'div'"
        v-for="h in sortedMuscles"
        :key="h.id"
        class="act-row"
        :class="{ 'is-static': !muscleFilterable }"
        :title="MUSCLE_MAP.get(h.id)?.action"
        @click="filterByMuscle(h.id)"
      >
        <span class="act-name">
          {{ MUSCLE_MAP.get(h.id)?.zh }}
          <span class="act-role">{{ ROLE_LABEL[h.role] }}</span>
        </span>
        <span class="act-track">
          <span class="act-fill" :class="h.role" :style="{ width: h.activation + '%' }"></span>
        </span>
        <span class="act-val">{{ h.activation }}%</span>
      </component>
      <div class="d-joint"><b>关节动作：</b>{{ ex.jointAction }}</div>
    </div>

    <div class="d-section">
      <div class="d-label">动作要领 <span>Execution</span></div>
      <ol class="cue-list">
        <li v-for="(cue, i) in ex.cues" :key="i">
          <span class="cue-num">{{ String(i + 1).padStart(2, '0') }}</span>
          <span>{{ cue }}</span>
        </li>
      </ol>
    </div>

    <div class="d-section">
      <div class="d-label">常见错误 <span>Faults</span></div>
      <div class="mistake-list">
        <div v-for="(m, i) in ex.mistakes" :key="i" class="mistake-item">
          <span class="mistake-mark">×</span>
          <span>{{ m }}</span>
        </div>
      </div>
    </div>

    <div class="note-box"><b>收缩特征 ·</b> {{ ex.contractionNote }}</div>

    <div class="d-nav">
      <button :disabled="!prev" @click="prev && pick(prev.id)">
        ← {{ prev ? prev.zh : '已是第一个' }}
      </button>
      <button :disabled="!next" @click="next && pick(next.id)">
        {{ next ? next.zh : '已是最后一个' }} →
      </button>
    </div>
  </div>
</template>
