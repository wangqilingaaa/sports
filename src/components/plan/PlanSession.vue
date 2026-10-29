<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useTraining } from '@/composables/useTraining'
import { parseReps, parseRpe, type PlanSession, type PlannedExercise } from '@/data/training-plan'
import { EXERCISE_MAP } from '@/data/exercises'
import { EQUIPMENT_MAP } from '@/data/equipment'

const props = defineProps<{
  session: PlanSession
}>()

const emit = defineEmits<{
  (e: 'open-exercise', id: string): void
}>()

const training = useTraining()

const day = computed(() => props.session.day)
const sessionIndex = computed(() => props.session.index)

interface RowForm {
  sets: number
  reps: number
  weight: number
  rpe: number
}

const forms = reactive<Record<string, RowForm>>({})

function seed() {
  for (const key of Object.keys(forms)) delete forms[key]
  for (const item of day.value.exercises) {
    const saved = training.logFor(sessionIndex.value, item.exerciseId)
    const last = training.lastLogFor(item.exerciseId)
    forms[item.uid] = {
      sets: saved?.sets ?? item.prescription.sets,
      reps: saved?.reps ?? parseReps(item.prescription.reps),
      weight: saved?.weight ?? last?.weight ?? 0,
      rpe: saved?.rpe ?? parseRpe(item.prescription.rpe),
    }
  }
}

watch(() => props.session, seed, { immediate: true })

const doneCount = computed(
  () =>
    day.value.exercises.filter(
      (item) => !!training.logFor(sessionIndex.value, item.exerciseId),
    ).length,
)

const total = computed(() => day.value.exercises.length)

function savedFor(item: PlannedExercise) {
  return training.logFor(sessionIndex.value, item.exerciseId)
}

function exerciseOf(item: PlannedExercise) {
  return EXERCISE_MAP.get(item.exerciseId)
}

function equipOf(item: PlannedExercise) {
  const ex = exerciseOf(item)
  return ex ? EQUIPMENT_MAP.get(ex.equipment)?.zh ?? '' : ''
}

function logRow(item: PlannedExercise) {
  const form = forms[item.uid]
  if (!form) return
  training.upsertLog({
    sessionIndex: sessionIndex.value,
    sessionKey: day.value.key,
    exerciseId: item.exerciseId,
    sets: form.sets,
    reps: form.reps,
    weight: form.weight,
    rpe: form.rpe,
  })
}

function removeRow(item: PlannedExercise) {
  const saved = savedFor(item)
  if (saved) training.removeLog(saved.id)
}

function logAll() {
  for (const item of day.value.exercises) {
    if (!savedFor(item)) logRow(item)
  }
}

function roleLabel(role: PlannedExercise['role']): string {
  return (
    {
      main: '主项',
      secondary: '次项',
      accessory: '孤立',
      core: '核心',
      conditioning: '代谢',
    } as const
  )[role]
}
</script>

<template>
  <article class="plan-card session-card">
    <header class="session-head">
      <div class="session-head-main">
        <div class="session-kicker">{{ day.en }} · 第 {{ session.index }} 练</div>
        <h3 class="session-title">{{ day.title }}</h3>
        <p class="session-focus">{{ day.focus }}</p>
      </div>
      <div class="session-progress">
        <b>{{ doneCount }}</b><span>/ {{ total }}</span>
        <em>{{ doneCount === total ? '已完成' : '动作已打卡' }}</em>
      </div>
    </header>

    <div class="session-warmup">
      <span class="session-warmup-tag">热身</span>
      {{ day.warmup }}
    </div>

    <div class="session-list">
      <div v-for="(item, i) in day.exercises" :key="item.uid" class="sx-row" :class="`is-${item.role}`">
        <div class="sx-main">
          <span class="sx-index">{{ String(i + 1).padStart(2, '0') }}</span>
          <div class="sx-info">
            <div class="sx-name-row">
              <button class="sx-name" :title="`查看「${exerciseOf(item)?.zh ?? ''}」动作详情`" @click="emit('open-exercise', item.exerciseId)">
                {{ exerciseOf(item)?.zh ?? item.exerciseId }}
                <span class="sx-open">详情 →</span>
              </button>
              <span class="sx-role">{{ roleLabel(item.role) }}</span>
            </div>
            <div class="sx-sub">
              {{ item.label }}
              <i>·</i>
              {{ equipOf(item) }}
              <i>·</i>
              {{ exerciseOf(item)?.en }}
            </div>
            <div class="sx-scheme">
              <span><b>{{ item.prescription.sets }}</b> 组 × {{ item.prescription.reps }}</span>
              <span>{{ item.prescription.rpe }}</span>
              <span>休息 {{ item.prescription.rest }}s</span>
              <span class="sx-load">{{ item.prescription.load }}</span>
            </div>
          </div>
        </div>

        <div v-if="savedFor(item)" class="sx-done">
          <span class="sx-done-mark">已打卡</span>
          <span class="sx-done-data">
            {{ savedFor(item)?.sets }} × {{ savedFor(item)?.reps }}
            <template v-if="savedFor(item)?.weight">· {{ savedFor(item)?.weight }}kg</template>
            · RPE {{ savedFor(item)?.rpe }}
          </span>
          <button class="sx-undo" title="撤销这条打卡" @click="removeRow(item)">撤销</button>
        </div>

        <div v-else class="sx-form">
          <label class="sx-field">
            <span>组</span>
            <input
              v-model.number="forms[item.uid].sets"
              type="number"
              inputmode="numeric"
              min="1"
              max="12"
              name="sets"
            />
          </label>
          <label class="sx-field">
            <span>次</span>
            <input
              v-model.number="forms[item.uid].reps"
              type="number"
              inputmode="numeric"
              min="1"
              max="60"
              name="reps"
            />
          </label>
          <label class="sx-field">
            <span>kg</span>
            <input
              v-model.number="forms[item.uid].weight"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.5"
              name="weight"
            />
          </label>
          <label class="sx-field">
            <span>RPE</span>
            <input
              v-model.number="forms[item.uid].rpe"
              type="number"
              inputmode="decimal"
              min="4"
              max="10"
              step="0.5"
              name="rpe"
            />
          </label>
          <button class="sx-log" @click="logRow(item)">打卡</button>
        </div>
      </div>
    </div>

    <footer class="session-foot">
      <span class="session-tip">{{ day.exercises[0]?.note }}</span>
      <button class="session-all" :disabled="doneCount === total" @click="logAll">
        {{ doneCount === total ? '本日已全部打卡' : '全部按计划打卡' }}
      </button>
    </footer>
  </article>
</template>
