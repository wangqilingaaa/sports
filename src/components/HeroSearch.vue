<script setup lang="ts">
import { ref } from 'vue'
import { Search, X } from '@lucide/vue'
import { useAtlas } from '@/composables/useAtlas'

const emit = defineEmits<{ (e: 'search'): void }>()

const atlas = useAtlas()
const searchEl = ref<HTMLInputElement | null>(null)
const QUICK_TAGS = ['卧推', '深蹲', '硬拉', '引体向上', '侧平举']

function focus() {
  searchEl.value?.focus({ preventScroll: true })
}

function blur() {
  searchEl.value?.blur()
}

function submit() {
  emit('search')
}

function pickTag(tag: string) {
  atlas.query.value = tag
  atlas.clearSelection()
  submit()
}

defineExpose({ focus, blur })
</script>

<template>
  <div class="hero-search-wrap">
    <div class="hero-search">
      <div class="hero-search-field">
        <span class="hero-search-icon">
          <Search :size="16" :stroke-width="1.75" />
        </span>
        <input
          ref="searchEl"
          v-model="atlas.query.value"
          class="hero-search-input"
          type="text"
          spellcheck="false"
          aria-label="搜索动作、器械或肌群"
          placeholder="搜索动作、器械、肌群 —— 试试「卧推」"
          @keydown.enter="submit"
        />
        <span v-if="!atlas.query.value" class="hero-search-hint">/ 聚焦</span>
        <button v-else class="hero-search-clear" title="清除" @click="atlas.query.value = ''">
          <X :size="12" />
        </button>
      </div>

      <div v-if="atlas.hasFilters.value && !atlas.muscleFilter.value" class="hero-filter-note">
        <span>
          已筛选 <b>{{ atlas.results.value.length }}</b> 个动作
        </span>
        <button @click="submit">查看结果 →</button>
      </div>
      <div v-else-if="!atlas.hasFilters.value" class="quick-tags">
        <button v-for="t in QUICK_TAGS" :key="t" class="quick-tag" @click="pickTag(t)">{{ t }}</button>
      </div>
    </div>
  </div>
</template>
