/**
 * 八阶段训练计划，按完成次数推进。
 *
 * 结构参考线性周期化（linear periodization）：
 *   解剖适应 → 容量累积 → 强度强化 → 减载恢复。
 * 计划不绑定日期与星期：第 n 次训练按训练日模板轮转，所处轮次决定分期。
 * 每次训练的组数、次数、RPE 与组间休息由「目标 × 水平 × 分期 × 动作角色」推导，
 * 动作本身从动作库中按难度阶梯抽取，因此计划里的每个动作都能在肌骨模型里查看。
 */

import { EXERCISE_MAP } from './exercises'
import { MUSCLE_MAP } from './muscles'
import {
  DEFAULT_GYM_EQUIPMENT,
  allowedExerciseIds,
  type GymEquipmentId,
} from './gym-equipment'
import type { EquipmentId, Exercise, MuscleId } from './types'

export type GoalId = 'hypertrophy' | 'strength' | 'recondition'
export type PhaseId = 'adaptation' | 'volume' | 'intensity' | 'deload'
export type RoleId = 'main' | 'secondary' | 'accessory' | 'core' | 'conditioning'
export type Level = 1 | 2 | 3
export type DaysPerWeek = 2 | 3 | 4 | 5 | 6
export type SplitId = 'full' | 'ppl' | 'ul' | 'hybrid' | 'ppl2'
/** 重点部位，与容量审计的训练肌群分组一一对应 */
export type FocusGroupId =
  | 'chest'
  | 'lats'
  | 'upper-back'
  | 'rear-delts'
  | 'quads'
  | 'glutes'
  | 'hamstrings'
  | 'side-delts'
  | 'biceps'
  | 'triceps'
  | 'calves'
  | 'core'

export interface Split {
  id: SplitId
  zh: string
  en: string
  /** 一次循环的训练日数量 */
  days: DaysPerWeek
  desc: string
  levelHint: string
}

export interface PlanConfig {
  goal: GoalId
  level: Level
  split: SplitId
  /** 当前周期，从 1 开始；换周期只重置完成度，不清空历史记录 */
  cycle: number
  /** 全身分化精简版：去掉全身日最后 2 个孤立动作 */
  compact: boolean
  /** 重点部位；空数组表示不限部位，计划与未加此功能时一致 */
  focus: FocusGroupId[]
  /** 健身房实际可用的器械；计划只会从这里能完成的动作里取 */
  equipment: GymEquipmentId[]
}

export interface Goal {
  id: GoalId
  zh: string
  en: string
  desc: string
  badge: string
  /** 该目标优先推荐的分化 */
  recommendedSplits: SplitId[]
}

export interface Phase {
  id: PhaseId
  name: string
  en: string
  /** 起止轮次（含），一轮 = 每个循环的训练次数 */
  rounds: [number, number]
  intent: string
  volume: string
  rpe: string
}

export interface Prescription {
  sets: number
  /** 次数区间，如 8–10 */
  reps: string
  rpe: string
  /** 组间休息秒数 */
  rest: number
  load: string
}

export interface PlannedExercise {
  /** 第几次训练 + 训练日 + 位序号，随训练次序变化 */
  uid: string
  /** 训练日 key + 位序号，跨轮次稳定，用于记住用户换过的动作 */
  slotKey: string
  exerciseId: string
  role: RoleId
  /** 该动作在当天担任的角色名，如「水平推」 */
  label: string
  prescription: Prescription
  note: string
}

/** 动作位替换表：slotKey → 动作库 id；只换动作，处方仍由该位角色推导 */
export type PlanSwaps = Record<string, string>

export interface PlanDay {
  key: string
  title: string
  en: string
  focus: string
  warmup: string
  cooldown: string
  exercises: PlannedExercise[]
}

export interface PlanSession {
  /** 全程第几次训练，从 1 开始 */
  index: number
  /** 第几轮，用于决定分期与提示，不作为界面单位 */
  round: number
  phase: Phase
  day: PlanDay
  note: string
}

export const PLAN_ROUNDS = 8

export const SPLITS: Split[] = [
  {
    id: 'full',
    zh: '全身',
    en: 'Full Body',
    days: 2,
    desc: '每次覆盖全身，循环最短；适合每周 2–3 练或单次时间充裕的人。',
    levelHint: '入门 / 进阶',
  },
  {
    id: 'ppl',
    zh: '推拉腿',
    en: 'Push Pull Legs',
    days: 3,
    desc: '推、拉、腿各一日，三日一循环；单日需要更高的组数来补足每轮容量。',
    levelHint: '进阶',
  },
  {
    id: 'ul',
    zh: '上下肢',
    en: 'Upper Lower',
    days: 4,
    desc: '上肢与下肢交替，每块肌群每轮两次暴露，容量分配最均衡。',
    levelHint: '进阶',
  },
  {
    id: 'hybrid',
    zh: '五分化',
    en: 'Hybrid Split',
    days: 5,
    desc: '上肢、下肢、推、拉、腿；兼顾训练频率与单日专注度。',
    levelHint: '进阶 / 高阶',
  },
  {
    id: 'ppl2',
    zh: '推拉腿 ×2',
    en: 'PPL ×2',
    days: 6,
    desc: '推拉腿 A/B 双轮，单次组数更低，适合高频、恢复良好的训练者。',
    levelHint: '高阶',
  },
]

export const SPLIT_MAP = new Map<SplitId, Split>(SPLITS.map((split) => [split.id, split]))

/** 旧版按每周训练天数保存的计划，迁移到对应分化 */
export const DAYS_TO_SPLIT: Record<DaysPerWeek, SplitId> = {
  2: 'full',
  3: 'ppl',
  4: 'ul',
  5: 'hybrid',
  6: 'ppl2',
}

export const GOALS: Goal[] = [
  {
    id: 'hypertrophy',
    zh: '增肌塑形',
    en: 'Hypertrophy',
    desc: '中等负荷叠加中高容量，主项 6–10 次、孤立 12–20 次，强调离心控制与全程幅度。',
    badge: '6–20 次/组',
    recommendedSplits: ['ul', 'hybrid', 'ppl2'],
  },
  {
    id: 'strength',
    zh: '力量突破',
    en: 'Max Strength',
    desc: '低次数高强度，主项 3–6 次、组间充分休息，用更高张力换取神经适应；建议配合全身或上下肢分化，让主项每轮暴露两次。',
    badge: '3–6 次/组',
    recommendedSplits: ['full', 'ul'],
  },
  {
    id: 'recondition',
    zh: '减脂体能',
    en: 'Reconditioning',
    desc: '高次数短间歇，配合所选器械的循环收尾；每周再安排 150 分钟中等强度有氧或 8–10k 步。',
    badge: '12–20 次/组',
    recommendedSplits: ['full', 'ul', 'ppl'],
  },
]

