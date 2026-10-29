<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Check, X } from '@lucide/vue'
import { useTraining } from '@/composables/useTraining'
import {
  GOALS,
  HEAT_TIERS,
  PHASES,
  SPLITS,
  heatTier,
  type GoalId,
  type Level,
  type Phase,
  type PlanDay,
  type SplitId,
} from '@/data/training-plan'
import { MUSCLE_MAP } from '@/data/muscles'
import { LEVEL_LABEL } from '@/data/equipment'
import { EXERCISE_MAP } from '@/data/exercises'
import PlanSession from '@/components/plan/PlanSession.vue'
import PlanVolumeAudit from '@/components/plan/PlanVolumeAudit.vue'
import FreeCheckin from '@/components/plan/FreeCheckin.vue'
import MuscleHeatMap from '@/components/plan/MuscleHeatMap.vue'
import ExerciseDrawer from '@/components/ExerciseDrawer.vue'

const router = useRouter()
const training = useTraining()

const LEVELS: Level[] = [1, 2, 3]

const phase = computed(() => training.activeSession.value.phase)
const goal = computed(() => GOALS.find((g) => g.id === training.config.value.goal) ?? GOALS[0])
const split = computed(() => training.activeSplit.value)
const activeDay = computed(() => training.activeDay.value)
const activeLogs = computed(() => training.logsForSession(training.selectedIndex.value))
const totalSessions = computed(() => training.totalSessions.value)

/** 当前打开详情的动作；空表示抽屉关闭 */
const detailId = ref<string | null>(null)

/** 详情里上一项/下一项只在该训练日内走动，不把用户带到动作库的浏览序列里 */
const dayExerciseIds = computed(() => [
  ...new Set(activeDay.value.exercises.map((item) => item.exerciseId)),
])

const totalExercises = computed(() => activeDay.value.exercises.length)
const doneExercises = computed(
  () =>
    activeDay.value.exercises.filter(
      (item) => !!training.logFor(training.selectedIndex.value, item.exerciseId),
    ).length,
)
const completionPct = computed(() =>
  Math.min(100, Math.round((doneExercises.value / Math.max(1, totalExercises.value)) * 100)),
)

const topMuscles = computed(() => training.heatDetail.value.slice(0, 6))

function phaseStart(p: Phase): number {
  return (p.rounds[0] - 1) * split.value.days + 1
}

function phaseEnd(p: Phase): number {
  return p.rounds[1] * split.value.days
}

function phaseState(p: Phase): 'done' | 'current' | 'upcoming' {
  const idx = training.selectedIndex.value
  if (idx > phaseEnd(p)) return 'done'
  if (idx >= phaseStart(p)) return 'current'
  return 'upcoming'
}

function phaseProgress(p: Phase): string {
  const start = phaseStart(p)
  const end = phaseEnd(p)
  const idx = training.selectedIndex.value
  if (idx > end) return '100%'
  if (idx < start) return '0%'
  return `${((idx - start + 1) / (end - start + 1)) * 100}%`
}

function setGoal(id: GoalId) {
  if (training.config.value.goal === id) return
  training.setConfig({ goal: id })
}

function setLevel(level: Level) {
  training.setConfig({ level })
}

function setSplit(id: SplitId) {
  if (training.config.value.split === id) return
  training.setConfig({ split: id })
  training.syncNext()
}

function selectPhase(p: Phase) {
  training.selectedIndex.value = phaseStart(p)
}

function selectSession(index: number) {
  training.selectedIndex.value = index
}

/** 训练序列里用的肌群简称，让卡片一行装得下 */
const MUSCLE_SHORT: Record<string, string> = {
  胸大肌: '胸',
  胸大肌锁骨部: '上胸',
  三角肌: '肩',
  三角肌前束: '肩前',
  三角肌中束: '肩中',
  三角肌后束: '后束',
  肱三头肌: '三头',
  肱二头肌: '二头',
  背阔肌: '背',
  斜方肌: '斜方',
  菱形肌: '菱形',
  股四头肌: '股四头',
  臀大肌: '臀',
  腘绳肌: '腘绳',
  内收肌: '内收',
  背部: '背',
  肩部: '肩',
}

function shortMuscle(name: string): string {
  return MUSCLE_SHORT[name] ?? name.replace(/肌$/, '')
}

function dayFocus(day: PlanDay): string {
  return day.focus
    .split(' · ')
    .slice(0, 3)
    .map(shortMuscle)
    .join(' · ')
}

const stripRef = ref<HTMLElement | null>(null)

function scrollActiveIntoView() {
  const el = stripRef.value?.querySelector<HTMLElement>('.session-chip.is-active')
  el?.scrollIntoView({ block: 'nearest', inline: 'center' })
}

watch(() => training.selectedIndex.value, () => void nextTick(scrollActiveIntoView))

