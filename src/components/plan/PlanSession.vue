<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ArrowLeftRight } from '@lucide/vue'
import { useTraining } from '@/composables/useTraining'
import { parseReps, parseRpe, type PlanSession, type PlannedExercise } from '@/data/training-plan'
import { EXERCISE_MAP } from '@/data/exercises'
import { EQUIPMENT_MAP } from '@/data/equipment'

const props = defineProps<{
  session: PlanSession
}>()

const emit = defineEmits<{
  (e: 'open-exercise', id: string): void
  (e: 'swap', item: PlannedExercise): void
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

/** 每行上次初始化的动作 + 处方戳：换动作或换分期时只重置受影响的那几行 */
const seededStamps = reactive<Record<string, string>>({})

function rowStamp(item: PlannedExercise): string {
  const p = item.prescription
  return `${item.exerciseId}|${p.sets}|${p.reps}|${p.rpe}`
}

/** 新周期第一次练时，用上一周期末次重量做小幅渐进；下肢 +5kg，其他 +2.5kg */
const LOWER_MUSCLES = new Set([
  'quadriceps',
  'hamstrings',
  'gluteus-maximus',
  'gluteus-medius',
  'adductors',
  'gastrocnemius',
  'soleus',
])

const BODYWEIGHT_EQUIPMENT = new Set(['bodyweight', 'pullup-bar', 'dip-bar'])
const ASSISTED_EXERCISES = new Set(['assisted-pullup', 'assisted-chin-up'])

function weightIncrement(exerciseId: string): number {
  const ex = EXERCISE_MAP.get(exerciseId)
  if (!ex) return 2.5
  if (BODYWEIGHT_EQUIPMENT.has(ex.equipment)) return 0
  // 助力引体/反手引体的「重量」是辅助重量，进阶应该减少辅助
  if (ASSISTED_EXERCISES.has(exerciseId)) return -2.5
  return ex.muscles.some((hit) => hit.role === 'primary' && LOWER_MUSCLES.has(hit.id))
    ? 5
    : 2.5
}

function parseRepRange(reps: string): [number, number] {
  const nums = reps.match(/\d+/g)?.map(Number) ?? []
  if (!nums.length) return [8, 12]
  return [nums[0], nums[1] ?? nums[0]]
}

function parseRpeMax(rpe: string): number {
  const nums = rpe.match(/\d+/g)?.map(Number) ?? []
  return nums.length ? nums[nums.length - 1] : 8
}

/** 双进阶：达到次数上限且 RPE 不超标就加负荷；否则保持或回退 */
function nextLoadHint(item: PlannedExercise): string {
  const last = training.lastLogFor(item.exerciseId)
  if (!last) return ''
  const [minReps, maxReps] = parseRepRange(item.prescription.reps)
  const rpeMax = parseRpeMax(item.prescription.rpe)
  const bodyweight = BODYWEIGHT_EQUIPMENT.has(exerciseOf(item)?.equipment ?? '')
  const hitTop = last.reps >= maxReps && last.rpe <= rpeMax
  const tooHard = last.reps < minReps || last.rpe > rpeMax + 0.5

  if (bodyweight || last.weight <= 0) {
    if (hitTop) return '下次：加 1–2 次'
    if (tooHard) return '下次：降 1 档 / 减 1 次'
    return '下次：保持'
  }

  const increment = weightIncrement(item.exerciseId)
  if (hitTop) {
    if (ASSISTED_EXERCISES.has(item.exerciseId)) {
      return `下次：减辅助 ${Math.abs(increment)}kg`
    }
    return `下次：+${increment}kg（约 ${Math.round((last.weight + increment) * 2) / 2}kg）`
  }
  if (tooHard) {
    const target = Math.round(last.weight * 0.925 * 2) / 2
    return `下次：减 5–10%（约 ${target}kg）`
  }
  return `下次：保持 ${last.weight}kg`
}

function seedRow(item: PlannedExercise) {
  const saved = training.logFor(sessionIndex.value, item.exerciseId, item.slotKey)
  const last = training.lastLogFor(item.exerciseId)
  const lastWeight = last?.weight ?? 0
  const carriedWeight =
    !saved && last && last.cycle !== training.config.value.cycle && lastWeight > 0
      ? lastWeight + weightIncrement(item.exerciseId)
      : lastWeight
  forms[item.uid] = {
    sets: saved?.sets ?? item.prescription.sets,
    reps: saved?.reps ?? parseReps(item.prescription.reps),
    weight: saved?.weight ?? carriedWeight,
    rpe: saved?.rpe ?? parseRpe(item.prescription.rpe),
  }
  seededStamps[item.uid] = rowStamp(item)
}

function seed() {
  for (const item of day.value.exercises) {
    if (forms[item.uid] && seededStamps[item.uid] === rowStamp(item)) continue
    seedRow(item)
  }
  const alive = new Set(day.value.exercises.map((item) => item.uid))
  for (const uid of Object.keys(forms)) {
    if (alive.has(uid)) continue
    delete forms[uid]
    delete seededStamps[uid]
  }
}

watch(() => props.session, seed, { immediate: true })

const doneCount = computed(
  () =>
    day.value.exercises.filter(
      (item) => !!training.logFor(sessionIndex.value, item.exerciseId, item.slotKey),
    ).length,
)

const total = computed(() => day.value.exercises.length)

function savedFor(item: PlannedExercise) {
  return training.logFor(sessionIndex.value, item.exerciseId, item.slotKey)
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
    slotKey: item.slotKey,
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
        <em>{{ training.sessionDone(sessionIndex) ? '已完成' : '动作已打卡' }}</em>
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
              <span
                v-if="training.isSwapped(item.slotKey)"
                class="sx-swapped"
                title="已换成同肌群动作，点「换」可恢复默认"
              >
                已调整
              </span>
              <button
                v-if="item.role !== 'conditioning'"
                class="sx-swap"
                :title="`给「${item.label}」换一个动作`"
                :aria-label="`替换「${exerciseOf(item)?.zh ?? ''}」`"
                @click="emit('swap', item)"
              >
                <ArrowLeftRight :size="9" />
                换
              </button>
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
            <div v-if="nextLoadHint(item)" class="sx-next">{{ nextLoadHint(item) }}</div>
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

    <div class="session-cooldown">
      <span class="session-warmup-tag">冷身</span>
      {{ day.cooldown }}
    </div>

    <footer class="session-foot">
      <span class="session-tip">{{ day.exercises[0]?.note }}</span>
      <button class="session-all" :disabled="doneCount === total" @click="logAll">
        {{ doneCount === total ? '本日已全部打卡' : '全部按计划打卡' }}
      </button>
    </footer>
  </article>
</template>