export const PHASES: Phase[] = [
  {
    id: 'adaptation',
    name: '解剖适应期',
    en: 'Anatomical Adaptation',
    rounds: [1, 2],
    intent: '先让肌腱、韧带与关节追上肌肉，建立稳定动作模式，不追求极限重量。',
    volume: '中低容量',
    rpe: 'RPE 6–7',
  },
  {
    id: 'volume',
    name: '容量累积期',
    en: 'Volume Accumulation',
    rounds: [3, 5],
    intent: '动作稳定后堆叠有效容量，用足够的机械张力与代谢压力推动围度增长。',
    volume: '高容量',
    rpe: 'RPE 7–8',
  },
  {
    id: 'intensity',
    name: '强度强化期',
    en: 'Intensification',
    rounds: [6, 7],
    intent: '次数下调、负荷上调，让神经与肌纤维承受更高张力，同时略降容量控制疲劳。',
    volume: '中容量 · 高强度',
    rpe: 'RPE 8–9',
  },
  {
    id: 'deload',
    name: '减载恢复期',
    en: 'Deload & Supercompensation',
    rounds: [8, 8],
    intent: '容量以本轮峰值为基准下降约四到五成，强度同时回落，让延迟性疲劳消散，超量恢复在此时真正发生。',
    volume: '低容量',
    rpe: 'RPE 5–6',
  },
]

/** 同一套分期，按水平调整各阶段轮数；总轮数仍为 8 */
const PHASE_ROUNDS_BY_LEVEL: Record<Level, Record<PhaseId, [number, number]>> = {
  1: { adaptation: [1, 3], volume: [4, 6], intensity: [7, 7], deload: [8, 8] },
  2: { adaptation: [1, 2], volume: [3, 5], intensity: [6, 7], deload: [8, 8] },
  3: { adaptation: [1, 1], volume: [2, 5], intensity: [6, 7], deload: [8, 8] },
}

/** 按水平取分期；入门适应期更长，高阶直接进入容量期 */
export function phasesFor(level: Level): Phase[] {
  const rounds = PHASE_ROUNDS_BY_LEVEL[level]
  return PHASES.map((phase) => ({ ...phase, rounds: rounds[phase.id] }))
}

interface SlotTemplate {
  role: RoleId
  label: string
  /** 由易到难排列，按用户水平取对应档位 */
  pool: string[]
}

interface DayTemplate {
  key: string
  title: string
  en: string
  focus: string
  warmup: string
  slots: SlotTemplate[]
}

/* 热身不依赖清单外的有氧器械、弹力带或壶铃 */
const WARMUP_UPPER = '热身 8 分钟：快走 + 徒手肩胛激活 + 主项 2 组递增组'
const WARMUP_LOWER = '热身 10 分钟：快走 + 髋踝活动 + 主项 2 组递增组'
const WARMUP_FULL = '热身 8 分钟：快走 + 全身动态拉伸 + 主项 2 组递增组'

const COOLDOWN_UPPER = '冷身 5 分钟：慢走降心率 + 胸/肩前侧拉伸，每侧 30 秒'
const COOLDOWN_LOWER = '冷身 5 分钟：慢走降心率 + 髋屈肌/腘绳肌拉伸，每侧 30 秒'
const COOLDOWN_FULL = '冷身 5 分钟：慢走降心率 + 全身静态拉伸'

function cooldownFor(warmup: string): string {
  if (warmup === WARMUP_UPPER) return COOLDOWN_UPPER
  if (warmup === WARMUP_LOWER) return COOLDOWN_LOWER
  return COOLDOWN_FULL
}

const PUSH_A: DayTemplate = {
  key: 'push-a',
  title: '推 · 胸肩三头',
  en: 'Push A',
  focus: '胸大肌 · 三角肌 · 肱三头肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '水平推', pool: ['machine-chest-press', 'plate-loaded-chest-press', 'barbell-bench-press'] },
    { role: 'secondary', label: '垂直推', pool: ['machine-shoulder-press', 'plate-loaded-shoulder-press', 'barbell-overhead-press'] },
    { role: 'accessory', label: '胸孤立', pool: ['cable-crossover', 'dumbbell-fly', 'pec-deck'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'overhead-cable-ext', 'skull-crusher'] },
    { role: 'core', label: '核心', pool: ['plank', 'dead-bug', 'machine-abdominal-crunch'] },
  ],
}

const PUSH_B: DayTemplate = {
  key: 'push-b',
  title: '推 · 上胸与肩后束',
  en: 'Push B',
  focus: '胸大肌锁骨部 · 三角肌中后束 · 肱三头肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '上斜推', pool: ['incline-push-up', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'accessory', label: '胸孤立', pool: ['low-cable-fly', 'dumbbell-fly', 'cable-crossover'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'cable-lateral-raise', 'lateral-raise'] },
    { role: 'accessory', label: '三角肌中束', pool: ['lateral-raise', 'machine-lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'dumbbell-overhead-tricep-extension', 'dip'] },
    { role: 'core', label: '核心', pool: ['side-plank', 'pallof-press', 'cable-woodchop'] },
  ],
}

const PULL_A: DayTemplate = {
  key: 'pull-a',
  title: '拉 · 背与二头',
  en: 'Pull A',
  focus: '背阔肌 · 斜方肌 · 肱二头肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '垂直拉', pool: ['assisted-pullup', 'lat-pulldown', 'weighted-pull-up'] },
    { role: 'main', label: '水平拉', pool: ['machine-row', 'seated-cable-row', 'barbell-row'] },
    { role: 'accessory', label: '肩胛与后束', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '肱二头', pool: ['machine-biceps-curl', 'cable-curl', 'barbell-curl'] },
    { role: 'core', label: '核心', pool: ['dead-bug', 'hanging-knee-raise', 'hanging-leg-raise'] },
  ],
}

const PULL_B: DayTemplate = {
  key: 'pull-b',
  title: '拉 · 厚度与后链',
  en: 'Pull B',
  focus: '背阔肌 · 菱形肌 · 肱二头肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '垂直拉', pool: ['assisted-chin-up', 'close-grip-lat-pulldown', 'lat-pulldown'] },
    { role: 'main', label: '水平拉', pool: ['chest-supported-row', 't-bar-row', 'pendlay-row'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'reverse-pec-deck', 'prone-y-raise'] },
    { role: 'accessory', label: '肱二头', pool: ['hammer-curl', 'cable-curl', 'machine-biceps-curl'] },
    { role: 'core', label: '核心', pool: ['hollow-body-hold', 'cable-crunch', 'trx-fallout'] },
  ],
}

const LEGS_A: DayTemplate = {
  key: 'legs-a',
  title: '腿 · 深蹲主导',
  en: 'Legs A',
  focus: '股四头肌 · 臀大肌 · 腘绳肌',
  warmup: WARMUP_LOWER,
  slots: [
    { role: 'main', label: '深蹲', pool: ['perfect-squat', 'barbell-squat', 'front-squat'] },
    { role: 'secondary', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'accessory', label: '单腿', pool: ['step-up', 'bulgarian-split-squat', 'barbell-lunge'] },
    { role: 'accessory', label: '股四头孤立', pool: ['leg-extension', 'hip-abduction', 'glute-kickback-machine'] },
    { role: 'accessory', label: '髋外展', pool: ['hip-abduction', 'hip-adduction', 'glute-kickback-machine'] },
    { role: 'core', label: '核心', pool: ['dead-bug', 'side-plank', 'copenhagen-plank'] },
  ],
}

