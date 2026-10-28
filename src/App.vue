<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAtlas } from '@/composables/useAtlas'
import { MUSCLE_MAP } from '@/data/muscles'
import type { MuscleId } from '@/data/types'
import BodyModel from './components/BodyModel.vue'
import MuscleResults from './components/MuscleResults.vue'
import FilterBar from './components/FilterBar.vue'
import ExerciseList from './components/ExerciseList.vue'
import ExerciseDetail from './components/ExerciseDetail.vue'

const atlas = useAtlas()
const searchEl = ref<HTMLInputElement | null>(null)
const scrolled = ref(false)

const drawerOpen = computed(() => atlas.drawerOpen.value)
const QUICK_TAGS = ['卧推', '深蹲', '硬拉', '引体向上', '侧平举']

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 进动作库：有选中动作时滚到「筛选栏下方」那张卡片，否则回区块顶部 */
function goLibrary() {
  const id = atlas.selectedId.value
  const card = id ? document.querySelector<HTMLElement>(`.ex-card[data-id="${id}"]`) : null
  if (!card) {
    scrollTo('library')
    return
  }
  const bar =
    (document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0) +
    (document.querySelector('.filters')?.getBoundingClientRect().height ?? 0)
  window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - bar - 18, behavior: 'smooth' })
}

function pickTag(tag: string) {
  atlas.query.value = tag
  atlas.clearSelection()
  nextTick(() => scrollTo('library'))
}

function focusSearch() {
  scrollTo('model')
  nextTick(() => searchEl.value?.focus({ preventScroll: true }))
}

function closeDrawer() {
  atlas.closeDrawer()
}

/** 取消肌群筛选，收起模型旁的浮层 */
function clearMuscle() {
  atlas.muscleFilter.value = null
}

/** 关闭抽屉，把模型转回视野；动作保持选中，肌群高亮不丢 */
function viewInModel() {
  closeDrawer()
  nextTick(() => scrollTo('model'))
}

function onKey(e: KeyboardEvent) {
  const typing =
    document.activeElement === searchEl.value ||
    (document.activeElement as HTMLElement | null)?.tagName === 'INPUT'
  if (e.key === '/' && !typing) {
    e.preventDefault()
    focusSearch()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    focusSearch()
    return
  }
  if (e.key === 'Escape') {
    if (atlas.drawerOpen.value) atlas.closeDrawer()
    else if (atlas.selectedId.value) atlas.clearSelection()
    else if (atlas.query.value) atlas.query.value = ''
    else if (atlas.muscleFilter.value) clearMuscle()
    else searchEl.value?.blur()
  }
}

function onScroll() {
  scrolled.value = window.scrollY > 12
}

watch(atlas.query, () => {
  atlas.clearSelection()
})

watch(drawerOpen, (open) => {
  document.body.classList.toggle('is-locked', open)
})

// 切换动作时把抽屉内容滚回顶部
watch(atlas.selectedId, () => {
  nextTick(() => {
    requestAnimationFrame(() => {
      const body = document.querySelector('.drawer-body')
      if (body) body.scrollTop = 0
    })
  })
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  // 支持 ?ex=<动作 id> / ?q=<关键词> / ?eq=<器械 id> / ?m=<肌群 id> 直达
  const params = new URLSearchParams(location.search)
  const q = params.get('q')
  if (q) atlas.query.value = q
  const eq = params.get('eq')
  if (eq) atlas.equipment.value = eq as typeof atlas.equipment.value
  const m = params.get('m')
  if (m && MUSCLE_MAP.has(m as MuscleId)) atlas.muscleFilter.value = m as MuscleId
  const ex = params.get('ex')
  if (ex) nextTick(() => atlas.selectExercise(ex))
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScroll)
  document.body.classList.remove('is-locked')
})
</script>

