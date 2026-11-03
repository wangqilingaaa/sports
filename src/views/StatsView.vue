<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ArrowLeft } from '@lucide/vue'
import {
  GOAL_MILESTONE_STEP,
  STATS_GRANULARITIES,
  STATS_RANGES,
  useTrainingStats,
} from '@/composables/useTrainingStats'
import StatsKpiRow from '@/components/stats/StatsKpiRow.vue'
import LiftGoals from '@/components/stats/LiftGoals.vue'
import VolumeTrendChart from '@/components/stats/VolumeTrendChart.vue'
import MuscleTrendChart from '@/components/stats/MuscleTrendChart.vue'
import MuscleBalanceBars from '@/components/stats/MuscleBalanceBars.vue'
import StrengthTrendChart from '@/components/stats/StrengthTrendChart.vue'
import PrTable from '@/components/stats/PrTable.vue'

const stats = useTrainingStats()

const activeGoal = computed(() => {
  const id = stats.activeStrength.value?.id
  return id ? (stats.goalProgress.value.find((goal) => goal.id === id) ?? null) : null
})

function selectMuscle(id: string) {
  stats.selectedMuscleId.value = id
}

function selectStrength(id: string) {
  stats.selectedStrengthId.value = id
}

onMounted(() => {
  stats.refreshNow()
})
</script>

<template>
  <section class="stats-page">
    <div class="stats-wrap">
      <header class="stats-head">
        <div class="stats-head-main">
          <RouterLink class="stats-back" :to="{ name: 'plan' }">
            <ArrowLeft :size="12" />返回训练计划
          </RouterLink>
          <div class="stats-kicker">Progress · 长期趋势</div>
          <h1 class="stats-title">训练统计</h1>
          <p class="stats-lead">
            跨周期汇总本地打卡记录：训练量、肌群容量与力量进展。聚合只看记录本身，不依赖当前训练计划。
          </p>
        </div>

        <div v-if="stats.hasLogs.value" class="stats-controls">
          <div class="stats-control-row">
            <span class="stats-control-key">范围</span>
            <div class="stats-chips">
              <button
                v-for="item in STATS_RANGES"
                :key="item.id"
                class="stats-chip"
                :class="{ 'is-active': stats.range.value === item.id }"
                @click="stats.range.value = item.id"
              >
                {{ item.zh }}
              </button>
            </div>
          </div>
          <div class="stats-control-row">
            <span class="stats-control-key">粒度</span>
            <div class="stats-chips">
              <button
                v-for="item in STATS_GRANULARITIES"
                :key="item.id"
                class="stats-chip"
                :class="{ 'is-active': stats.granularity.value === item.id }"
                @click="stats.granularity.value = item.id"
              >
                {{ item.zh }}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div v-if="!stats.hasLogs.value" class="stats-empty">
        <p>还没有打卡记录。先去训练计划完成一次训练，统计页会自动汇总。</p>
        <RouterLink class="stats-empty-link" :to="{ name: 'plan' }">去训练计划</RouterLink>
      </div>

      <template v-else>
        <StatsKpiRow :overview="stats.overview.value" />

        <section class="stats-card">
          <header class="stats-card-head">
            <div>
              <div class="stats-kicker">Goals · 主项</div>
              <h2 class="stats-card-title">主项目标与里程碑</h2>
            </div>
            <span class="stats-card-meta">
              全量历史 · 目标按 e1RM 计算 · 每 {{ GOAL_MILESTONE_STEP }} kg 里程碑
            </span>
          </header>
          <LiftGoals :goals="stats.goalProgress.value" :prs="stats.prs.value" />
        </section>

        <section class="stats-card">
          <header class="stats-card-head">
            <div>
              <div class="stats-kicker">Volume · 训练量</div>
              <h2 class="stats-card-title">训练量趋势</h2>
            </div>
            <span class="stats-card-meta">{{ stats.rangeLabel.value }}</span>
          </header>
          <VolumeTrendChart :series="stats.buckets.value" />
        </section>

        <section class="stats-card">
          <header class="stats-card-head">
            <div>
              <div class="stats-kicker">Muscle · 肌群</div>
              <h2 class="stats-card-title">肌群容量趋势</h2>
            </div>
            <span class="stats-card-meta">有效组 = 组数 × 激活占比 × RPE 系数</span>
          </header>
          <div class="stats-split">
            <MuscleTrendChart
              :groups="stats.muscleGroups.value"
              :selected-id="stats.selectedMuscleId.value"
              :active="stats.activeMuscle.value"
              @select="selectMuscle"
            />
            <MuscleBalanceBars
              :groups="stats.muscleGroups.value"
              :active-id="stats.selectedMuscleId.value"
              @select="selectMuscle"
            />
          </div>
        </section>

        <section class="stats-card">
          <header class="stats-card-head">
            <div>
              <div class="stats-kicker">Strength · 力量</div>
              <h2 class="stats-card-title">力量进展与 PR</h2>
            </div>
            <span class="stats-card-meta">跨周期 · 历史最佳</span>
          </header>
          <div class="stats-split stats-split-strength">
            <StrengthTrendChart
              :exercises="stats.strengthExercises.value"
              :selected-id="stats.selectedStrengthId.value"
              :active="stats.activeStrength.value"
              :goal="activeGoal"
              @select="selectStrength"
            />
            <PrTable :prs="stats.prs.value" :goal-ids="stats.goalProgress.value.map((goal) => goal.id)" />
          </div>
        </section>

        <p class="stats-foot">
          记录只存在浏览器本地（localStorage），换设备或清缓存后统计会丢失。历史周按记录时间归入周一至周日；
          旧版按日期存储的记录以当天零点计。
        </p>
      </template>
    </div>
  </section>
</template>
