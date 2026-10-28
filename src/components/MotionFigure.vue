<script setup lang="ts">
import { computed } from 'vue'
import { DEMO_SLUG, REVERSED } from '@/data/demo-map'

/**
 * 动作演示图。素材来自 @bryllim/workout-guide（512×512 透明单色 PNG，每个动作 3 帧）。
 *
 * 素材是纯白线稿，这里用 CSS mask 把它当作形状、再用背景色上色，
 * 这样能跟随主题色渲染，同时不改动原图（避免构成 CC BY-SA 4.0 的「改编」）。
 */
const props = defineProps<{
  exerciseId: string
  /** 收缩相位：0 = 完全拉长，1 = 最短（来自 useContraction） */
  phase: number
}>()

const srcs = computed(() => {
  const slug = DEMO_SLUG[props.exerciseId]
  return slug ? [1, 2, 3].map((n) => `/demo/${slug}/frame-${n}.png`) : []
})

/** 相位映射到 0..2 的帧位置；REVERSED 里的动作首尾帧方向相反 */
const pos = computed(() => {
  const p = Math.min(1, Math.max(0, props.phase))
  return (REVERSED.has(props.exerciseId) ? 1 - p : p) * 2
})

/** 相邻两帧之间线性交叉淡入，避免三帧硬切 */
const layers = computed(() => {
  const t = pos.value
  const i0 = Math.min(2, Math.floor(t))
  const i1 = Math.min(2, i0 + 1)
  const w = t - i0
  return srcs.value.map((src, i) => ({
    src,
    opacity: i === i0 && i === i1 ? 1 : i === i0 ? 1 - w : i === i1 ? w : 0,
  }))
})
</script>

<template>
  <div class="motion-figure" aria-hidden="true">
    <span
      v-for="(layer, i) in layers"
      :key="i"
      class="mf-frame"
      :style="{ '--src': `url(${layer.src})`, opacity: layer.opacity }"
    />
  </div>
</template>
