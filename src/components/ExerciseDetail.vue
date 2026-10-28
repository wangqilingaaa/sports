<script setup lang="ts">
import { computed } from 'vue'
import { useAtlas } from '@/composables/useAtlas'
import { EQUIPMENT_MAP, LEVEL_LABEL, PATTERN_LABEL } from '@/data/equipment'
import { MUSCLE_MAP, ROLE_LABEL } from '@/data/muscles'
import MovementDemo from './MovementDemo.vue'

const atlas = useAtlas()

const ex = computed(() => atlas.activeExercise.value)

const sortedMuscles = computed(() => {
  if (!ex.value) return []
  return [...ex.value.muscles].sort((a, b) => b.activation - a.activation)
})

const equip = computed(() => (ex.value ? EQUIPMENT_MAP.get(ex.value.equipment) : null))

const index = computed(() => atlas.results.value.findIndex((e) => e.id === ex.value?.id))

const prev = computed(() => (index.value > 0 ? atlas.results.value[index.value - 1] : null))
const next = computed(() =>
  index.value >= 0 && index.value < atlas.results.value.length - 1
    ? atlas.results.value[index.value + 1]
    : null,
)

const tempoText = computed(() => {
  if (!ex.value) return ''
  const [c, e] = ex.value.tempo
  if (c === 0 && e === 0) return '等长保持'
  return `向心 ${c}s · 离心 ${e}s`
})

function filterByMuscle(id: (typeof sortedMuscles.value)[number]['id']) {
  atlas.toggleMuscle(id)
}
</script>

<template>
  <div v-if="ex" class="detail">
    <div class="d-top">
      <span class="d-kicker">{{ String(index + 1).padStart(2, '0') }} / {{ atlas.results.value.length }}</span>
      <span class="d-kicker">{{ equip?.en }}</span>
    </div>

    <h2 class="d-title">{{ ex.zh }}</h2>
    <div class="d-en">{{ ex.en }}</div>

    <div class="d-badges">
      <span class="badge solid">{{ LEVEL_LABEL[ex.level] }}</span>
      <span class="badge">{{ equip?.zh }}</span>
      <span class="badge">{{ PATTERN_LABEL[ex.pattern] }}</span>
      <span class="badge">{{ tempoText }}</span>
      <span v-if="ex.unilateral" class="badge accent">单侧</span>
    </div>

    <MovementDemo />

    <div class="d-section">
      <div class="d-label">肌肉激活 <span>Activation</span></div>
      <button
        v-for="h in sortedMuscles"
        :key="h.id"
        class="act-row"
        :title="MUSCLE_MAP.get(h.id)?.action"
        @click="filterByMuscle(h.id)"
      >
        <span class="act-name">
          {{ MUSCLE_MAP.get(h.id)?.zh }}
          <span class="act-role">{{ ROLE_LABEL[h.role] }}</span>
        </span>
        <span class="act-track">
          <span class="act-fill" :class="h.role" :style="{ width: h.activation + '%' }"></span>
        </span>
        <span class="act-val">{{ h.activation }}%</span>
      </button>
      <div class="d-joint"><b>关节动作：</b>{{ ex.jointAction }}</div>
    </div>

    <div class="d-section">
      <div class="d-label">动作要领 <span>Execution</span></div>
      <ol class="cue-list">
        <li v-for="(cue, i) in ex.cues" :key="i">
          <span class="cue-num">{{ String(i + 1).padStart(2, '0') }}</span>
          <span>{{ cue }}</span>
        </li>
      </ol>
    </div>

    <div class="d-section">
      <div class="d-label">常见错误 <span>Faults</span></div>
      <div class="mistake-list">
        <div v-for="(m, i) in ex.mistakes" :key="i" class="mistake-item">
          <span class="mistake-mark">×</span>
          <span>{{ m }}</span>
        </div>
      </div>
    </div>

    <div class="note-box"><b>收缩特征 ·</b> {{ ex.contractionNote }}</div>

    <div class="d-nav">
      <button :disabled="!prev" @click="prev && atlas.selectExercise(prev.id)">
        ← {{ prev ? prev.zh : '已是第一个' }}
      </button>
      <button :disabled="!next" @click="next && atlas.selectExercise(next.id)">
        {{ next ? next.zh : '已是最后一个' }} →
      </button>
    </div>
  </div>
</template>