const LEGS_B: DayTemplate = {
  key: 'legs-b',
  title: '腿 · 髋主导',
  en: 'Legs B',
  focus: '臀大肌 · 腘绳肌 · 股四头肌',
  warmup: WARMUP_LOWER,
  slots: [
    { role: 'main', label: '髋铰链', pool: ['glute-bridge', 'barbell-hip-thrust', 'barbell-deadlift'] },
    { role: 'secondary', label: '腿举', pool: ['leg-press', 'perfect-squat', 'barbell-squat'] },
    { role: 'accessory', label: '腘绳肌', pool: ['leg-curl', 'seated-leg-curl', 'nordic-curl'] },
    { role: 'accessory', label: '髋内收', pool: ['hip-adduction', 'leg-extension', 'glute-kickback-machine'] },
    { role: 'core', label: '核心', pool: ['side-plank-hip-dip', 'cable-pallof-hold', 'ab-wheel-kneel'] },
  ],
}

const PPL3_PUSH: DayTemplate = {
  key: 'ppl-push',
  title: '推 · 胸肩三头',
  en: 'Push · 3-Day',
  focus: '胸大肌 · 三角肌中束 · 肱三头肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '水平推', pool: ['machine-chest-press', 'plate-loaded-chest-press', 'barbell-bench-press'] },
    { role: 'secondary', label: '垂直推', pool: ['machine-shoulder-press', 'plate-loaded-shoulder-press', 'barbell-overhead-press'] },
    { role: 'accessory', label: '上斜推', pool: ['incline-push-up', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'accessory', label: '胸孤立', pool: ['cable-crossover', 'dumbbell-fly', 'pec-deck'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'cable-lateral-raise', 'lateral-raise'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'overhead-cable-ext', 'skull-crusher'] },
    { role: 'accessory', label: '肱三头', pool: ['dumbbell-overhead-tricep-extension', 'dip', 'triceps-pushdown'] },
    { role: 'core', label: '核心', pool: ['plank', 'dead-bug', 'machine-abdominal-crunch'] },
  ],
}

const PPL3_PULL: DayTemplate = {
  key: 'ppl-pull',
  title: '拉 · 背与二头',
  en: 'Pull · 3-Day',
  focus: '背阔肌 · 斜方肌 · 肱二头肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '垂直拉', pool: ['assisted-pullup', 'lat-pulldown', 'weighted-pull-up'] },
    { role: 'main', label: '水平拉', pool: ['machine-row', 'seated-cable-row', 'barbell-row'] },
    { role: 'accessory', label: '水平拉', pool: ['chest-supported-row', 't-bar-row', 'pendlay-row'] },
    { role: 'accessory', label: '后束与肩胛', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '肱二头', pool: ['machine-biceps-curl', 'cable-curl', 'barbell-curl'] },
    { role: 'accessory', label: '肱二头', pool: ['hammer-curl', 'cable-curl', 'machine-biceps-curl'] },
    { role: 'accessory', label: '斜方与握力', pool: ['barbell-shrug', 'upright-row', 'farmer-carry'] },
    { role: 'core', label: '核心', pool: ['dead-bug', 'hanging-knee-raise', 'hanging-leg-raise'] },
  ],
}

const PPL3_LEGS: DayTemplate = {
  key: 'ppl-legs',
  title: '腿 · 蹲髋并重',
  en: 'Legs · 3-Day',
  focus: '股四头肌 · 臀大肌 · 腘绳肌',
  warmup: WARMUP_LOWER,
  slots: [
    { role: 'main', label: '深蹲', pool: ['perfect-squat', 'barbell-squat', 'front-squat'] },
    { role: 'main', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'accessory', label: '单腿', pool: ['step-up', 'bulgarian-split-squat', 'barbell-lunge'] },
    { role: 'accessory', label: '腿举', pool: ['leg-press', 'perfect-squat', 'barbell-squat'] },
    { role: 'accessory', label: '腘绳肌', pool: ['leg-curl', 'seated-leg-curl', 'nordic-curl'] },
    { role: 'accessory', label: '股四头孤立', pool: ['leg-extension', 'hip-abduction', 'glute-kickback-machine'] },
    { role: 'accessory', label: '髋外展', pool: ['hip-abduction', 'hip-adduction', 'glute-kickback-machine'] },
    { role: 'core', label: '核心', pool: ['dead-bug', 'side-plank', 'copenhagen-plank'] },
  ],
}

const UPPER_A: DayTemplate = {
  key: 'upper-a',
  title: '上肢 A · 推拉平衡',
  en: 'Upper A',
  focus: '胸大肌 · 背阔肌 · 三角肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '水平推', pool: ['machine-chest-press', 'plate-loaded-chest-press', 'barbell-bench-press'] },
    { role: 'main', label: '水平拉', pool: ['machine-row', 'seated-cable-row', 'barbell-row'] },
    { role: 'secondary', label: '垂直推', pool: ['machine-shoulder-press', 'plate-loaded-shoulder-press', 'barbell-overhead-press'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '肱二头', pool: ['machine-biceps-curl', 'cable-curl', 'barbell-curl'] },
    { role: 'core', label: '核心', pool: ['plank', 'dead-bug', 'machine-abdominal-crunch'] },
  ],
}

const UPPER_B: DayTemplate = {
  key: 'upper-b',
  title: '上肢 B · 垂直与后束',
  en: 'Upper B',
  focus: '背阔肌 · 上胸 · 三角肌后束',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '垂直拉', pool: ['assisted-pullup', 'lat-pulldown', 'pullup'] },
    { role: 'main', label: '上斜推', pool: ['incline-push-up', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'secondary', label: '水平拉', pool: ['chest-supported-row', 'seated-cable-row', 't-bar-row'] },
    { role: 'accessory', label: '胸孤立', pool: ['low-cable-fly', 'dumbbell-fly', 'pec-deck'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '肱二头', pool: ['machine-biceps-curl', 'hammer-curl', 'cable-curl'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'dumbbell-overhead-tricep-extension', 'dip'] },
  ],
}

const LOWER_A: DayTemplate = {
  key: 'lower-a',
  title: '下肢 A · 蹲',
  en: 'Lower A',
  focus: '股四头肌 · 臀大肌 · 小腿',
  warmup: WARMUP_LOWER,
  slots: [
    { role: 'main', label: '深蹲', pool: ['perfect-squat', 'barbell-squat', 'front-squat'] },
    { role: 'secondary', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'accessory', label: '单腿', pool: ['step-up', 'bulgarian-split-squat', 'barbell-lunge'] },
    { role: 'accessory', label: '下肢孤立', pool: ['leg-extension', 'hip-abduction', 'hip-adduction'] },
    { role: 'core', label: '核心', pool: ['dead-bug', 'side-plank', 'copenhagen-plank'] },
  ],
}

