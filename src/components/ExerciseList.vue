<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAtlas } from '@/composables/useAtlas'
import { EQUIPMENT_MAP, LEVEL_LABEL, PATTERN_LABEL } from '@/data/equipment'
import { MUSCLE_MAP } from '@/data/muscles'
import type { Exercise } from '@/data/types'

const atlas = useAtlas()
const sort = ref<'default' | 'level'>('default')

const list = computed(() => {
  const arr = [...atlas.results.value]
  if (sort.value === 'level') arr.sort((a, b) => a.level - b.level || a.zh.localeCompare(b.zh))
  return arr
})

function bars(ex: Exercise) {
  return [...ex.muscles].sort((a, b) => b.activation - a.activation).slice(0, 3)
}

function indexLabel(i: number) {
  return String(i + 1).padStart(2, '0')
}

function equipName(ex: Exercise) {
  return EQUIPMENT_MAP.get(ex.equipment)?.zh ?? ''
}

function onHover(id: string | null) {
  atlas.hoveredId.value = id
}
</script>

<template>
  <div class="library-body">
    <div class="list-head">
      <span class="list-head-title"><b>{{ list.length }}</b> 个动作</span>
      <span class="filter-summary" v-if="atlas.muscleFilter.value">
        已按「{{ MUSCLE_MAP.get(atlas.muscleFilter.value)?.zh }}」筛选
      </span>

      <div class="sort-group">
        <button class="sort-btn" :class="{ 'is-active': sort === 'default' }" @click="sort = 'default'">
          {{ atlas.query.value.trim() ? '相关度' : '器械顺序' }}
        </button>
        <button class="sort-btn" :class="{ 'is-active': sort === 'level' }" @click="sort = 'level'">难度</button>
      </div>
    </div>

    <div class="ex-grid" @mouseleave="onHover(null)">
      <button
        v-for="(ex, i) in list"
        :key="ex.id"
        class="ex-card"
        :class="{ 'is-active': atlas.selectedId.value === ex.id }"
        :data-id="ex.id"
        :aria-current="atlas.selectedId.value === ex.id ? 'true' : undefined"
        @mouseenter="onHover(ex.id)"
        @focus="onHover(ex.id)"
        @click="atlas.selectExercise(ex.id)"
      >
        <span class="ex-top">
          <span class="ex-idx">{{ indexLabel(i) }}</span>
          <span class="ex-idx" style="color: var(--ink-3); letter-spacing: 0.1em">
            {{ PATTERN_LABEL[ex.pattern] }}
          </span>
          <span v-if="atlas.selectedId.value === ex.id" class="ex-now">已选中</span>
          <span class="ex-lv">{{ LEVEL_LABEL[ex.level] }}</span>
        </span>

        <span class="ex-zh">{{ ex.zh }}</span>
        <span class="ex-en">{{ ex.en }}</span>

        <span class="ex-bars">
          <span v-for="h in bars(ex)" :key="h.id" class="ex-bar" :class="h.role">
            <span class="ex-bar-name">{{ MUSCLE_MAP.get(h.id)?.zh }}</span>
            <span class="ex-bar-track"><i :style="{ width: h.activation + '%' }"></i></span>
            <span class="ex-bar-val">{{ h.activation }}</span>
          </span>
        </span>

        <span class="ex-foot">
          {{ equipName(ex) }}
          <i class="ex-dot"></i>
          {{ ex.muscles.length }} 肌群
          <template v-if="ex.unilateral">
            <i class="ex-dot"></i>单侧
          </template>
          <span class="ex-open">详情 →</span>
        </span>
      </button>

      <div v-if="!list.length" class="empty">
        <b>没有匹配的动作</b>
        试着搜索「卧推 / bench / 推胸 / wotui」，或清除筛选条件
      </div>
    </div>
  </div>
</template>
