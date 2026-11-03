<script setup lang="ts">
import { computed } from 'vue'

interface LinePoint {
  label: string
  value: number | null
  title?: string
}

const props = withDefaults(
  defineProps<{
    points: LinePoint[]
    unit: string
    zeroBased?: boolean
    area?: boolean
    emptyText?: string
    reference?: number | null
    referenceLabel?: string
  }>(),
  {
    zeroBased: true,
    area: false,
    emptyText: '当前范围内没有数据',
    reference: null,
  },
)

const W = 720
const H = 260
const PAD = { top: 18, right: 16, bottom: 30, left: 52 }
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
  props.points
    .map((point) => point.value)
    .filter((value): value is number => value !== null && Number.isFinite(value)),
)

const hasData = computed(() => values.value.length > 0)

const reference = computed(() =>
  typeof props.reference === 'number' && Number.isFinite(props.reference) ? props.reference : null,
)

const scale = computed(() => {
  if (!values.value.length) return { lo: 0, hi: 1, ticks: [0, 0.5, 1] }
  const extent =
    reference.value === null ? values.value : [...values.value, reference.value]
  const rawMin = Math.min(...extent)
  const rawMax = Math.max(...extent)

  if (props.zeroBased) {
    const step = niceStep(Math.max(rawMax, 1) / 4)
    const hi = step * 4
    return { lo: 0, hi, ticks: [0, 1, 2, 3, 4].map((i) => step * i) }
  }

  const span = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.05, 1)
  const step = niceStep((span * 1.4) / 4)
  const lo = Math.max(0, Math.floor((rawMin - span * 0.2) / step) * step)
  const hi = lo + step * 4
  return { lo, hi, ticks: [0, 1, 2, 3, 4].map((i) => lo + step * i) }
})

function xAt(index: number): number {
  const count = props.points.length
  if (count <= 1) return PAD.left + plotW / 2
  return PAD.left + (index / (count - 1)) * plotW
}

function yAt(value: number): number {
  const span = Math.max(scale.value.hi - scale.value.lo, 1e-9)
  return PAD.top + plotH - ((value - scale.value.lo) / span) * plotH
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(0)}k`
  if (Math.abs(value) >= 1_000) return `${(value / 1000).toFixed(1)}k`
  return `${Math.round(value * 10) / 10}`
}

const segments = computed(() => {
  const out: string[] = []
  let current = ''
  props.points.forEach((point, index) => {
    if (point.value === null) {
      if (current) out.push(current)
      current = ''
      return
    }
    current += `${current ? ' L' : 'M'} ${xAt(index).toFixed(1)},${yAt(point.value).toFixed(1)}`
  })
  if (current) out.push(current)
  return out
})

const areaPaths = computed(() => {
  if (!props.area) return []
  const out: string[] = []
  const points = props.points
  let start = -1

  for (let i = 0; i <= points.length; i++) {
    const value = i < points.length ? points[i].value : null
    if (value !== null && start === -1) start = i
    if (value === null && start !== -1) {
      const end = i - 1
      const first = points[start].value
      if (first !== null) {
        let d = `M ${xAt(start).toFixed(1)},${yAt(first).toFixed(1)}`
        for (let j = start + 1; j <= end; j++) {
          const pointValue = points[j].value
          if (pointValue !== null) {
            d += ` L ${xAt(j).toFixed(1)},${yAt(pointValue).toFixed(1)}`
          }
        }
        d += ` L ${xAt(end).toFixed(1)},${yAt(scale.value.lo).toFixed(1)}`
        d += ` L ${xAt(start).toFixed(1)},${yAt(scale.value.lo).toFixed(1)} Z`
        out.push(d)
      }
      start = -1
    }
  }

  return out
})

const dots = computed(() => {
  const out: { x: number; y: number; title: string }[] = []
  props.points.forEach((point, index) => {
    if (point.value === null) return
    out.push({
      x: xAt(index),
      y: yAt(point.value),
      title: point.title ?? `${point.label} · ${point.value} ${props.unit}`,
    })
  })
  return out
})

const xTicks = computed(() => {
  const count = props.points.length
  if (!count) return []
  const stride = Math.max(1, Math.ceil(count / 6))
  const indexes = new Set<number>()
  for (let i = 0; i < count; i += stride) indexes.add(i)
  indexes.add(count - 1)
  return [...indexes].sort((a, b) => a - b)
})
</script>

<template>
  <div class="stats-chart-box">
    <svg
      v-if="hasData"
      class="stats-chart"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="`${unit}趋势`"
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

      <g v-if="reference !== null" class="stats-chart-reference">
        <line
          :x1="PAD.left"
          :x2="W - PAD.right"
          :y1="yAt(reference)"
          :y2="yAt(reference)"
        />
        <text :x="W - PAD.right" :y="yAt(reference) - 5" text-anchor="end">
          {{ referenceLabel ?? reference }}
        </text>
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
          {{ points[index]?.label }}
        </text>
      </g>

      <g v-if="area" class="stats-chart-areas">
        <path v-for="(path, index) in areaPaths" :key="`area-${index}`" :d="path" />
      </g>

      <g class="stats-chart-lines">
        <path v-for="(path, index) in segments" :key="`line-${index}`" :d="path" />
      </g>

      <g class="stats-chart-dots">
        <circle v-for="(dot, index) in dots" :key="`dot-${index}`" :cx="dot.x" :cy="dot.y" r="2.6">
          <title>{{ dot.title }}</title>
        </circle>
      </g>
    </svg>

    <div v-else class="stats-chart-empty">{{ emptyText }}</div>
  </div>
</template>