const LOWER_B: DayTemplate = {
  key: 'lower-b',
  title: '下肢 B · 髋',
  en: 'Lower B',
  focus: '臀大肌 · 腘绳肌 · 内收肌',
  warmup: WARMUP_LOWER,
  slots: [
    { role: 'main', label: '髋铰链', pool: ['glute-bridge', 'barbell-hip-thrust', 'barbell-deadlift'] },
    { role: 'secondary', label: '腿举', pool: ['leg-press', 'perfect-squat', 'barbell-squat'] },
    { role: 'accessory', label: '腘绳肌', pool: ['leg-curl', 'seated-leg-curl', 'nordic-curl'] },
    { role: 'accessory', label: '髋内收', pool: ['hip-adduction', 'leg-extension', 'glute-kickback-machine'] },
    { role: 'core', label: '核心', pool: ['side-plank-hip-dip', 'cable-pallof-hold', 'ab-wheel-kneel'] },
  ],
}

const FULL_A: DayTemplate = {
  key: 'full-a',
  title: '全身 A · 蹲推拉',
  en: 'Full Body A',
  focus: '股四头肌 · 胸大肌 · 背阔肌',
  warmup: WARMUP_FULL,
  slots: [
    { role: 'main', label: '深蹲', pool: ['perfect-squat', 'barbell-squat', 'front-squat'] },
    { role: 'main', label: '水平推', pool: ['machine-chest-press', 'plate-loaded-chest-press', 'barbell-bench-press'] },
    { role: 'main', label: '水平拉', pool: ['machine-row', 'seated-cable-row', 'barbell-row'] },
    { role: 'accessory', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '胸孤立', pool: ['cable-crossover', 'dumbbell-fly', 'pec-deck'] },
    { role: 'accessory', label: '下肢孤立', pool: ['leg-extension', 'hip-abduction', 'hip-adduction'] },
    { role: 'core', label: '核心', pool: ['plank', 'dead-bug', 'hanging-knee-raise'] },
  ],
}

const FULL_B: DayTemplate = {
  key: 'full-b',
  title: '全身 B · 髋拉推',
  en: 'Full Body B',
  focus: '臀大肌 · 背部 · 肩部',
  warmup: WARMUP_FULL,
  slots: [
    { role: 'main', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'main', label: '垂直拉', pool: ['assisted-pullup', 'lat-pulldown', 'pullup'] },
    { role: 'main', label: '垂直推', pool: ['machine-shoulder-press', 'plate-loaded-shoulder-press', 'barbell-overhead-press'] },
    { role: 'secondary', label: '上斜推', pool: ['incline-push-up', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'accessory', label: '单腿', pool: ['step-up', 'bulgarian-split-squat', 'barbell-lunge'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'dumbbell-overhead-tricep-extension', 'dip'] },
    { role: 'accessory', label: '髋内收', pool: ['hip-adduction', 'leg-extension', 'glute-kickback-machine'] },
    { role: 'core', label: '核心', pool: ['side-plank', 'cable-crunch', 'hanging-leg-raise'] },
  ],
}

const STRENGTH_FULL_A: DayTemplate = {
  key: 'str-full-a',
  title: '全身力量 A · 蹲推拉',
  en: 'Full Body Strength A',
  focus: '股四头肌 · 胸大肌 · 背阔肌',
  warmup: WARMUP_FULL,
  slots: [
    { role: 'main', label: '深蹲', pool: ['perfect-squat', 'barbell-squat', 'front-squat'] },
    { role: 'main', label: '水平推', pool: ['machine-chest-press', 'plate-loaded-chest-press', 'barbell-bench-press'] },
    { role: 'main', label: '水平拉', pool: ['machine-row', 'seated-cable-row', 'barbell-row'] },
    { role: 'secondary', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'reverse-pec-deck', 'prone-y-raise'] },
    { role: 'core', label: '核心', pool: ['plank', 'dead-bug', 'machine-abdominal-crunch'] },
  ],
}

const STRENGTH_FULL_B: DayTemplate = {
  key: 'str-full-b',
  title: '全身力量 B · 髋推拉',
  en: 'Full Body Strength B',
  focus: '臀大肌 · 上胸 · 背部',
  warmup: WARMUP_FULL,
  slots: [
    { role: 'main', label: '髋铰链', pool: ['glute-bridge', 'barbell-hip-thrust', 'barbell-deadlift'] },
    { role: 'secondary', label: '深蹲变式', pool: ['perfect-squat', 'front-squat', 'barbell-squat'] },
    { role: 'main', label: '上斜推', pool: ['incline-push-up', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'main', label: '垂直拉', pool: ['assisted-pullup', 'lat-pulldown', 'pullup'] },
    { role: 'secondary', label: '垂直推', pool: ['machine-shoulder-press', 'plate-loaded-shoulder-press', 'barbell-overhead-press'] },
    { role: 'core', label: '核心', pool: ['side-plank', 'pallof-press', 'cable-woodchop'] },
  ],
}

const STRENGTH_UPPER_A: DayTemplate = {
  key: 'str-upper-a',
  title: '上肢力量 A · 卧推与划船',
  en: 'Upper Strength A',
  focus: '胸大肌 · 背阔肌 · 三角肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '水平推', pool: ['machine-chest-press', 'plate-loaded-chest-press', 'barbell-bench-press'] },
    { role: 'main', label: '水平拉', pool: ['machine-row', 'seated-cable-row', 'barbell-row'] },
    { role: 'secondary', label: '垂直推', pool: ['machine-shoulder-press', 'plate-loaded-shoulder-press', 'barbell-overhead-press'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'overhead-cable-ext', 'skull-crusher'] },
    { role: 'core', label: '核心', pool: ['plank', 'dead-bug', 'machine-abdominal-crunch'] },
  ],
}

const STRENGTH_UPPER_B: DayTemplate = {
  key: 'str-upper-b',
  title: '上肢力量 B · 上斜与垂直拉',
  en: 'Upper Strength B',
  focus: '上胸 · 背阔肌 · 三角肌后束',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '上斜推', pool: ['incline-push-up', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'main', label: '垂直拉', pool: ['assisted-pullup', 'lat-pulldown', 'pullup'] },
    { role: 'secondary', label: '水平拉', pool: ['chest-supported-row', 'seated-cable-row', 't-bar-row'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '肱二头', pool: ['machine-biceps-curl', 'cable-curl', 'barbell-curl'] },
    { role: 'core', label: '核心', pool: ['side-plank', 'pallof-press', 'cable-woodchop'] },
  ],
}

const STRENGTH_LOWER_A: DayTemplate = {
  key: 'str-lower-a',
  title: '下肢力量 A · 深蹲',
  en: 'Lower Strength A',
  focus: '股四头肌 · 臀大肌 · 腘绳肌',
  warmup: WARMUP_LOWER,
  slots: [
    { role: 'main', label: '深蹲', pool: ['perfect-squat', 'barbell-squat', 'front-squat'] },
    { role: 'secondary', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'accessory', label: '单腿', pool: ['step-up', 'bulgarian-split-squat', 'barbell-lunge'] },
    { role: 'accessory', label: '腘绳肌', pool: ['leg-curl', 'seated-leg-curl', 'nordic-curl'] },
    { role: 'accessory', label: '下肢孤立', pool: ['leg-extension', 'hip-abduction', 'hip-adduction'] },
    { role: 'core', label: '核心', pool: ['dead-bug', 'side-plank', 'copenhagen-plank'] },
  ],
}

