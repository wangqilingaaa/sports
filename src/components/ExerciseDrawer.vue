<script setup lang="ts">
import { computed } from 'vue'
import { CirclePlus, X } from '@lucide/vue'
import { useAtlas } from '@/composables/useAtlas'
import ExerciseDetail from '@/components/ExerciseDetail.vue'

const emit = defineEmits<{ (e: 'view-in-model'): void }>()

const atlas = useAtlas()
const drawerOpen = computed(() => atlas.drawerOpen.value)
</script>

<template>
  <Teleport to="body">
    <Transition name="scrim">
      <div v-if="drawerOpen" class="drawer-scrim" @click="atlas.closeDrawer()"></div>
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
          <button class="drawer-close" aria-label="关闭详情" @click="atlas.closeDrawer()">
            <X :size="13" />
          </button>
        </div>

        <div class="drawer-body">
          <ExerciseDetail />
        </div>

        <div class="drawer-foot">
          <button class="model-btn" @click="emit('view-in-model')">
            <CirclePlus :size="13" />
            在 3D 模型中查看
          </button>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
