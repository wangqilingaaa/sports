<script setup lang="ts">
import { computed } from 'vue'
import { Pause, Play } from '@lucide/vue'
import { useAtlas } from '@/composables/useAtlas'
import { useContraction } from '@/composables/useContraction'
import { EQUIPMENT_MAP, PATTERN_LABEL } from '@/data/equipment'
import MotionFigure from './MotionFigure.vue'

const atlas = useAtlas()
const { subject, c, clock, cycleLen, phase } = useContraction()

/**
 * 标题用「动作模式」而不是 demo.kind。
 * demo.kind 是自绘时代选骨架形态用的 32 个桶，桶名（飞鸟/卷腹/臂屈伸）并不等于动作名——
 * 蝴蝶机夹胸、绳索伐木、器械髋内收都会被套上错的桶名。pattern 只有 9 个值，永远成立。
 */
const label = computed(() => PATTERN_LABEL[subject.value.pattern])
const equip = computed(() => EQUIPMENT_MAP.get(subject.value.equipment))
const phaseText = computed(() =>
  phase.value === 'concentric' ? '向心收缩' : phase.value === 'eccentric' ? '离心控制' : '等长保持',
)

const cyclePct = computed(() => ((clock.value % cycleLen.value) / cycleLen.value) * 100)
</script>

<template>
  <section class="demo-card">
    <header class="demo-head">
      <div class="demo-title">动作演示 <small>Movement</small></div>
      <div class="ct-right">
        <span class="ct-muscle">{{ subject.zh }}</span>
        <button
          class="play-btn"
          :title="atlas.isPlaying.value ? '暂停' : '播放'"
          @click="atlas.isPlaying.value = !atlas.isPlaying.value"
        >
          <Pause v-if="atlas.isPlaying.value" :size="9" fill="currentColor" :stroke-width="1.4" />
          <Play v-else :size="10" fill="currentColor" :stroke-width="1.4" />
        </button>
      </div>
    </header>

    <div class="demo-body">
      <div class="demo-stage">
        <MotionFigure :exercise-id="subject.id" :phase="c" />
      </div>

      <div class="demo-meta">
        <div class="demo-pattern">
          {{ label }}<span>{{ equip?.zh }} · {{ phaseText }}</span>
        </div>
        <p class="demo-cue"><b>01</b>{{ subject.cues[0] }}</p>
        <p class="demo-cue"><b>02</b>{{ subject.cues[1] }}</p>
        <div class="demo-src">演示图 Bryl Lim / Everkinetic · CC BY-SA 4.0</div>
      </div>
    </div>

    <div class="ct-bar"><i :style="{ width: cyclePct + '%' }"></i></div>
  </section>
</template>