const STRENGTH_LOWER_B: DayTemplate = {
  key: 'str-lower-b',
  title: '下肢力量 B · 髋与深蹲变式',
  en: 'Lower Strength B',
  focus: '臀大肌 · 股四头肌 · 腘绳肌',
  warmup: WARMUP_LOWER,
  slots: [
    { role: 'main', label: '髋铰链', pool: ['glute-bridge', 'barbell-hip-thrust', 'barbell-deadlift'] },
    { role: 'secondary', label: '深蹲变式', pool: ['perfect-squat', 'front-squat', 'barbell-squat'] },
    { role: 'accessory', label: '腘绳肌', pool: ['seated-leg-curl', 'nordic-curl', 'leg-curl'] },
    { role: 'accessory', label: '髋内收', pool: ['hip-adduction', 'leg-extension', 'glute-kickback-machine'] },
    { role: 'core', label: '核心', pool: ['side-plank-hip-dip', 'cable-pallof-hold', 'ab-wheel-kneel'] },
  ],
}

const SPLIT_TEMPLATES: Record<SplitId, DayTemplate[]> = {
  full: [FULL_A, FULL_B],
  ppl: [PPL3_PUSH, PPL3_PULL, PPL3_LEGS],
  ul: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
  hybrid: [UPPER_A, LOWER_A, PUSH_B, PULL_B, LEGS_B],
  ppl2: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B],
}

/** 力量目标的专项模板：主项频率更高、孤立动作更少；只覆盖推荐分化 */
const STRENGTH_TEMPLATES: Partial<Record<SplitId, DayTemplate[]>> = {
  full: [STRENGTH_FULL_A, STRENGTH_FULL_B],
  ul: [STRENGTH_UPPER_A, STRENGTH_LOWER_A, STRENGTH_UPPER_B, STRENGTH_LOWER_B],
}

/** 分化本身的组数加成：循环越短，单次主项多补 1 组；孤立动作靠槽位补量，不再叠组 */
const SPLIT_SET_BONUS: Record<SplitId, Partial<Record<RoleId, number>>> = {
  full: { main: 1 },
  ppl: { main: 1 },
  ul: {},
  hybrid: {},
  ppl2: {},
}

/** 按轮次给出的训练提示；每轮内的多次训练共用同一条提示 */
const ROUND_NOTES = [
  '起始阶段：用偏轻负荷校准动作轨迹与器械高度，所有组保留 3 次余力。',
  '同一负荷下每组多做 1–2 次，或增加 1 个递增组。',
  '主项组数 +1，进入容量累积；睡眠不足时把孤立动作减 1 组。',
  '容量峰值阶段，组间休息不要压缩，宁可少做一组也不要降质量。',
  '完成度 ≥80% 的主项 +2.5kg（下肢 +5kg），否则重复上次负荷。',
  '次数下调、负荷上调，主项留 1 次余力，孤立动作到力竭前 1 次。',
  '强度峰值阶段，只对状态最好的 1–2 个主项冲击顶层组。',
  '减载：容量以本轮峰值为基准下降约四到五成，全部动作 RPE ≤6，让超量恢复发生。',
]

const ROLE_NOTE: Record<RoleId, string> = {
  main: '本日主导动作 · 优先保证全程幅度与稳定轨迹',
  secondary: '第二发力点 · 离心控制 2–3 秒，不借力',
  accessory: '孤立补量 · 最后一组接近力竭前 1 次',
  core: '核心抗伸展/抗旋转 · 全程保持呼吸',
  conditioning: '代谢收尾 · 动作间不歇，组间休息 30 秒',
}

export function phaseOf(round: number, level: Level = 2): Phase {
  const phases = phasesFor(level)
  return phases.find((p) => round >= p.rounds[0] && round <= p.rounds[1]) ?? phases[0]
}

function noteFor(phase: Phase, round: number): string {
  const within = round - phase.rounds[0]
  switch (phase.id) {
    case 'adaptation':
      return ROUND_NOTES[Math.min(within, 1)]
    case 'volume':
      return ROUND_NOTES[2 + Math.min(within, 2)]
    case 'intensity':
      return ROUND_NOTES[5 + Math.min(within, 1)]
    default:
      return ROUND_NOTES[7]
  }
}

const SETS_BY_PHASE: Record<PhaseId, Record<RoleId, number>> = {
  adaptation: { main: 3, secondary: 3, accessory: 2, core: 2, conditioning: 3 },
  volume: { main: 4, secondary: 3, accessory: 3, core: 3, conditioning: 3 },
  intensity: { main: 4, secondary: 3, accessory: 2, core: 2, conditioning: 3 },
  deload: { main: 2, secondary: 2, accessory: 2, core: 2, conditioning: 2 },
}

function repsFor(goal: GoalId, phase: PhaseId, role: RoleId): string {
  if (role === 'conditioning') return '15–20'
  if (role === 'core') {
    if (phase === 'deload') return '10–12'
    if (goal === 'strength') return phase === 'intensity' ? '8–12' : '10–15'
    return '12–20'
  }
  const accessory = role === 'accessory'
  if (goal === 'strength') {
    if (phase === 'adaptation') return accessory ? '10–12' : role === 'main' ? '6–8' : '8–10'
    if (phase === 'volume') return accessory ? '8–10' : role === 'main' ? '5–6' : '6–8'
    if (phase === 'intensity') return accessory ? '6–8' : role === 'main' ? '3–5' : '4–6'
    return accessory ? '10' : role === 'main' ? '5' : '6–8'
  }
  if (goal === 'recondition') {
    if (phase === 'intensity') return accessory ? '15–20' : role === 'main' ? '10–15' : '12–15'
    if (phase === 'deload') return accessory ? '15' : '12–15'
    return accessory ? '15–20' : role === 'main' ? '12–15' : '12–15'
  }
  // hypertrophy
  if (phase === 'intensity') return accessory ? '10–12' : role === 'main' ? '6–8' : '8–10'
  if (phase === 'deload') return accessory ? '12–15' : role === 'main' ? '8–10' : '10–12'
  return accessory ? '12–15' : role === 'main' ? '8–10' : '10–12'
}

function rpeFor(phase: PhaseId, goal: GoalId, role: RoleId): string {
  // 力量目标的孤立/核心动作不需要跟着主项冲到 8–9
  if (goal === 'strength' && (role === 'accessory' || role === 'core') && phase !== 'deload') {
    return 'RPE 7–8'
  }
  switch (phase) {
    case 'adaptation':
      return 'RPE 6–7'
    case 'volume':
      return 'RPE 7–8'
    case 'intensity':
      return 'RPE 8–9'
    default:
      return 'RPE 5–6'
  }
}

