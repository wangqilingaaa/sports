<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTraining } from '@/composables/useTraining'
import {
  GOAL_MILESTONE_STEP,
  formatDate,
  type GoalProgress,
  type PrLift,
} from '@/composables/useTrainingStats'

const props = defineProps<{
  goals: GoalProgress[]
  prs: PrLift[]
}>()

const training = useTraining()

interface GoalOption {
  id: string
  zh: string
  best: number
  compound: boolean
}

const options = computed<GoalOption[]>(() => {
  const map = new Map<string, GoalOption>()
  for (const pr of props.prs) {
    map.set(pr.id, { id: pr.id, zh: pr.zh, best: pr.bestE1rm.value, compound: pr.compound })
  }
  for (const goal of props.goals) {
    if (map.has(goal.id)) continue
    map.set(goal.id, { id: goal.id, zh: goal.zh, best: goal.best, compound: false })
  }
  return [...map.values()].sort(
    (a, b) => Number(b.compound) - Number(a.compound) || b.best - a.best,
  )
})

const editing = ref(false)
const draftExercise = ref('')
const draftTarget = ref<number | null>(null)

const editingExisting = computed(() =>
  props.goals.some((goal) => goal.id === draftExercise.value),
)

function formatKg(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function suggestionFor(id: string): number {
  const best = options.value.find((option) => option.id === id)?.best ?? 0
  const suggested = Math.ceil((best + 0.01) / GOAL_MILESTONE_STEP) * GOAL_MILESTONE_STEP
  return Math.max(GOAL_MILESTONE_STEP, suggested)
}

function syncSuggestion() {
  draftTarget.value = draftExercise.value ? suggestionFor(draftExercise.value) : null
}

function openCreate() {
  editing.value = true
  draftExercise.value = options.value[0]?.id ?? ''
  syncSuggestion()
}

function openEdit(goal: GoalProgress) {
  editing.value = true
  draftExercise.value = goal.id
  draftTarget.value = goal.target
}

function closeEditor() {
  editing.value = false
}

const canSave = computed(() => {
  const target = draftTarget.value
  return (
    !!draftExercise.value &&
    typeof target === 'number' &&
    Number.isFinite(target) &&
    target >= 1
  )
})

function save() {
  if (!canSave.value || draftTarget.value === null) return
  training.setLiftGoal(draftExercise.value, draftTarget.value)
  editing.value = false
}

function clear(goal: GoalProgress) {
  training.clearLiftGoal(goal.id)
  if (editing.value && draftExercise.value === goal.id) editing.value = false
}
</script>

<template>
  <div class="stats-goals">
    <div v-if="editing" class="goal-editor">
      <div class="goal-editor-head">
        <span class="goal-editor-title">{{ editingExisting ? '调整主项目标' : '设置主项目标' }}</span>
        <button @click="closeEditor">取消</button>
      </div>

      <div class="goal-editor-fields">
        <label class="goal-field">
          <span>动作</span>
          <select
            id="goal-exercise"
            v-model="draftExercise"
            class="stats-select"
            @change="syncSuggestion"
          >
            <option v-for="option in options" :key="option.id" :value="option.id">
              {{ option.zh }} · 最佳 {{ formatKg(option.best) }} kg
            </option>
          </select>
        </label>

        <label class="goal-field">
          <span>目标 e1RM</span>
          <span class="goal-input-wrap">
            <input
              id="goal-target"
              v-model.number="draftTarget"
              class="goal-input"
              type="number"
              min="1"
              max="1000"
              step="0.5"
            />
            <em>kg</em>
          </span>
        </label>

        <button class="goal-save" :disabled="!canSave" @click="save">保存目标</button>
      </div>

      <p class="goal-hint">
        目标按 e1RM 计算；建议值取当前最佳之上的下一个 {{ GOAL_MILESTONE_STEP }} kg 里程碑。
      </p>
    </div>

    <template v-else>
      <div v-if="goals.length" class="goal-toolbar">
        <span class="goal-note">按历史最佳 e1RM 跟踪；与上方时间范围无关。</span>
        <button
          class="goal-add"
          :disabled="!options.length"
          title="给一个有负重记录的动作设置目标"
          @click="openCreate"
        >
          + 添加目标
        </button>
      </div>

      <div v-if="!goals.length" class="goal-empty">
        <p>
          给主项设一个 e1RM 目标，统计页会跟踪进度、首次达成日期和每
          {{ GOAL_MILESTONE_STEP }} kg 里程碑。
        </p>
        <button class="stats-empty-link" :disabled="!options.length" @click="openCreate">
          设主项目标
        </button>
        <p v-if="!options.length" class="goal-none">还没有负重记录，先在计划页完成一次打卡。</p>
      </div>

      <div v-else class="goals-grid">
        <article
          v-for="goal in goals"
          :key="goal.id"
          class="goal-item"
          :class="{ 'is-done': goal.achievedAt !== null }"
        >
          <div class="goal-top">
            <div>
              <div class="goal-name">{{ goal.zh }}</div>
              <div class="goal-sub">
                当前 {{ formatKg(goal.best) }} kg · 目标 {{ formatKg(goal.target) }} kg
              </div>
            </div>
            <div class="goal-actions">
              <button @click="openEdit(goal)">调整</button>
              <button class="is-danger" @click="clear(goal)">清除</button>
            </div>
          </div>

          <div class="goal-progress">
            <span class="goal-progress-fill" :style="{ width: `${goal.progress}%` }"></span>
            <span v-for="tick in [25, 50, 75]" :key="tick" class="goal-tick" :style="{ left: `${tick}%` }"></span>
          </div>

          <div class="goal-meta">
            <span class="goal-pct">{{ goal.progress }}%</span>
            <span v-if="goal.achievedAt" class="goal-done">
              已达成 · {{ formatDate(goal.achievedAt) }} 首次达到
            </span>
            <span v-else>还差 {{ formatKg(goal.remaining) }} kg</span>
            <span v-if="goal.nextMilestone !== null" class="goal-next">
              下一里程碑 {{ formatKg(goal.nextMilestone) }} kg
            </span>
          </div>

          <div v-if="goal.milestones.length" class="goal-milestones">
            <span class="goal-milestones-label">里程碑</span>
            <span
              v-for="milestone in goal.milestones"
              :key="`${milestone.value}-${milestone.at}`"
              class="goal-chip"
              :title="`${milestone.weight} kg × ${milestone.reps} · ${formatDate(milestone.at)}`"
            >
              {{ formatKg(milestone.value) }} kg <em>{{ formatDate(milestone.at) }}</em>
            </span>
          </div>
          <p v-else class="goal-none">还没有里程碑记录，继续训练刷新 e1RM。</p>
        </article>
      </div>
    </template>
  </div>
</template>
