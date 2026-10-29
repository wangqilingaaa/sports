<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { useAtlas } from '@/composables/useAtlas'
import { EQUIPMENT_MAP, LEVEL_LABEL, PATTERN_LABEL } from '@/data/equipment'
import { MUSCLE_MAP } from '@/data/muscles'
import type { Exercise } from '@/data/types'

const PAGE_SIZE = 20

const atlas = useAtlas()
const sort = ref<'default' | 'level'>('default')
const page = ref(1)

const list = computed(() => {
  const arr = [...atlas.results.value]
  if (sort.value === 'level') arr.sort((a, b) => a.level - b.level || a.zh.localeCompare(b.zh))
  return arr
})

const pageCount = computed(() => Math.max(1, Math.ceil(list.value.length / PAGE_SIZE)))
const paged = computed(() =>
  list.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
)
/** 当前页在整份结果里的序号区间，用来编卡片序号和「01–20 / 总数」 */
const rangeFrom = computed(() => (list.value.length ? (page.value - 1) * PAGE_SIZE + 1 : 0))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, list.value.length))

// 换筛选、换排序都从第一页看起，避免停在已被切掉的页码上
watch([atlas.results, sort], () => {
  page.value = 1
})

// 从模型浮层或抽屉里选中的动作可能不在当前页，自动翻到它所在的页
watch(
  () => atlas.selectedId.value,
  (id) => {
    if (!id) return
    const i = list.value.findIndex((ex) => ex.id === id)
    if (i >= 0) page.value = Math.floor(i / PAGE_SIZE) + 1
  },
)

function goPage(n: number) {
  const next = Math.min(Math.max(1, n), pageCount.value)
  if (next === page.value) return
  page.value = next
  atlas.hoveredId.value = null
  scrollToListHead()
}

/** 翻页后回到列表顶部：页尾的翻页条不会把读者留在旧位置 */
function scrollToListHead() {
  const head = document.querySelector<HTMLElement>('.list-head')
  if (!head) return
  const bar =
    (document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().height ?? 0) +
    (document.querySelector<HTMLElement>('.filters')?.getBoundingClientRect().height ?? 0)
  window.scrollTo({
    top: head.getBoundingClientRect().top + window.scrollY - bar - 12,
    behavior: 'smooth',
  })
}

function pageLabel(n: number) {
  return String(n).padStart(2, '0')
}

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
        v-for="(ex, i) in paged"
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
          <span class="ex-idx">{{ indexLabel(rangeFrom - 1 + i) }}</span>
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

    <nav v-if="pageCount > 1" class="pager" aria-label="动作列表分页">
      <span class="pager-range">
        <b>{{ pageLabel(rangeFrom) }}–{{ pageLabel(rangeTo) }}</b>
        / {{ list.length }}
      </span>

      <div class="pager-track">
        <button
          class="pager-step"
          :disabled="page === 1"
          aria-label="上一页"
          @click="goPage(page - 1)"
        >
          <ChevronLeft :size="13" :stroke-width="2" />
        </button>

        <button
          v-for="n in pageCount"
          :key="n"
          class="pager-num"
          :class="{ 'is-active': n === page }"
          :aria-current="n === page ? 'page' : undefined"
          :aria-label="`第 ${n} 页`"
          @click="goPage(n)"
        >
          {{ pageLabel(n) }}
        </button>

        <button
          class="pager-step"
          :disabled="page === pageCount"
          aria-label="下一页"
          @click="goPage(page + 1)"
        >
          <ChevronRight :size="13" :stroke-width="2" />
        </button>
      </div>
    </nav>
  </div>
</template>
