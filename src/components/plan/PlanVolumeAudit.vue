<script setup lang="ts">
import { computed } from 'vue'
import type { VolumeAuditItem } from '@/composables/useTraining'

const props = defineProps<{
  items: VolumeAuditItem[]
  round: number
  phaseName: string
  goalZh: string
}>()

const scaleMax = computed(
  () => Math.max(1, ...props.items.map((item) => Math.max(item.max, item.sets))) * 1.05,
)

function fillPct(item: VolumeAuditItem): number {
  return Math.min(100, (item.sets / scaleMax.value) * 100)
}

function targetLeft(item: VolumeAuditItem): number {
  return (item.min / scaleMax.value) * 100
}

function targetWidth(item: VolumeAuditItem): number {
  return Math.max(1.5, ((item.max - item.min) / scaleMax.value) * 100)
}
</script>

<template>
  <section class="plan-card audit-card">
    <header class="plan-card-head">
      <div>
        <div class="plan-kicker">Volume · 容量审计</div>
        <h3 class="plan-card-title">第 {{ round }} 轮 · 每肌群直接组</h3>
      </div>
      <span class="audit-phase">{{ goalZh }} · {{ phaseName }}</span>
    </header>

    <div class="audit-list">
      <div v-for="item in items" :key="item.id" class="audit-row" :data-status="item.status">
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
      直接组 = 主动肌 1 组 + 协同肌 0.5 组，同一动作对同一肌群只计一次；
      区间按分期与水平折算，目标的差异体现在次数、负荷与休息。肩前多由推类动作间接覆盖，不单列。
    </p>
  </section>
</template>
