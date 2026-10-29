<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAtlas } from '@/composables/useAtlas'
import { useAtlasQuerySync } from '@/composables/useAtlasQuerySync'
import AppFooter from '@/components/AppFooter.vue'
import BodyModel from '@/components/BodyModel.vue'
import ExerciseDrawer from '@/components/ExerciseDrawer.vue'
import ExerciseList from '@/components/ExerciseList.vue'
import FilterBar from '@/components/FilterBar.vue'
import HeroSearch from '@/components/HeroSearch.vue'
import MuscleResults from '@/components/MuscleResults.vue'

const atlas = useAtlas()
const heroSearch = ref<{ focus: () => void; blur: () => void } | null>(null)
const drawerOpen = computed(() => atlas.drawerOpen.value)

useAtlasQuerySync()

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

function focusSearch() {
  scrollTo('model')
  nextTick(() => heroSearch.value?.focus())
}

/** 取消肌群筛选，收起模型旁的浮层 */
function clearMuscle() {
  atlas.muscleFilter.value = null
}

/** 关闭抽屉，把模型转回视野；动作保持选中，肌群高亮不丢 */
function viewInModel() {
  atlas.closeDrawer()
  nextTick(() => scrollTo('model'))
}

function onKey(e: KeyboardEvent) {
  const typing = (document.activeElement as HTMLElement | null)?.tagName === 'INPUT'
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
    else heroSearch.value?.blur()
  }
}

watch(atlas.query, () => {
  atlas.clearSelection()
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.classList.remove('is-locked')
  // 离开动作库时收起抽屉，返回时不会盖住页面
  atlas.closeDrawer()
})
</script>

<template>
  <!-- ─── HERO：人体肌群模型 ─── -->
  <section id="model" class="hero">
    <HeroSearch ref="heroSearch" @search="goLibrary" />

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

  <AppFooter />

  <ExerciseDrawer
    :open="drawerOpen"
    :exercise-id="atlas.selectedId.value"
    :scope-ids="atlas.results.value.map((item) => item.id)"
    library
    @close="atlas.closeDrawer()"
    @select="atlas.selectExercise"
    @filter-muscle="atlas.toggleMuscle"
    @view-in-model="viewInModel"
  />
</template>
