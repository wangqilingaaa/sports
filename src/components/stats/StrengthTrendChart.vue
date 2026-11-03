<script setup lang="ts">
import { computed } from 'vue'
import type {
  GoalProgress,
  StrengthExerciseOption,
  StrengthSeries,
} from '@/composables/useTrainingStats'
import StatsLineChart from './StatsLineChart.vue'

const props = defineProps<{
  exercises: StrengthExerciseOption[]
  selectedId: string
  active: StrengthSeries | null
  goal?: GoalProgress | null
}>()

const emit = defineEmits<{ (event: 'select', id: string): void }>()

const best = computed(() => {
  const values =
    props.active?.points
      .map((point) => point.value)
      .filter((value): value is number => value !== null) ?? []
  return values.length ? Math.max(...values) : null
})

function onChange(event: Event) {
  emit('select', (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="stats-strength">
    <div class="stats-strength-head">
      <label class="stats-select-wrap">
        <span>动作</span>
        <select
          v-if="exercises.length"
          id="stats-strength-exercise"
          name="stats-strength-exercise"
          class="stats-select"
          aria-label="选择动作"
          :value="selectedId"
          @change="onChange"
        >
          <option v-for="exercise in exercises" :key="exercise.id" :value="exercise.id">
            {{ exercise.zh }} · {{ exercise.entries }} 次
          </option>
        </select>
        <span v-else class="stats-select-empty">暂无负重动作</span>
      </label>

      <span v-if="best !== null" class="stats-chart-summary">
        <b>{{ best }}</b> kg 范围最佳 e1RM
        <template v-if="goal"> · 目标 {{ goal.target }} kg</template>
      </span>
    </div>

    <StatsLineChart
      :points="active?.points ?? []"
      unit="kg"
      :zero-based="false"
      :reference="goal?.target ?? null"
      :reference-label="goal ? `目标 ${goal.target} kg` : ''"
      empty-text="当前范围内没有负重记录"
    />

    <p class="stats-chart-note">
      e1RM = 负重 × (1 + 次数 / 30)，每个时间桶取最高值。
    </p>
  </div>
</template>