function restFor(goal: GoalId, role: RoleId): number {
  const table: Record<GoalId, Record<RoleId, number>> = {
    hypertrophy: { main: 120, secondary: 90, accessory: 60, core: 45, conditioning: 30 },
    strength: { main: 180, secondary: 120, accessory: 90, core: 60, conditioning: 40 },
    recondition: { main: 75, secondary: 60, accessory: 45, core: 30, conditioning: 30 },
  }
  return table[goal][role]
}

/** 力量目标的强度按水平分级；入门不直接上 85% 以上 */
const STRENGTH_PERCENT: Record<Level, Record<PhaseId, string>> = {
  1: {
    adaptation: '60–65% 1RM',
    volume: '70–75% 1RM',
    intensity: '78–82% 1RM',
    deload: '50–55% 1RM',
  },
  2: {
    adaptation: '65–70% 1RM',
    volume: '75–80% 1RM',
    intensity: '82–87% 1RM',
    deload: '55–60% 1RM',
  },
  3: {
    adaptation: '70–75% 1RM',
    volume: '78–83% 1RM',
    intensity: '87–92% 1RM',
    deload: '55–60% 1RM',
  },
}

/** 只有能稳定量化 1RM 的器械才写 %1RM；器械/自重改 RIR */
const STRENGTH_LOADABLE: ReadonlySet<EquipmentId> = new Set<EquipmentId>([
  'barbell',
  'dumbbell',
  'smith',
])

function loadFor(
  goal: GoalId,
  phase: PhaseId,
  role: RoleId,
  level: Level,
  strengthLoadable: boolean,
): string {
  if (role === 'conditioning') return '循环 3 轮'
  if (goal === 'strength') {
    if (role !== 'main' && role !== 'secondary') return '保留 2 次余力'
    if (!strengthLoadable) return '保留 2–3 次余力'
    return STRENGTH_PERCENT[level][phase]
  }
  if (goal === 'recondition') return role === 'main' ? '心率 65–75%' : '循环节奏 · 不憋气'
  switch (phase) {
    case 'adaptation':
      return '留 3 次余力'
    case 'volume':
      return '留 2 次余力'
    case 'intensity':
      return '留 1 次余力'
    default:
      return '轻松 · 恢复'
  }
}

function prescriptionFor(
  goal: GoalId,
  level: Level,
  phase: PhaseId,
  role: RoleId,
  split: SplitId,
  exerciseId: string,
): Prescription {
  const base = SETS_BY_PHASE[phase][role]
  // 减载期不叠加分化加成，否则 full/PPL 的减载课仍接近容量期
  const splitBonus = phase === 'deload' ? 0 : (SPLIT_SET_BONUS[split][role] ?? 0)
  const levelPenalty =
    level === 1 && (role === 'secondary' || role === 'accessory' || role === 'core') ? -1 : 0
  // 力量目标：没有主项加成的分化补 1 组主项，同时压缩孤立动作
  const strengthMainBonus =
    goal === 'strength' && phase !== 'deload' && role === 'main' && !SPLIT_SET_BONUS[split].main
      ? 1
      : 0
  const strengthAccessoryPenalty = goal === 'strength' && role === 'accessory' ? -1 : 0
  const sets = base + splitBonus + levelPenalty + strengthMainBonus + strengthAccessoryPenalty
  // 减载允许降到 1 组，否则入门水平的减载幅度会被 2 组下限吃掉
  const minSets = phase === 'deload' ? 1 : 2
  const exercise = EXERCISE_MAP.get(exerciseId)
  const strengthLoadable = !!exercise && STRENGTH_LOADABLE.has(exercise.equipment)
  return {
    sets: Math.max(minSets, sets),
    reps: repsFor(goal, phase, role),
    rpe: rpeFor(phase, goal, role),
    rest: restFor(goal, role),
    load: loadFor(goal, phase, role, level, strengthLoadable),
  }
}

