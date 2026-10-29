<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { useAtlas } from '@/composables/useAtlas'
import { MUSCLE_MAP, ROLE_LABEL } from '@/data/muscles'
import { EQUIPMENT_MAP, LEVEL_LABEL } from '@/data/equipment'
import type { Exercise, MuscleHit } from '@/data/types'

const emit = defineEmits<{
  (e: 'open-library'): void
  (e: 'close'): void
}>()

const atlas = useAtlas()

const muscle = computed(() =>
  atlas.muscleFilter.value ? MUSCLE_MAP.get(atlas.muscleFilter.value) ?? null : null,
)

interface Row {
  ex: Exercise
  hit: MuscleHit
}

/** 该肌群参与的动作，按「对本肌群的激活度」降序——最先看到的就是最对症的动作 */
const rows = computed<Row[]>(() => {
  const id = atlas.muscleFilter.value
  if (!id) return []
  const out: Row[] = []
  for (const ex of atlas.results.value) {
    const hit = ex.muscles.find((h) => h.id === id)
    if (hit) out.push({ ex, hit })
  }
  return out.sort((a, b) => b.hit.activation - a.hit.activation || a.ex.level - b.ex.level)
})

function equipName(ex: Exercise) {
  return EQUIPMENT_MAP.get(ex.equipment)?.zh ?? ''
}

function hover(id: string | null) {
  atlas.hoveredId.value = id
}
</script>

<template>
  <aside v-if="muscle" class="muscle-dock" aria-label="该肌群的动作" @mouseleave="hover(null)">
    <header class="dock-head">
      <div class="dock-title">
        <span class="dock-zh">{{ muscle.zh }}</span>
        <span class="dock-en">{{ muscle.en }}</span>
      </div>
      <button class="dock-close" title="取消肌群筛选" aria-label="取消肌群筛选" @click="emit('close')">
        <X :size="11" />
      </button>
    </header>

    <div class="dock-meta">
      <span><b>{{ rows.length }}</b> 个动作</span>
      <span class="dock-sort">按激活度排序</span>
    </div>

    <div class="dock-list">
      <button
        v-for="(r, i) in rows"
        :key="r.ex.id"
        class="dock-row"
        :class="[r.hit.role, { 'is-active': atlas.selectedId.value === r.ex.id }]"
        :aria-current="atlas.selectedId.value === r.ex.id ? 'true' : undefined"
        @mouseenter="hover(r.ex.id)"
        @focus="hover(r.ex.id)"
        @click="atlas.selectExercise(r.ex.id)"
      >
        <span class="dock-rank">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="dock-info">
          <span class="dock-name">
            {{ r.ex.zh }}
            <em>{{ ROLE_LABEL[r.hit.role] }}</em>
          </span>
          <span class="dock-sub">{{ equipName(r.ex) }} · {{ LEVEL_LABEL[r.ex.level] }}</span>
        </span>
        <span class="dock-val">
          <b>{{ r.hit.activation }}</b>
          <i><span :style="{ width: r.hit.activation + '%' }"></span></i>
        </span>
      </button>

      <p v-if="!rows.length" class="dock-empty">
        当前筛选条件下没有该肌群的动作，试试放宽器械或难度。
      </p>
    </div>

    <footer class="dock-foot">
      <button class="dock-all" @click="emit('open-library')">在动作库中查看全部 →</button>
    </footer>
  </aside>
</template>
