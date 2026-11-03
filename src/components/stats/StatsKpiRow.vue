<script setup lang="ts">
import { formatVolume, type StatsOverview } from '@/composables/useTrainingStats'

defineProps<{ overview: StatsOverview }>()
</script>

<template>
  <div class="stats-kpis">
    <div class="stats-kpi">
      <span class="stats-kpi-label">训练次数</span>
      <span class="stats-kpi-value">{{ overview.sessions }}<em>练</em></span>
      <span class="stats-kpi-sub">跨 {{ overview.cycles }} 个周期</span>
    </div>

    <div class="stats-kpi">
      <span class="stats-kpi-label">总组数</span>
      <span class="stats-kpi-value">{{ overview.sets }}<em>组</em></span>
      <span class="stats-kpi-sub">
        {{ overview.bodyweightSets ? `其中自重 ${overview.bodyweightSets} 组` : '全部为负重动作' }}
      </span>
    </div>

    <div class="stats-kpi">
      <span class="stats-kpi-label">外部负重容量</span>
      <span class="stats-kpi-value">{{ formatVolume(overview.volume) }}<em>kg</em></span>
      <span class="stats-kpi-sub">自重动作不计入</span>
    </div>

    <div class="stats-kpi">
      <span class="stats-kpi-label">训练周数</span>
      <span class="stats-kpi-value">{{ overview.activeWeeks }}<em>周</em></span>
      <span class="stats-kpi-sub">周均 {{ overview.sessionsPerWeek }} 练</span>
    </div>

    <div class="stats-kpi">
      <span class="stats-kpi-label">平均 RPE</span>
      <span class="stats-kpi-value">{{ overview.avgRpe || '—' }}</span>
      <span class="stats-kpi-sub">按组数加权</span>
    </div>
  </div>
</template>
