<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTraining } from '@/composables/useTraining'
import { EXERCISES, EXERCISE_MAP } from '@/data/exercises'
import { EQUIPMENT_MAP } from '@/data/equipment'
import { parseReps, parseRpe } from '@/data/training-plan'
import type { Exercise } from '@/data/types'

const props = defineProps<{ sessionIndex: number }>()

const training = useTraining()

const query = ref('')
const open = ref(false)
const selectedId = ref<string | null>(null)
const saved = ref(false)

const form = ref({ sets: 3, reps: 10, weight: 0, rpe: 7 })

const selected = computed<Exercise | null>(() =>
  selectedId.value ? EXERCISE_MAP.get(selectedId.value) ?? null : null,
)

const options = computed<Exercise[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    const recent: Exercise[] = []
    const seen = new Set<string>()
    for (let i = training.logs.value.length - 1; i >= 0 && recent.length < 4; i--) {
      const id = training.logs.value[i].exerciseId
      if (seen.has(id)) continue
      seen.add(id)
      const ex = EXERCISE_MAP.get(id)
      if (ex) recent.push(ex)
    }
    return recent
  }
  return EXERCISES.filter(
    (ex) =>
      ex.zh.toLowerCase().includes(q) ||
      ex.en.toLowerCase().includes(q) ||
      ex.aliases.some((a) => a.toLowerCase().includes(q)),
  ).slice(0, 8)
})

function pick(ex: Exercise) {
  selectedId.value = ex.id
  query.value = ex.zh
  open.value = false
  saved.value = false
  const last = training.lastLogFor(ex.id)
  form.value = {
    sets: last?.sets ?? 3,
    reps: last?.reps ?? 10,
    weight: last?.weight ?? 0,
    rpe: last?.rpe ?? 7,
  }
}

function onInput() {
  selectedId.value = null
  saved.value = false
  open.value = true
}

/** 焦点离开搜索区域时收起候选列表，避免遮挡下方内容 */
function onBlur(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || !(event.currentTarget as HTMLElement).contains(next)) open.value = false
}

function submit() {
  if (!selected.value) return
  training.upsertLog({
    sessionIndex: props.sessionIndex,
    exerciseId: selected.value.id,
    sets: form.value.sets,
    reps: form.value.reps,
    weight: form.value.weight,
    rpe: form.value.rpe,
  })
  saved.value = true
  query.value = ''
  selectedId.value = null
}

function equipName(ex: Exercise) {
  return EQUIPMENT_MAP.get(ex.equipment)?.zh ?? ''
}

function usePlanValues() {
  const ex = selected.value
  if (!ex) return
  form.value = { sets: 3, reps: parseReps('10–12'), weight: training.lastLogFor(ex.id)?.weight ?? 0, rpe: parseRpe('RPE 7–8') }
}
</script>

<template>
  <section class="plan-card free-card">
    <header class="free-head">
      <div>
        <div class="plan-kicker">Ad-hoc · 自由打卡</div>
        <h3 class="free-title">记录本次训练额外完成的动作</h3>
      </div>
      <span v-if="saved" class="free-saved">已记入第 {{ sessionIndex }} 练</span>
    </header>

    <div class="free-search" @focusout="onBlur">
      <input
        v-model="query"
        type="search"
        name="exercise-query"
        placeholder="搜索动作 / 器械 / 肌群，例如「划船」「RDL」"
        aria-label="搜索要打卡的动作"
        @input="onInput"
        @focus="open = true"
      />
      <span class="free-search-hint">{{ selected ? '已选择' : '输入关键词' }}</span>

      <div v-if="open && options.length" class="free-options">
        <div class="free-options-title">{{ query.trim() ? '匹配动作' : '最近打卡' }}</div>
        <button
          v-for="ex in options"
          :key="ex.id"
          class="free-option"
          @mousedown.prevent="pick(ex)"
          @click="pick(ex)"
        >
          <span class="free-option-zh">{{ ex.zh }}</span>
          <span class="free-option-en">{{ ex.en }}</span>
          <span class="free-option-eq">{{ equipName(ex) }}</span>
        </button>
      </div>
      <div v-else-if="open && query.trim()" class="free-options">
        <div class="free-options-empty">没有匹配的动作，换个关键词试试</div>
      </div>
    </div>

    <div class="free-form">
      <label class="sx-field">
        <span>组</span>
        <input v-model.number="form.sets" type="number" inputmode="numeric" min="1" max="20" name="sets" />
      </label>
      <label class="sx-field">
        <span>次</span>
        <input v-model.number="form.reps" type="number" inputmode="numeric" min="1" max="100" name="reps" />
      </label>
      <label class="sx-field">
        <span>kg</span>
        <input v-model.number="form.weight" type="number" inputmode="decimal" min="0" step="0.5" name="weight" />
      </label>
      <label class="sx-field">
        <span>RPE</span>
        <input v-model.number="form.rpe" type="number" inputmode="decimal" min="4" max="10" step="0.5" name="rpe" />
      </label>
      <button class="free-submit" :disabled="!selected" @click="submit">
        {{ selected ? `打卡「${selected.zh}」` : '先选择动作' }}
      </button>
      <button v-if="selected" class="free-reset" title="按常见处方填充" @click="usePlanValues">默认 3×10</button>
    </div>

    <p class="free-note">
      自由打卡不需要跟随计划动作，记录会同样计入本次训练与肌肉热图；自重动作重量填 0 即可。
    </p>
  </section>
</template>
