<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Check, X } from '@lucide/vue'
import { useTraining, formatShortDate, weekdayName } from '@/composables/useTraining'
import {
  GOALS,
  HEAT_TIERS,
  PHASES,
  PLAN_WEEKS,
  heatTier,
  type GoalId,
  type Level,
  type Phase,
} from '@/data/training-plan'
import { MUSCLE_MAP } from '@/data/muscles'
import { LEVEL_LABEL } from '@/data/equipment'
import { EXERCISE_MAP } from '@/data/exercises'
import PlanSession from '@/components/plan/PlanSession.vue'
import FreeCheckin from '@/components/plan/FreeCheckin.vue'
import MuscleHeatMap from '@/components/plan/MuscleHeatMap.vue'
import ExerciseDrawer from '@/components/ExerciseDrawer.vue'

const router = useRouter()
const training = useTraining()

const LEVELS: Level[] = [1, 2, 3]
const FREQUENCIES: (2 | 3 | 4 | 5 | 6)[] = [2, 3, 4, 5, 6]

const phase = computed(() => training.week.value.phase)
const goal = computed(() => GOALS.find((g) => g.id === training.config.value.goal) ?? GOALS[0])
const weekDays = computed(() => training.week.value.days)
const activeLogs = computed(() => training.logsForDate(training.activeDate.value))

/** 当前打开详情的动作；空表示抽屉关闭 */
const detailId = ref<string | null>(null)

/** 详情里上一项/下一项只在该训练日内走动，不把用户带到动作库的浏览序列里 */
const dayExerciseIds = computed(() => [
  ...new Set(training.selectedSession.value.exercises.map((item) => item.exerciseId)),
])

const dayExercises = computed(() =>
  weekDays.value.reduce((sum, d) => sum + d.exercises.length, 0),
)

const completionPct = computed(() =>
  Math.min(
    100,
    Math.round((training.weekStats.value.completed / Math.max(1, training.weekStats.value.planned)) * 100),
  ),
)

const topMuscles = computed(() => training.heatDetail.value.slice(0, 6))

function phaseState(p: Phase): 'done' | 'current' | 'upcoming' {
  if (training.selectedWeek.value > p.weeks[1]) return 'done'
  if (training.selectedWeek.value >= p.weeks[0]) return 'current'
  return 'upcoming'
}

function setGoal(id: GoalId) {
  if (training.config.value.goal === id) return
  training.setConfig({ goal: id })
  training.selectedDay.value = 0
}

function setLevel(level: Level) {
  training.setConfig({ level })
  training.selectedDay.value = 0
}

function setDays(days: 2 | 3 | 4 | 5 | 6) {
  training.setConfig({ days })
  training.selectedDay.value = 0
}

function selectWeek(w: number) {
  training.selectedWeek.value = w
  training.selectedDay.value = 0
}

function selectDay(i: number) {
  training.selectedDay.value = i
}

function restart() {
  if (!window.confirm('把计划起点对齐到本周一？已打卡的记录会保留。')) return
  training.restart()
}

function exerciseName(id: string): string {
  return EXERCISE_MAP.get(id)?.zh ?? id
}