function goNext() {
  training.syncNext()
  void nextTick(scrollActiveIntoView)
}

function exerciseName(id: string): string {
  return EXERCISE_MAP.get(id)?.zh ?? id
}

function heatRangeButton(range: 'session' | 'recent' | 'all') {
  training.heatRange.value = range
}

function muscleLoadLabel(sets: number): string {
  return sets.toFixed(1)
}

function volumeLabel(volume: number): string {
  if (!volume) return '自重'
  return volume >= 1000 ? `${(volume / 1000).toFixed(1)} t` : `${Math.round(volume)} kg`
}

/** 返回动作库顶部 */
function backToAtlas() {
  void router.push({ name: 'atlas', hash: '#model' })
}

/** 在计划页就地展开动作详情，不把用户甩回动作库首页 */
function openExercise(id: string) {
  detailId.value = id
}

/** 详情里主动选择「在 3D 模型中查看」时才离开计划页 */
function viewExerciseInModel() {
  const id = detailId.value
  if (!id) return
  detailId.value = null
  void router.push({ name: 'atlas', query: { ex: id }, hash: '#model' })
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (detailId.value) {
    detailId.value = null
    return
  }
  backToAtlas()
}

onMounted(() => {
  training.syncNext()
  void nextTick(scrollActiveIntoView)
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <section class="plan-page">
    <div class="plan-wrap">
      <!-- ─── 页头 ─── -->
      <header class="plan-head">
        <div class="plan-head-side">
          <button class="plan-back" @click="backToAtlas"><ArrowLeft :size="12" />返回动作库</button>
          <div class="plan-now">
            <b>第 {{ training.selectedIndex.value }} 练</b>
            <span>{{ phase.name }} · {{ split.zh }} · {{ phase.rpe }} · 共 {{ totalSessions }} 练</span>
          </div>
        </div>
      </header>

      <!-- ─── 目标 / 水平 / 分化 ─── -->
      <div class="plan-controls">
        <div class="control-row">
          <span class="control-key">目标</span>
          <div class="control-chips">
            <button
              v-for="g in GOALS"
              :key="g.id"
              class="pchip"
              :class="{ 'is-active': training.config.value.goal === g.id }"
              :title="g.desc"
              @click="setGoal(g.id)"
            >
              <b>{{ g.zh }}</b>
              <em>{{ g.badge }}</em>
            </button>
          </div>
        </div>
        <div class="control-row">
          <span class="control-key">水平</span>
          <div class="control-chips">
            <button
              v-for="level in LEVELS"
              :key="level"
              class="pchip is-compact"
              :class="{ 'is-active': training.config.value.level === level }"
              @click="setLevel(level)"
            >
              <b>{{ LEVEL_LABEL[level] }}</b>
            </button>
          </div>
          <span class="control-key is-second">分化</span>
          <div class="control-chips">
            <button
              v-for="s in SPLITS"
              :key="s.id"
              class="pchip is-compact"
              :class="{ 'is-active': training.config.value.split === s.id }"
              :title="`${s.desc} 适合${s.levelHint}。`"
              @click="setSplit(s.id)"
            >
              <b>{{ s.zh }}</b>
              <em>{{ s.days }} 练</em>
            </button>
          </div>
          <span class="control-summary">
            {{ split.zh }} · {{ split.days }} 练/循环 · 共 {{ totalSessions }} 练
          </span>
          <button class="plan-link" :disabled="training.allDone.value" @click="goNext">
            {{ training.allDone.value ? '全部训练已完成' : '跳到下一次训练' }}
          </button>
        </div>
        <p class="split-note">{{ split.desc }} 适合{{ split.levelHint }}。</p>
      </div>

      <div class="plan-grid">
        <!-- ─── 主列 ─── -->
        <main class="plan-main">
          <!-- 分期时间轴 -->
          <div class="phase-rail">
            <button
              v-for="(p, i) in PHASES"
              :key="p.id"
              class="phase-card"
              :class="`is-${phaseState(p)}`"
              :data-phase="p.id"
              @click="selectPhase(p)"
            >
              <span class="phase-index">0{{ i + 1 }}</span>
              <span class="phase-name">{{ p.name }}</span>
              <span class="phase-weeks">
                第 {{ phaseStart(p) }}–{{ phaseEnd(p) }} 练 ·
                {{ p.rounds[1] - p.rounds[0] + 1 }} 轮 · {{ p.volume }}
              </span>
              <span class="phase-bar">
                <i :style="{ width: phaseProgress(p) }"></i>
              </span>
            </button>
          </div>

          <!-- 当前分期提示：一行说完分期、意图与容量/RPE，超长截断 -->
          <div class="phase-banner" :data-phase="phase.id">
            <span class="phase-banner-kicker">{{ phase.en }}</span>
            <p class="phase-banner-text" :title="phase.intent">{{ phase.intent }}</p>
            <span class="phase-banner-meta">{{ phase.volume }} · {{ phase.rpe }}</span>
          </div>

          <!-- 训练序列：按完成次数推进，不绑定日期 -->
          <div ref="stripRef" class="session-strip" aria-label="选择训练">
            <button
              v-for="s in training.plan.value"
              :key="s.index"
              class="session-chip"
              :class="{
                'is-active': training.selectedIndex.value === s.index,
                'is-done': training.sessionDone(s.index),
                'is-next': !training.sessionDone(s.index) && s.index === training.nextIndex.value,
              }"
              :data-phase="s.phase.id"
              :title="`第 ${s.index} 练 · ${s.day.title} · ${s.day.focus}`"
              @click="selectSession(s.index)"
            >
              <span class="session-chip-top">
                <span class="session-chip-no">{{ String(s.index).padStart(2, '0') }}</span>
                <span
                  class="session-chip-state"
                  :class="{
                    'is-done': training.sessionDone(s.index),
                    'is-next': !training.sessionDone(s.index) && s.index === training.nextIndex.value,
                  }"
                >
                  <Check
                    v-if="training.sessionDone(s.index)"
                    class="session-chip-check"
                    :size="9"
                    :stroke-width="2.6"
                  />
                  {{
                    training.sessionDone(s.index)
                      ? '已练'
                      : s.index === training.nextIndex.value
                        ? '下次'
                        : '待练'
                  }}
                </span>
              </span>
              <span class="session-chip-name">{{ s.day.title }}</span>
              <span class="session-chip-muscles">{{ dayFocus(s.day) }}</span>
            </button>
          </div>

          <div class="session-note">{{ training.activeSession.value.note }}</div>

          <!-- 当前训练与打卡 -->
          <PlanSession
            :session="training.activeSession.value"
            @open-exercise="openExercise"
          />

          <!-- 本次记录 -->
          <section class="plan-card log-card">
            <header class="plan-card-head">
              <div>
                <div class="plan-kicker">Log · 本次记录</div>
                <h3 class="plan-card-title">
                  第 {{ training.selectedIndex.value }} 练已打卡 {{ activeLogs.length }} 条
                </h3>
              </div>
              <span class="log-total">
                {{ activeLogs.reduce((s, l) => s + l.sets, 0) }} 组
              </span>
            </header>

            <div v-if="!activeLogs.length" class="log-empty">
              这一次训练还没有记录。按计划动作打卡，或用下面的「自由打卡」补上临时增加的动作。
            </div>
            <div v-else class="log-list">
              <div v-for="l in activeLogs" :key="l.id" class="log-item">
                <span class="log-name">{{ exerciseName(l.exerciseId) }}</span>
                <span class="log-data">
                  {{ l.sets }} × {{ l.reps }}
                  <template v-if="l.weight"> · {{ l.weight }} kg</template>
                  · RPE {{ l.rpe }}
                </span>
                <span class="log-tag" :class="{ 'is-plan': !!l.sessionKey }">
                  {{ l.sessionKey ? '计划' : '自由' }}
                </span>
                <button class="log-del" title="删除这条记录" @click="training.removeLog(l.id)">
                  <X :size="12" />
                </button>
              </div>
            </div>
          </section>

          <!-- 自由打卡 -->
          <FreeCheckin :session-index="training.selectedIndex.value" />
        </main>

        <!-- ─── 侧列 ─── -->
        <aside class="plan-side">
          <!-- 3D 热图 -->
          <section class="plan-card heat-card">
            <header class="plan-card-head">
              <div>
                <div class="plan-kicker">Heat map · 3D 肌肉热图</div>
                <h3 class="plan-card-title">练到了哪里</h3>
              </div>
              <div class="heat-range">
                <button
                  :class="{ 'is-active': training.heatRange.value === 'session' }"
                  @click="heatRangeButton('session')"
                >
                  本次
                </button>
                <button
                  :class="{ 'is-active': training.heatRange.value === 'recent' }"
                  @click="heatRangeButton('recent')"
                >
                  近 8 练
                </button>
                <button
                  :class="{ 'is-active': training.heatRange.value === 'all' }"
                  @click="heatRangeButton('all')"
                >
                  全部
                </button>
              </div>
            </header>

            <MuscleHeatMap :scores="training.heatScores.value" />

            <div class="heat-meta">
              <span>范围：{{ training.heatScopeLabel.value }}</span>
              <span>有效组 · 悬停查看肌群</span>
            </div>
            <p class="heat-note">
              有效组 = 组数 × 该动作对该肌群的激活占比 × RPE 系数。颜色越深，说明所选范围内该肌群承受的有效刺激越多；
              未着色的肌群表示还没有被记录到。
            </p>
          </section>

          <!-- 本次统计 -->
          <section class="plan-card stats-card">
            <header class="plan-card-head">
              <div>
                <div class="plan-kicker">Session {{ training.selectedIndex.value }} · 统计</div>
                <h3 class="plan-card-title">本次训练负荷</h3>
              </div>
              <span class="stats-pct">{{ completionPct }}%</span>
            </header>

            <div class="stats-grid">
              <div class="stat-cell">
                <b>{{ doneExercises }}<small>/{{ totalExercises }}</small></b>
                <span>动作位完成</span>
              </div>
              <div class="stat-cell">
                <b>{{ training.streak.value }}<small>次</small></b>
                <span>连续完成训练</span>
              </div>
              <div class="stat-cell">
                <b>{{ training.sessionStats.value.sets }}<small>组</small></b>
                <span>本次总组数</span>
              </div>
              <div class="stat-cell">
                <b>{{ training.sessionStats.value.minutes }}<small>min</small></b>
                <span>估算训练时长</span>
              </div>
            </div>

            <div class="stats-volume">
              <span>本次外部负荷容量</span>
              <b>{{ volumeLabel(training.sessionStats.value.volume) }}</b>
              <em>自重动作不计入 kg 容量</em>
            </div>

            <div class="stats-progress">
              <i :style="{ width: `${completionPct}%` }"></i>
            </div>
          </section>

          <!-- 本轮计划容量 -->
          <PlanVolumeAudit
            :items="training.volumeAudit.value"
            :round="training.activeSession.value.round"
            :phase-name="phase.name"
            :goal-zh="goal.zh"
          />

          <!-- 肌群强度排行 -->
          <section class="plan-card rank-card">
            <header class="plan-card-head">
              <div>
                <div class="plan-kicker">Load · 肌群强度</div>
                <h3 class="plan-card-title">有效组排行</h3>
              </div>
              <span class="rank-count">{{ training.trainedMuscleCount.value }} 块</span>
            </header>

            <div v-if="!topMuscles.length" class="rank-empty">
              打卡后这里会按有效组排序，告诉你训练刺激主要集中在哪些肌群。
            </div>
            <div v-else class="rank-list">
              <div v-for="m in topMuscles" :key="m.id" class="rank-row">
                <span class="rank-name">{{ MUSCLE_MAP.get(m.id)?.zh }}</span>
                <span class="rank-track">
                  <i
                    :style="{
                      width: `${Math.max(4, (m.sets / training.heatMax.value) * 100)}%`,
                      background: heatTier(m.sets)?.color ?? 'var(--ink-4)',
                    }"
                  ></i>
                </span>
                <span class="rank-val">{{ muscleLoadLabel(m.sets) }}</span>
                <span class="rank-vol">{{ volumeLabel(m.volume) }}</span>
              </div>
            </div>

            <div class="rank-legend">
              <span v-for="t in HEAT_TIERS" :key="t.id">
                <i :style="{ background: t.color }"></i>{{ t.label }}
              </span>
            </div>
          </section>

          <!-- 调整建议 -->
          <section class="plan-card advice-card">
            <div class="plan-kicker">Next · 下一次怎么练</div>
            <p class="advice-text">{{ training.recommendation.value }}</p>
            <div class="advice-meta">
              <span>「{{ goal.zh }}」处方</span>
              <span>{{ goal.badge }}</span>
            </div>
            <p class="advice-sub">{{ goal.desc }}</p>
          </section>
        </aside>
      </div>

      <footer class="plan-foot">
        <div class="plan-principles">
          <div>
            <b>渐进超负荷</b>
            <span>完成度 ≥80% 才加负荷，否则重复上一次；加负荷优先加重量，其次加次数，最后加组数。</span>
          </div>
          <div>
            <b>容量—强度波动</b>
            <span>三段累积、一段减载。减载不是偷懒，而是让超量恢复真正发生。</span>
          </div>
          <div>
            <b>容量优先</b>
            <span>直接组按主动肌 1 组、协同肌 0.5 组计；低于区间先加主项，高于区间先减孤立。</span>
          </div>
          <div>
            <b>记录而非感觉</b>
            <span>用 RPE 与负重留下可比较的数据，下一周期才知道应该加多少。</span>
          </div>
        </div>
        <p class="plan-disclaimer">
          本计划基于常见的力量训练周期化原则整理，RPE、组数与激活占比均为训练实践中的近似值，
          不构成医疗或康复建议。疼痛、关节不适或既往伤病请先咨询专业人士。
        </p>
      </footer>
    </div>

    <ExerciseDrawer
      :open="!!detailId"
      :exercise-id="detailId"
      :scope-ids="dayExerciseIds"
      @close="detailId = null"
      @select="detailId = $event"
      @view-in-model="viewExerciseInModel"
    />
  </section>
</template>
