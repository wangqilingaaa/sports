<script setup lang="ts">
import { computed } from 'vue'
import type { MuscleGroupSeries } from '@/composables/useTrainingStats'

const props = defineProps<{
  groups: MuscleGroupSeries[]
  activeId: string
}>()

const emit = defineEmits<{ (event: 'select', id: string): void }>()

const scaleMax = computed(() => {
  const peak = Math.max(1, ...props.groups.map((group) => Math.max(group.weeklyAvg, group.target[1])))
  return peak * 1.08
})

function width(value: number): string {
  return `${Math.min(100, (value / scaleMax.value) * 100)}%`
}

function bandLeft(group: MuscleGroupSeries): string {
  return width(group.target[0])
}

function bandWidth(group: MuscleGroupSeries): string {
  return width(Math.max(0, group.target[1] - group.target[0]))
}

function status(group: MuscleGroupSeries): 'low' | 'ok' | 'high' {
  if (group.weeklyAvg < group.target[0]) return 'low'
  if (group.weeklyAvg > group.target[1]) return 'high'
  return 'ok'
}
</script>

<template>
  <div class="stats-balance">
    <div class="stats-balance-head">
      <span>范围周均</span>
      <span>浅色带为目标区间</span>
    </div>

    <button
      v-for="group in groups"
      :key="group.id"
      class="stats-balance-row"
      :class="[`is-${status(group)}`, { 'is-active': group.id === activeId }]"
      :title="`周均 ${group.weeklyAvg} 组 · 目标 ${group.target[0]}–${group.target[1]} 组`"
      @click="emit('select', group.id)"
    >
      <span class="stats-balance-name">{{ group.zh }}</span>
      <span class="stats-balance-track">
        <span class="stats-balance-band" :style="{ left: bandLeft(group), width: bandWidth(group) }"></span>
        <span class="stats-balance-fill" :style="{ width: width(group.weeklyAvg) }"></span>
      </span>
      <span class="stats-balance-value">{{ group.weeklyAvg }}</span>
    </button>

    <p class="stats-chart-note">
      周均按有记录的周计算；目标带按当前水平与分化折算，不含分期差异。
    </p>
  </div>
</template>
