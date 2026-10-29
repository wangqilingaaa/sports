<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ChartColumn } from '@lucide/vue'
import { useAtlas } from '@/composables/useAtlas'

const atlas = useAtlas()
const route = useRoute()
const router = useRouter()

const scrolled = ref(false)
const isPlan = computed(() => route.name === 'plan')

function onScroll() {
  scrolled.value = window.scrollY > 12
}

/** 已在动作库时同页锚点不会触发路由滚动，改为就地平滑定位 */
function goSection(section: 'model' | 'library', event: Event) {
  if (route.name !== 'atlas') return
  event.preventDefault()
  const hash = `#${section}`
  if (route.hash === hash) {
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  void router.replace({ name: 'atlas', hash })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <header class="topbar" :class="{ 'is-scrolled': scrolled }">
    <RouterLink class="brand" :to="{ name: 'atlas', hash: '#model' }" @click="goSection('model', $event)">
      <span class="brand-mark">形</span>
      <span>
        <span class="brand-name">形骸</span>
        <span class="brand-sub">Atlas of Strength</span>
      </span>
    </RouterLink>

    <nav class="topnav">
      <RouterLink :to="{ name: 'atlas', hash: '#model' }" @click="goSection('model', $event)">肌骨模型</RouterLink>
      <RouterLink :to="{ name: 'atlas', hash: '#library' }" @click="goSection('library', $event)">动作库</RouterLink>
    </nav>

    <div class="topbar-tail">
      <span class="topbar-stat"><b>{{ atlas.totalExercises }}</b>动作</span>
      <span class="topbar-stat"><b>{{ atlas.totalMuscles }}</b>肌群</span>
      <span class="topbar-stat"><b>{{ atlas.totalEquipment }}</b>器械</span>
      <RouterLink
        class="plan-switch"
        :to="isPlan ? { name: 'atlas', hash: '#model' } : { name: 'plan' }"
      >
        <ChartColumn :size="13" :stroke-width="2" />
        {{ isPlan ? '动作库' : '训练计划' }}
      </RouterLink>
    </div>
  </header>
</template>
