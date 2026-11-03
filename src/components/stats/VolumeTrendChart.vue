<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  formatDate,
  formatVolume,
  type StatsBucket,
} from '@/composables/useTrainingStats'

const props = defineProps<{ series: StatsBucket[] }>()

const metric = ref<'sets' | 'volume'>('sets')

const W = 720
const H = 240
const PAD = { top: 16, right: 14, bottom: 30, left: 52 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

function niceStep(value: number): number {
  const v = Math.max(value, 1e-6)
  const exp = Math.floor(Math.log10(v))
  const base = 10 ** exp
  const n = v / base
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  return (steps.find((step) => n <= step) ?? 10) * base
}

const values = computed(() =>
  props.series.map((bucket) => (metric.value === 'sets' ? bucket.sets : bucket.volume)),
)

const total = computed(() => values.value.reduce((sum, value) => sum + value, 0))

const bodyweightSets = computed(() =>
  props.series.reduce((sum, bucket) => sum + bucket.bodyweightSets, 0),
)

const hasData = computed(() => props.series.some((bucket) => bucket.sets > 0))

const scale = computed(() => {
  const step = niceStep(Math.max(1, ...values.value) / 4)
  return { hi: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => step * i) }
})

const barWidth = computed(() =>
  Math.max(1.5, Math.min(30, (plotW / Math.max(1, props.series.length)) * 0.62)),
)

const bars = computed(() =>
  props.series.map((bucket, index) => {
    const value = metric.value === 'sets' ? bucket.sets : bucket.volume
    const height = (value / scale.value.hi) * plotH
    const center = PAD.left + ((index + 0.5) / Math.max(1, props.series.length)) * plotW
    return {
      x: center - barWidth.value / 2,
      y: PAD.top + plotH - height,
      height,
      title: `${formatDate(bucket.start)} 起 · ${bucket.sessions} 练 · ${bucket.sets} 组 · ${formatVolume(bucket.volume)} kg`,
    }
  }),
)

const xTicks = computed(() => {
  const count = props.series.length
  if (!count) return []
  const stride = Math.max(1, Math.ceil(count / 6))
  const indexes = new Set<number>()
  for (let i = 0; i < count; i += stride) indexes.add(i)
  indexes.add(count - 1)
  return [...indexes].sort((a, b) => a - b)
})

function xAt(index: number): number {
  return PAD.left + ((index + 0.5) / Math.max(1, props.series.length)) * plotW
}

function yAt(value: number): number {
  return PAD.top + plotH - (value / scale.value.hi) * plotH
}

function formatTick(value: number): string {
  if (value >= 10_000) return `${(value / 1000).toFixed(0)}k`
  if (value >= 1_000) return `${(value / 1000).toFixed(1)}k`
  return `${Math.round(value * 10) / 10}`
}

const totalText = computed(() =>
  metric.value === 'sets' ? `${total.value} 组` : `${formatVolume(total.value)} kg`,
)
</script>

<template>
  <div class="stats-chart-toolbar">
    <div class="stats-toggle" role="group" aria-label="训练量口径">
      <button :class="{ 'is-active': metric === 'sets' }" @click="metric = 'sets'">组数</button>
      <button :class="{ 'is-active': metric === 'volume' }" @click="metric = 'volume'">吨位</button>
    </div>
    <span class="stats-chart-total">合计 <b>{{ totalText }}</b></span>
  </div>

  <div class="stats-chart-box">
    <svg
      v-if="hasData"
      class="stats-chart"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      aria-label="训练量趋势"
    >
      <g class="stats-chart-grid">
        <line
          v-for="(tick, index) in scale.ticks"
          :key="`grid-${index}`"
          :x1="PAD.left"
          :x2="W - PAD.right"
          :y1="yAt(tick)"
          :y2="yAt(tick)"
        />
      </g>

      <g class="stats-bars">
        <rect
          v-for="(bar, index) in bars"
          :key="`bar-${index}`"
          :x="bar.x"
          :y="bar.y"
          :width="barWidth"
          :height="bar.height"
          rx="1"
        >
          <title>{{ bar.title }}</title>
        </rect>
      </g>

      <g class="stats-chart-axis">
        <text
          v-for="(tick, index) in scale.ticks"
          :key="`tick-${index}`"
          :x="PAD.left - 8"
          :y="yAt(tick) + 3"
          text-anchor="end"
        >
          {{ formatTick(tick) }}
        </text>
        <text
          v-for="index in xTicks"
          :key="`label-${index}`"
          :x="xAt(index)"
          :y="H - 9"
          text-anchor="middle"
        >
          {{ series[index]?.label }}
        </text>
      </g>
    </svg>

    <div v-else class="stats-chart-empty">当前范围内没有训练记录</div>
  </div>

  <p v-if="metric === 'volume' && bodyweightSets" class="stats-chart-note">
    自重动作共 {{ bodyweightSets }} 组，无外部负重，未计入吨位。
  </p>
</template>