/** 取次数区间的中位数，用于打卡时的默认次数 */
export function parseReps(reps: string): number {
  const nums = reps.match(/\d+/g)
  if (!nums?.length) return 10
  const values = nums.map(Number)
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

/** 取 RPE 区间中位数 */
export function parseRpe(rpe: string): number {
  const nums = rpe.match(/\d+/g)
  if (!nums?.length) return 7
  const values = nums.map(Number)
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

/** 模板里保留下来的动作位；slotIndex 始终是模板原始位序号 */
export interface ResolvedSlot {
  slot: SlotTemplate
  slotIndex: number
}

export interface ResolvedTemplate {
  template: DayTemplate
  slots: ResolvedSlot[]
}

/** 动作主练肌肉落在哪些训练肌群；用于按重点部位筛选动作位 */
export function focusGroupsForExercise(exerciseId: string): FocusGroupId[] {
  const exercise = EXERCISE_MAP.get(exerciseId)
  if (!exercise) return []
  const primary = new Set(
    exercise.muscles.filter((hit) => hit.role === 'primary').map((hit) => hit.id),
  )
  return VOLUME_GROUP_DEFS.filter((group) =>
    group.members.some((id) => primary.has(id)),
  ).map((group) => group.id)
}

/* ───────── 器械白名单：计划只使用「我的器械」能完成的动作 ───────── */

/** 减脂目标的代谢收尾：按优先级取清单内可用的循环动作 */
const CONDITIONING_CANDIDATES = [
  'cable-pull-through',
  'dumbbell-sumo-deadlift',
  'leg-press',
  'perfect-squat',
  'cable-glute-kickback',
]

/** 已勾选器械能完成的动作；异常存档导致空集时退回整份清单，避免生成空计划 */
function allowedFor(config: PlanConfig): Set<string> {
  const allowed = allowedExerciseIds(config.equipment ?? DEFAULT_GYM_EQUIPMENT)
  return allowed.size ? allowed : allowedExerciseIds(DEFAULT_GYM_EQUIPMENT)
}

/** 整个动作池都不可用时，从白名单里找同主动肌、同复合/孤立属性的替代动作 */
function fallbackExercise(slot: SlotTemplate, allowed: Set<string>, level: Level): string | null {
  const ref = EXERCISE_MAP.get(slot.pool[Math.min(level - 1, slot.pool.length - 1)] ?? '')
  if (!ref) return null
  const targets = new Set(
    ref.muscles.filter((hit) => hit.role === 'primary').map((hit) => hit.id),
  )
  if (!targets.size) return null
  const affinity = (ex: Exercise) =>
    (ex.pattern === ref.pattern ? 0 : 4) +
    (ex.equipment === ref.equipment ? 0 : 2) +
    Math.abs(ex.level - ref.level)
  const found = [...allowed]
    .map((id) => EXERCISE_MAP.get(id))
    .filter((ex): ex is Exercise => !!ex)
    .filter(
      (ex) =>
        (ex.pattern === 'isolation') === (ref.pattern === 'isolation') &&
        ex.muscles.some((hit) => hit.role === 'primary' && targets.has(hit.id)),
    )
    .sort((a, b) => affinity(a) - affinity(b) || a.zh.localeCompare(b.zh))
  return found[0]?.id ?? null
}

/**
 * 把动作池里越界的动作换成同池难度档最接近的可用动作，保持 pool 长度与取档索引稳定；
 * 整池都越界时尝试一次同类兜底，仍找不到则返回空数组（该动作位会被略过）。
 */
function filteredPool(slot: SlotTemplate, allowed: Set<string>, level: Level): string[] {
  const usable = slot.pool.filter((id) => allowed.has(id))
  if (usable.length === slot.pool.length) return slot.pool
  if (!usable.length) {
    const fallback = fallbackExercise(slot, allowed, level)
    return fallback ? [fallback] : []
  }
  return slot.pool.map((id, index) => {
    if (allowed.has(id)) return id
    let best = usable[0]
    let distance = Number.POSITIVE_INFINITY
    for (const candidate of usable) {
      const gap = Math.abs(slot.pool.indexOf(candidate) - index)
      if (gap < distance) {
        distance = gap
        best = candidate
      }
    }
    return best
  })
}

/** 动作位最终动作：手动替换只有在器械白名单内才生效 */
function pickSlotExercise(
  slotKey: string,
  slot: SlotTemplate,
  config: PlanConfig,
  swaps: PlanSwaps,
  allowed: Set<string>,
): string {
  const swapped = swaps[slotKey]
  if (swapped && allowed.has(swapped) && EXERCISE_MAP.has(swapped)) return swapped
  return slot.pool[Math.min(config.level - 1, slot.pool.length - 1)] ?? ''
}

/** 该动作位实际要做的动作；与 buildSession 的取值顺序保持一致 */
function slotExerciseId(
  templateKey: string,
  slot: SlotTemplate,
  slotIndex: number,
  config: PlanConfig,
  swaps: PlanSwaps,
  allowed: Set<string>,
): string {
  return pickSlotExercise(`${templateKey}:${slotIndex}`, slot, config, swaps, allowed)
}

function templatesFor(config: PlanConfig): DayTemplate[] {
  const split = SPLIT_MAP.get(config.split) ?? SPLITS[0]
  return (
    (config.goal === 'strength' ? STRENGTH_TEMPLATES[split.id] : undefined) ??
    SPLIT_TEMPLATES[split.id] ??
    []
  )
}

/**
 * 解析当前配置下的训练日模板。
 * 先把每个动作池裁到「我的器械」能完成的动作，再按重点部位筛选；
 * 同一训练日内默认动作重复的动作位只保留第一个（原始 slotIndex 不变，打卡记录不会错位）。
 * 所选部位与分化完全不搭、或器械少到整轮被清空时都有兜底，不会生成空计划。
 */
export function resolveTemplates(config: PlanConfig, swaps: PlanSwaps = {}): ResolvedTemplate[] {
  const templates = templatesFor(config)
  let allowed = allowedFor(config)
  let scoped = templates.map((template) => ({
    template,
    slots: template.slots
      .map((slot, slotIndex) => ({
        slot: { ...slot, pool: filteredPool(slot, allowed, config.level) },
        slotIndex,
      }))
      .filter(({ slot }) => slot.pool.length > 0),
  }))
  // 少见的极端配置把整轮清空时，退回整份器械清单
  if (scoped.every(({ slots }) => slots.length === 0)) {
    allowed = allowedExerciseIds(DEFAULT_GYM_EQUIPMENT)
    scoped = templates.map((template) => ({
      template,
      slots: template.slots
        .map((slot, slotIndex) => ({
          slot: { ...slot, pool: filteredPool(slot, allowed, config.level) },
          slotIndex,
        }))
        .filter(({ slot }) => slot.pool.length > 0),
    }))
  }
  const all = scoped

  /** 同一天只保留一次同一个默认动作，避免器械不足时计划里全是同一个动作 */
  const dedupe = (list: ResolvedTemplate[]): ResolvedTemplate[] =>
    list
      .map(({ template, slots }) => {
        const seen = new Set<string>()
        return {
          template,
          slots: slots.filter(({ slot, slotIndex }) => {
            const id = slotExerciseId(template.key, slot, slotIndex, config, swaps, allowed)
            if (!id || seen.has(id)) return false
            seen.add(id)
            return true
          }),
        }
      })
      .filter(({ slots }) => slots.length > 0)

  const fallback = (): ResolvedTemplate[] => {
    const first = [...allowed][0] ?? 'machine-chest-press'
    return [
      {
        template: templates[0] ?? { key: 'gym', title: '训练', en: 'Session', focus: '', warmup: WARMUP_FULL, slots: [] },
        slots: [{ slot: { role: 'main', label: '主项', pool: [first] }, slotIndex: 0 }],
      },
    ]
  }

  let result: ResolvedTemplate[]
  if (!config.focus.length) {
    result = dedupe(all)
  } else {
    const focus = new Set(config.focus)
    const filtered = all
      .map(({ template, slots }) => ({
        template,
        slots: slots.filter(({ slot, slotIndex }) =>
          focusGroupsForExercise(
            slotExerciseId(template.key, slot, slotIndex, config, swaps, allowed),
          ).some((id) => focus.has(id)),
        ),
      }))
      .filter(({ slots }) => slots.length > 0)
    result = dedupe(filtered.length ? filtered : all)
  }
  return result.length ? result : fallback()
}

/** 因缺少对应器械被略过的动作位数量（按一个循环计），用于计划页提示 */
export function droppedSlotCount(config: PlanConfig): number {
  const allowed = allowedFor(config)
  let count = 0
  for (const template of templatesFor(config)) {
    for (const slot of template.slots) {
      if (!filteredPool(slot, allowed, config.level).length) count += 1
    }
  }
  return count
}

/** 每轮有效训练日数；限定重点部位后可能少于分化的天数 */
export function cycleDaysFor(config: PlanConfig, swaps: PlanSwaps = {}): number {
  return resolveTemplates(config, swaps).length
}

/** 按训练次序构造第 index 次训练；swaps 里记着的动作位会被替换 */
export function buildSession(
  config: PlanConfig,
  index: number,
  swaps: PlanSwaps = {},
): PlanSession {
  const split = SPLIT_MAP.get(config.split) ?? SPLITS[0]
  const resolved = resolveTemplates(config, swaps)
  const days = resolved.length
  const total = PLAN_ROUNDS * days
  const safeIndex = Math.min(total, Math.max(1, Math.trunc(index)))
  const round = Math.ceil(safeIndex / days)
  const phase = phaseOf(round, config.level)
  const { template: tpl, slots: tplSlots } = resolved[(safeIndex - 1) % days]
  const allowed = allowedFor(config)
  const focus = new Set(config.focus)
  // 代谢收尾也只能用清单内的器械；没练到重点部位时不安排
  const conditioningId =
    config.goal === 'recondition'
      ? (CONDITIONING_CANDIDATES.find((id) => allowed.has(id)) ?? null)
      : null
  const conditioning =
    conditioningId &&
    (!focus.size || focusGroupsForExercise(conditioningId).some((id) => focus.has(id)))
      ? {
          slot: { role: 'conditioning' as const, label: '代谢收尾', pool: [conditioningId] },
          slotIndex: tpl.slots.length,
        }
      : null
  const indexedSlots = conditioning ? [...tplSlots, conditioning] : tplSlots
  let keptSlots = indexedSlots
  // 已按重点部位筛过一轮动作位，再套精简版可能把所选部位删空
  if (config.compact && !focus.size && split.id === 'full') {
    // 保留原始 slotIndex，避免精简后后续动作位的打卡记录错位
    let remaining = 2
    keptSlots = [...indexedSlots]
      .reverse()
      .filter(({ slot }) => {
        if (remaining > 0 && slot.role === 'accessory') {
          remaining -= 1
          return false
        }
        return true
      })
      .reverse()
  }

  const day: PlanDay = {
    key: tpl.key,
    title: tpl.title,
    en: tpl.en,
    focus: tpl.focus,
    warmup: tpl.warmup,
    cooldown: cooldownFor(tpl.warmup),
    exercises: keptSlots.map(({ slot, slotIndex }) => {
      const slotKey = `${tpl.key}:${slotIndex}`
      const exerciseId = pickSlotExercise(slotKey, slot, config, swaps, allowed)
      return {
        uid: `${safeIndex}:${slotKey}`,
        slotKey,
        exerciseId,
        role: slot.role,
        label: slot.label,
        prescription: prescriptionFor(
          config.goal,
          config.level,
          phase.id,
          slot.role,
          split.id,
          exerciseId,
        ),
        note: ROLE_NOTE[slot.role],
      }
    }),
  }

  // 限定部位后，训练日的肌肉焦点按实际保留动作重写，避免标题与内容不符
  if (focus.size) {
    const names: string[] = []
    for (const item of day.exercises) {
      for (const hit of EXERCISE_MAP.get(item.exerciseId)?.muscles ?? []) {
        if (hit.role !== 'primary') continue
        const zh = MUSCLE_MAP.get(hit.id)?.zh
        if (zh && !names.includes(zh)) names.push(zh)
      }
    }
    if (names.length) day.focus = names.slice(0, 4).join(' · ')
  }

  return { index: safeIndex, round, phase, day, note: noteFor(phase, round) }
}

/** 全程训练序列：PLAN_ROUNDS × 每轮有效训练日数 */
export function buildPlan(config: PlanConfig, swaps: PlanSwaps = {}): PlanSession[] {
  const days = resolveTemplates(config, swaps).length
  return Array.from({ length: PLAN_ROUNDS * days }, (_, i) =>
    buildSession(config, i + 1, swaps),
  )
}

export type VolumeGroupType =
  | 'large'
  | 'posterior'
  | 'medium'
  | 'small'
  | 'core'
  | 'rear-delt'
  | 'hamstring'

export interface VolumeGroupDef {
  id: FocusGroupId
  zh: string
  type: VolumeGroupType
  members: MuscleId[]
}

/** 容量审计的肌群分组；同一动作对同一组只计一次，避免协同肌重复累计 */
export const VOLUME_GROUP_DEFS: VolumeGroupDef[] = [
  { id: 'chest', zh: '胸', type: 'large', members: ['pectoralis-major'] },
  { id: 'lats', zh: '背阔', type: 'large', members: ['latissimus-dorsi', 'teres-major'] },
  {
    id: 'upper-back',
    zh: '上背',
    type: 'medium',
    members: ['rhomboids', 'trapezius'],
  },
  {
    id: 'rear-delts',
    zh: '后束',
    type: 'rear-delt',
    members: ['deltoid-posterior'],
  },
  { id: 'quads', zh: '股四头', type: 'large', members: ['quadriceps'] },
  {
    id: 'glutes',
    zh: '臀',
    type: 'posterior',
    members: ['gluteus-maximus', 'gluteus-medius'],
  },
  {
    id: 'hamstrings',
    zh: '腘绳',
    type: 'hamstring',
    members: ['hamstrings'],
  },
  { id: 'side-delts', zh: '肩中', type: 'small', members: ['deltoid-lateral'] },
  { id: 'biceps', zh: '二头', type: 'small', members: ['biceps-brachii', 'brachialis'] },
  { id: 'triceps', zh: '三头', type: 'small', members: ['triceps-brachii'] },
  { id: 'calves', zh: '小腿', type: 'small', members: ['gastrocnemius', 'soleus'] },
  {
    id: 'core',
    zh: '核心',
    type: 'core',
    members: ['rectus-abdominis', 'external-oblique', 'transverse-abdominis'],
  },
]

/** 每轮直接组参考区间；目标差异体现在次数、负荷与休息，不在组数区间 */
const BASE_VOLUME_TARGETS: Record<VolumeGroupType, [number, number]> = {
  large: [10, 22],
  posterior: [10, 22],
  medium: [10, 24],
  small: [7, 16],
  core: [6, 18],
  'rear-delt': [5, 14],
  hamstring: [8, 18],
}

export const VOLUME_TARGETS: Record<GoalId, Record<VolumeGroupType, [number, number]>> = {
  hypertrophy: BASE_VOLUME_TARGETS,
  strength: BASE_VOLUME_TARGETS,
  recondition: BASE_VOLUME_TARGETS,
}

/** 分期对容量目标的折算 */
export const PHASE_VOLUME_SCALE: Record<PhaseId, number> = {
  adaptation: 0.8,
  volume: 1,
  intensity: 0.85,
  deload: 0.65,
}

/** 水平对容量目标的折算：入门目标降一档；高阶不抬高目标区间，进步由动作难度与负荷承担 */
export const LEVEL_VOLUME_SCALE: Record<Level, number> = {
  1: 0.85,
  2: 1,
  3: 1,
}

/** 分化对容量目标的折算：2 天全身每轮暴露次数少，目标区间下调 20% */
export const SPLIT_VOLUME_SCALE: Record<SplitId, number> = {
  full: 0.8,
  ppl: 1,
  ul: 1,
  hybrid: 1,
  ppl2: 1,
}

export interface HeatTier {
  id: string
  label: string
  range: string
  min: number
  color: string
  emissive: string
  intensity: number
}

/** 训练强度分档：以「有效组」为单位（组数 × 目标肌群激活占比 × RPE 系数） */
export const HEAT_TIERS: HeatTier[] = [
  { id: 'low', label: '低强度', range: '0–3 组', min: 0, color: '#6e948b', emissive: '#2f4a44', intensity: 0.3 },
  { id: 'mid', label: '中强度', range: '3–6 组', min: 3, color: '#cf8038', emissive: '#8a4d16', intensity: 0.38 },
  { id: 'high', label: '高强度', range: '6–10 组', min: 6, color: '#b23a2b', emissive: '#7d2114', intensity: 0.46 },
  { id: 'peak', label: '极限强度', range: '10 组以上', min: 10, color: '#8a2618', emissive: '#6d160b', intensity: 0.58 },
]

export function heatTier(score: number): HeatTier | null {
  if (score <= 0.15) return null
  let tier = HEAT_TIERS[0]
  for (const t of HEAT_TIERS) if (score >= t.min) tier = t
  return tier
}
