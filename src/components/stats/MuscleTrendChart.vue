<script setup lang="ts">
import type { MuscleGroupSeries } from '@/composables/useTrainingStats'
import StatsLineChart from './StatsLineChart.vue'

defineProps<{
  groups: MuscleGroupSeries[]
  selectedId: string
  active?: MuscleGroupSeries
}>()

const emit = defineEmits<{ (event: 'select', id: string): void }>()
</script>

<template>
  <div class="stats-muscle-trend">
    <div class="stats-mchips">
      <button
        v-for="group in groups"
        :key="group.id"
        class="stats-mchip"
        :class="{ 'is-active': group.id === selectedId }"
        @click="emit('select', group.id)"
      >
        {{ group.zh }}
      </button>
    </div>

    <div v-if="active" class="stats-chart-summary">
      <span><b>{{ active.weeklyAvg }}</b> 周均有效组</span>
      <span>目标 {{ active.target[0] }}–{{ active.target[1] }} 组</span>
      <span>范围累计 {{ active.totalSets }} 组</span>
    </div>

    <StatsLineChart
      :points="active?.points ?? []"
      unit="有效组"
      area
      empty-text="当前范围内没有肌群记录"
    />
  </div>
</template>
