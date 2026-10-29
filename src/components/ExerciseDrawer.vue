<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { CirclePlus, X } from '@lucide/vue'
import { EXERCISE_MAP } from '@/data/exercises'
import type { MuscleId } from '@/data/types'
import ExerciseDetail from '@/components/ExerciseDetail.vue'

const props = defineProps<{
  open: boolean
  exerciseId: string | null
  /** 详情内上一项/下一项的浏览序列，由调用页决定：动作库结果 / 当天计划动作 */
  scopeIds?: string[]
  /** 动作库语境：点肌群可筛选；计划页的详情只读 */
  library?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', id: string): void
  (e: 'filter-muscle', id: MuscleId): void
  (e: 'view-in-model'): void
}>()

const exercise = computed(() =>
  props.exerciseId ? EXERCISE_MAP.get(props.exerciseId) ?? null : null,
)

const bodyRef = ref<HTMLElement | null>(null)

watch(
  () => props.open,
  (open) => document.body.classList.toggle('is-locked', open),
  { immediate: true },
)

// 切换动作时把抽屉内容滚回顶部，上一项/下一项不至于停在半截
watch(
  () => props.exerciseId,
  () => {
    void nextTick(() => {
      if (bodyRef.value) bodyRef.value.scrollTop = 0
    })
  },
)

onBeforeUnmount(() => document.body.classList.remove('is-locked'))
</script>

<template>
  <Teleport to="body">
    <Transition name="scrim">
      <div v-if="open" class="drawer-scrim" @click="emit('close')"></div>
    </Transition>

    <Transition name="drawer">
      <aside
        v-if="open"
        class="drawer"
        role="dialog"
        aria-modal="true"
        :aria-label="exercise?.zh ?? '动作详情'"
      >
        <div class="drawer-bar">
          <span class="drawer-kicker">动作详解</span>
          <button class="drawer-close" aria-label="关闭详情" @click="emit('close')">
            <X :size="13" />
          </button>
        </div>

        <div ref="bodyRef" class="drawer-body">
          <ExerciseDetail
            v-if="exerciseId"
            :exercise-id="exerciseId"
            :scope-ids="scopeIds"
            :muscle-filterable="library"
            @select="emit('select', $event)"
            @filter-muscle="emit('filter-muscle', $event)"
          />
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