function heatRangeButton(range: 'week' | 'month' | 'all') {
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
  training.syncToday()
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
            <b>第 {{ training.selectedWeek.value }} 周</b>
            <span>{{ phase.name }} · {{ phase.rpe }}</span>
          </div>
        </div>
      </header>

      <!-- ─── 目标 / 水平 / 频率 ─── -->
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
          <span class="control-key is-second">频率</span>
          <div class="control-chips">
            <button
              v-for="d in FREQUENCIES"
              :key="d"
              class="pchip is-compact"
              :class="{ 'is-active': training.config.value.days === d }"
              @click="setDays(d)"
            >
              <b>{{ d }} 天</b>
            </button>
          </div>
          <span class="control-summary">
            {{ training.config.value.days }} 练/周 · 每周 {{ dayExercises }} 个动作位 · 共 {{ PLAN_WEEKS }} 周
          </span>
          <button class="plan-link" @click="restart">对齐到本周一</button>
        </div>
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
              @click="selectWeek(p.weeks[0])"
            >
              <span class="phase-index">0{{ i + 1 }}</span>
              <span class="phase-name">{{ p.name }}</span>
              <span class="phase-weeks">第 {{ p.weeks[0] }}–{{ p.weeks[1] }} 周 · {{ p.volume }}</span>
              <span class="phase-bar">
                <i
                  :style="{
                    width:
                      phaseState(p) === 'done'
                        ? '100%'
                        : phaseState(p) === 'current'
                          ? `${((training.selectedWeek.value - p.weeks[0] + 1) / (p.weeks[1] - p.weeks[0] + 1)) * 100}%`
                          : '0%',
                  }"
                ></i>
              </span>
            </button>
          </div>

          <!-- 当前分期提示：一行说完分期、意图与容量/RPE，超长截断 -->
          <div class="phase-banner" :data-phase="phase.id">
            <span class="phase-banner-kicker">{{ phase.en }}</span>
            <p class="phase-banner-text" :title="phase.intent">{{ phase.intent }}</p>
            <span class="phase-banner-meta">{{ phase.volume }} · {{ phase.rpe }}</span>
          </div>

          <!-- 周选择 -->
          <div class="week-strip" aria-label="选择训练周">
            <button
              v-for="w in training.plan.value"
              :key="w.week"
              class="week-chip"
              :class="{ 'is-active': training.selectedWeek.value === w.week }"
              :data-phase="w.phase.id"
              @click="selectWeek(w.week)"
            >
              <span class="week-no">W{{ w.week }}</span>
              <span class="week-dots">
                <i
                  v-for="(d, di) in w.days"
                  :key="d.key"
                  :class="{ 'is-done': training.dayDone(w.week, di) }"
                ></i>
              </span>
              <span class="week-tag">{{ training.completedInWeek(w.week) }}/{{ w.days.length }}</span>
            </button>
          </div>

          <!-- 训练日切换 -->
          <div class="day-tabs" aria-label="选择训练日">
            <button
              v-for="(d, i) in weekDays"
              :key="d.key"
              class="day-tab"
              :class="{
                'is-active': training.selectedDay.value === i,
                'is-done': training.dayDone(training.selectedWeek.value, i),
              }"
              @click="selectDay(i)"
            >
              <span class="day-tab-title">
                <Check
                  v-if="training.dayDone(training.selectedWeek.value, i)"
                  class="day-tab-check"
                  :size="10"
                  :stroke-width="2.6"
                />
                <span>{{ d.title }}</span>
              </span>
              <span class="day-tab-date">
                {{ formatShortDate(training.dateFor(training.selectedWeek.value, i)) }}
                {{ weekdayName(training.dateFor(training.selectedWeek.value, i)) }}
              </span>
            </button>
          </div>

          <div class="week-note">{{ training.week.value.note }}</div>

          <!-- 当日训练与打卡 -->
          <PlanSession
            :day="training.selectedSession.value"
            :date="training.activeDate.value"
            @open-exercise="openExercise"
          />

          <!-- 当日记录 -->
          <section class="plan-card log-card">
            <header class="plan-card-head">
              <div>
                <div class="plan-kicker">Log · 当日记录</div>
                <h3 class="plan-card-title">
                  {{ formatShortDate(training.activeDate.value) }} 已打卡 {{ activeLogs.length }} 条
                </h3>
              </div>
              <span class="log-total">
                {{ training.logsForDate(training.activeDate.value).reduce((s, l) => s + l.sets, 0) }} 组
              </span>
            </header>

            <div v-if="!activeLogs.length" class="log-empty">
              这一天还没有记录。按计划动作打卡，或用下面的「自由打卡」补上临时增加的动作。
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
          <FreeCheckin :date="training.activeDate.value" />
        </main>

        <!-- ─── 侧列 ─── -->
        <aside class="plan-side">
          <!-- 3D 热图 -->
          <section class="plan-card heat-card">
            <header class="plan-card-head">
              <div>
                <div class="plan-kicker">Heat map · 3D 肌肉热图</div>
                <h3 class="plan-card-title">本周练到了哪里</h3>
              </div>
              <div class="heat-range">
                <button
                  :class="{ 'is-active': training.heatRange.value === 'week' }"
                  @click="heatRangeButton('week')"
                >
                  本周
                </button>
                <button
                  :class="{ 'is-active': training.heatRange.value === 'month' }"
                  @click="heatRangeButton('month')"
                >
                  近 4 周
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
              <span>
                范围：{{ training.heatRange.value === 'week' ? `第 ${training.selectedWeek.value} 周` : training.heatRange.value === 'month' ? '近 28 天' : '全部记录' }}
              </span>
              <span>有效组 · 悬停查看肌群</span>
            </div>
            <p class="heat-note">
              有效组 = 组数 × 该动作对该肌群的激活占比 × RPE 系数。颜色越深，说明这一周该肌群承受的有效刺激越多；
              未着色的肌群表示还没有被记录到。
            </p>
          </section>

          <!-- 本周统计 -->
          <section class="plan-card stats-card">
            <header class="plan-card-head">
              <div>
                <div class="plan-kicker">Week {{ training.selectedWeek.value }} · 统计</div>
                <h3 class="plan-card-title">本周训练负荷</h3>
              </div>
              <span class="stats-pct">{{ completionPct }}%</span>
            </header>

            <div class="stats-grid">
              <div class="stat-cell">
                <b>{{ training.weekStats.value.completed }}<small>/{{ training.weekStats.value.planned }}</small></b>
                <span>完成训练日</span>
              </div>
              <div class="stat-cell">
                <b>{{ training.streak.value }}<small>天</small></b>
                <span>连续打卡</span>
              </div>
              <div class="stat-cell">
                <b>{{ training.weekStats.value.sets }}<small>组</small></b>
                <span>总组数</span>
              </div>
              <div class="stat-cell">
                <b>{{ training.weekStats.value.minutes }}<small>min</small></b>
                <span>估算训练时长</span>
              </div>
            </div>

            <div class="stats-volume">
              <span>外部负荷容量</span>
              <b>{{ volumeLabel(training.weekStats.value.volume) }}</b>
              <em>自重动作不计入 kg 容量</em>
            </div>

            <div class="stats-progress">
              <i :style="{ width: `${completionPct}%` }"></i>
            </div>
          </section>

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
              打卡后这里会按有效组排序，告诉你本周刺激主要集中在哪些肌群。
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
              <span>本周「{{ goal.zh }}」处方</span>
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
            <span>完成度 ≥80% 才加负荷，否则重复上周；加负荷优先加重量，其次加次数，最后加组数。</span>
          </div>
          <div>
            <b>容量—强度波动</b>
            <span>三周累积、一周减载。减载不是偷懒，而是让超量恢复真正发生。</span>
          </div>
          <div>
            <b>有效组优先</b>
            <span>热身组不计入有效组；每个肌群每周 10–20 个有效组是多数人的增肌区间。</span>
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