<template>
  <div class="app">
    <header class="topbar" :class="{ 'is-scrolled': scrolled }">
      <a class="brand" href="#model" @click.prevent="scrollTo('model')">
        <span class="brand-mark">解</span>
        <span>
          <span class="brand-name">解剖图谱</span>
          <span class="brand-sub">Atlas of Strength</span>
        </span>
      </a>

      <nav class="topnav">
        <a href="#model" @click.prevent="scrollTo('model')">解剖模型</a>
        <a href="#library" @click.prevent="scrollTo('library')">动作库</a>
        <a href="#colophon" @click.prevent="scrollTo('colophon')">数据说明</a>
      </nav>

      <div class="topbar-tail">
        <span class="topbar-stat"><b>{{ atlas.totalExercises }}</b>动作</span>
        <span class="topbar-stat"><b>{{ atlas.totalMuscles }}</b>肌群</span>
        <span class="topbar-stat"><b>{{ atlas.totalEquipment }}</b>器械</span>
        <button class="topbar-search-hint" @click="focusSearch">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="7" cy="7" r="4.6" />
            <path d="M10.4 10.4 14 14" />
          </svg>
          搜索 <kbd>⌘K</kbd>
        </button>
      </div>
    </header>

    <!-- ─── HERO：人体肌群模型 ─── -->
    <section id="model" class="hero">
      <div class="hero-search-wrap">
        <div class="hero-search">
          <div class="hero-search-field">
            <span class="hero-search-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
                <circle cx="7" cy="7" r="4.6" />
                <path d="M10.4 10.4 14 14" />
              </svg>
            </span>
            <input
              ref="searchEl"
              v-model="atlas.query.value"
              class="hero-search-input"
              type="text"
              spellcheck="false"
              aria-label="搜索动作、器械或肌群"
              placeholder="搜索动作、器械、肌群 —— 试试「卧推」"
              @keydown.enter="goLibrary"
            />
            <span v-if="!atlas.query.value" class="hero-search-hint">/ 聚焦</span>
            <button v-else class="hero-search-clear" title="清除" @click="atlas.query.value = ''">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
                <path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" />
              </svg>
            </button>
          </div>

          <div v-if="atlas.hasFilters.value && !atlas.muscleFilter.value" class="hero-filter-note">
            <span>
              已筛选 <b>{{ atlas.results.value.length }}</b> 个动作
            </span>
            <button @click="goLibrary">查看结果 →</button>
          </div>
          <div v-else-if="!atlas.hasFilters.value" class="quick-tags">
            <button v-for="t in QUICK_TAGS" :key="t" class="quick-tag" @click="pickTag(t)">{{ t }}</button>
          </div>
        </div>
      </div>

      <BodyModel>
        <Transition name="dock">
          <MuscleResults
            v-if="atlas.muscleFilter.value"
            @close="clearMuscle"
            @open-library="goLibrary"
          />
        </Transition>
      </BodyModel>
    </section>

    <!-- ─── 动作库 ─── -->
    <section id="library" class="section">
      <div class="section-inner">
        <header v-reveal class="section-head">
          <div>
            <div class="section-kicker">Library / 动作库</div>
            <h2 class="section-title">按肌群检索动作</h2>
            <p class="section-lead">
              模型上选中的肌群会同步到下面的筛选条件。也可以直接按器械、肌群与难度过滤，再点开任意动作查看激活占比与示范。
            </p>
          </div>
          <div class="section-side">
            <div class="section-count">{{ atlas.results.value.length }}<small>/ {{ atlas.totalExercises }}</small></div>
            <div class="section-note">当前结果</div>
          </div>
        </header>

        <FilterBar />
        <ExerciseList />
      </div>
    </section>

    <footer id="colophon" class="colophon">
      <div class="colophon-inner">
        <div>
          <h3 class="colophon-title">解剖图谱 · ATLAS OF STRENGTH</h3>
          <p class="colophon-text">
            人体模型为 Écorché 解剖模型（
            <a href="https://github.com/mrdoob/three.js" target="_blank" rel="noreferrer">three.js</a>
            示例资源，CC BY-SA 4.0）。动作演示不再使用通用示范照片，而是按每个动作的关节角度关键帧
            实时绘制骨架示意：躯干角度、肢体折叠与器械位置都由动作本身决定，因此不会出现「腿弯举
            配深蹲图」这类错配。肌肉激活度为训练实践中的近似估计，仅供学习参考，不构成医疗或康复建议。
          </p>
        </div>
        <div class="colophon-tags">
          <span>Three.js</span>
          <span>Vue 3</span>
          <span>CC BY-SA 4.0</span>
        </div>
      </div>
    </footer>

    <!-- ─── 动作详情抽屉 ─── -->
    <Teleport to="body">
      <Transition name="scrim">
        <div v-if="drawerOpen" class="drawer-scrim" @click="closeDrawer"></div>
      </Transition>

      <Transition name="drawer">
        <aside
          v-if="drawerOpen"
          class="drawer"
          role="dialog"
          aria-modal="true"
          :aria-label="atlas.activeExercise.value?.zh ?? '动作详情'"
        >
          <div class="drawer-bar">
            <span class="drawer-kicker">动作详解</span>
            <button class="drawer-close" aria-label="关闭详情" @click="closeDrawer">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
                <path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" />
              </svg>
            </button>
          </div>

          <div class="drawer-body">
            <ExerciseDetail />
          </div>

          <div class="drawer-foot">
            <button class="model-btn" @click="viewInModel">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                <circle cx="8" cy="8" r="6.2" />
                <path d="M8 4.6v6.8M4.6 8h6.8" />
              </svg>
              在 3D 模型中查看
            </button>
          </div>
        </aside>
      </Transition>
    </Teleport>
  </div>
</template>
