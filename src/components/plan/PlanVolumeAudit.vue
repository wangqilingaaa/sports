<script setup lang="ts">
import { computed, ref } from 'vue'
import type { VolumeAuditItem } from '@/composables/useTraining'

const props = defineProps<{
  items: VolumeAuditItem[]
  round: number
  phaseName: string
  goalZh: string
  perWeek: number
  splitDays: number
}>()

const mode = ref<'round' | 'week'>('round')

type DisplayItem = Pick<VolumeAuditItem, 'id' | 'zh' | 'sets' | 'min' | 'max' | 'status'>

const displayItems = computed<DisplayItem[]>(() =>
  props.items.map((item) =>
    mode.value === 'week'
      ? {
          id: item.id,
          zh: item.zh,
          sets: item.weeklySets,
          min: item.weeklyMin,
          max: item.weeklyMax,
          status: item.weeklyStatus,
        }
      : {
          id: item.id,
          zh: item.zh,
          sets: item.sets,
          min: item.min,
          max: item.max,
          status: item.status,
        },
  ),
)

const scaleMax = computed(
  () => Math.max(1, ...displayItems.value.map((item) => Math.max(item.max, item.sets))) * 1.05,
)

function fillPct(item: DisplayItem): number {
  return Math.min(100, (item.sets / scaleMax.value) * 100)
}

function targetLeft(item: DisplayItem): number {
  return (item.min / scaleMax.value) * 100
}

function targetWidth(item: DisplayItem): number {
  return Math.max(1.5, ((item.max - item.min) / scaleMax.value) * 100)
}
</script>

<template>
  <section class="plan-card audit-card">
    <header class="plan-card-head">
      <div>
        <div class="plan-kicker">Volume · 容量审计</div>
        <h3 class="plan-card-title">
          {{ mode === 'round' ? `第 ${round} 轮` : '按周折算' }} · 每肌群直接组
        </h3>
      </div>
      <div class="audit-head-side">
        <span class="audit-phase">{{ goalZh }} · {{ phaseName }}</span>
        <div class="audit-mode">
          <button :class="{ 'is-active': mode === 'round' }" @click="mode = 'round'">按轮</button>
          <button :class="{ 'is-active': mode === 'week' }" @click="mode = 'week'">按周</button>
        </div>
      </div>
    </header>

    <div class="audit-list">
      <div v-for="item in displayItems" :key="item.id" class="audit-row" :data-status="item.status">
        <span class="audit-name">{{ item.zh }}</span>
        <span class="audit-track">
          <i
            class="audit-target"
            :style="{ left: `${targetLeft(item)}%`, width: `${targetWidth(item)}%` }"
          ></i>
          <i class="audit-fill" :style="{ width: `${fillPct(item)}%` }"></i>
        </span>
        <span class="audit-val">{{ item.sets }}<small>/{{ item.min }}–{{ item.max }}</small></span>
      </div>
    </div>

    <div class="audit-legend">
      <span data-status="low"><i></i>不足</span>
      <span data-status="ok"><i></i>达标</span>
      <span data-status="high"><i></i>偏高</span>
    </div>

    <p class="audit-note">
      <template v-if="mode === 'round'">
        按轮：当前循环 {{ splitDays }} 练的处方总量；区间已按分期、水平与分化折算。
      </template>
      <template v-else>
        按周：每轮组数 × 每周 {{ perWeek }} 练 ÷ 每轮 {{ splitDays }} 练；区间按分期与水平折算，
        不乘分化系数。
      </template>
      直接组 = 主动肌 1 组 + 协同肌 0.5 组，同一动作对同一肌群只计一次；
      肩前多由推类动作间接覆盖，不单列。
    </p>
  </section>
</template>
