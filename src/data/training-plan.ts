/**
 * 八阶段训练计划，按完成次数推进。
 *
 * 结构参考线性周期化（linear periodization）：
 *   解剖适应 → 容量累积 → 强度强化 → 减载恢复。
 * 计划不绑定日期与星期：第 n 次训练按训练日模板轮转，所处轮次决定分期。
 * 每次训练的组数、次数、RPE 与组间休息由「目标 × 水平 × 分期 × 动作角色」推导，
 * 动作本身从动作库中按难度阶梯抽取，因此计划里的每个动作都能在肌骨模型里查看。
 */

import type { MuscleId } from './types'

export type GoalId = 'hypertrophy' | 'strength' | 'recondition'
export type PhaseId = 'adaptation' | 'volume' | 'intensity' | 'deload'
export type RoleId = 'main' | 'secondary' | 'accessory' | 'core' | 'conditioning'
export type Level = 1 | 2 | 3
export type DaysPerWeek = 2 | 3 | 4 | 5 | 6
export type SplitId = 'full' | 'ppl' | 'ul' | 'hybrid' | 'ppl2'

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
}

export interface Goal {
  id: GoalId
  zh: string
  en: string
  desc: string
  badge: string
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
  },
  {
    id: 'strength',
    zh: '力量突破',
    en: 'Max Strength',
    desc: '低次数高强度，主项 3–6 次、组间充分休息，用更高张力换取神经适应。',
    badge: '3–6 次/组',
  },
  {
    id: 'recondition',
    zh: '减脂体能',
    en: 'Reconditioning',
    desc: '高次数短间歇，配合摆荡/农夫行走循环收尾，兼顾热量消耗与心肺能力。',
    badge: '12–20 次/组',
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
    intent: '容量减半、强度回落，让延迟性疲劳消散，超量恢复在此时真正发生。',
    volume: '低容量',
    rpe: 'RPE 5–6',
  },
]

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

const WARMUP_UPPER = '热身 8 分钟：快走/划船 + 弹力带肩胛激活 + 主项 2 组递增组'
const WARMUP_LOWER = '热身 10 分钟：单车 + 髋踝活动 + 主项 2 组递增组'
const WARMUP_FULL = '热身 8 分钟：划船 + 全身动态拉伸 + 主项 2 组递增组'

const PUSH_A: DayTemplate = {
  key: 'push-a',
  title: '推 · 胸肩三头',
  en: 'Push A',
  focus: '胸大肌 · 三角肌 · 肱三头肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '水平推', pool: ['machine-chest-press', 'barbell-bench-press', 'barbell-incline-press'] },
    { role: 'secondary', label: '垂直推', pool: ['machine-shoulder-press', 'dumbbell-shoulder-press', 'barbell-overhead-press'] },
    { role: 'accessory', label: '胸孤立', pool: ['cable-crossover', 'dumbbell-fly', 'pec-deck'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'overhead-cable-ext', 'skull-crusher'] },
    { role: 'core', label: '核心', pool: ['plank', 'dead-bug', 'ab-wheel-rollout'] },
  ],
}

const PUSH_B: DayTemplate = {
  key: 'push-b',
  title: '推 · 上胸与肩后束',
  en: 'Push B',
  focus: '胸大肌锁骨部 · 三角肌中后束 · 肱三头肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '上斜推', pool: ['smith-bench-press', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'accessory', label: '胸孤立', pool: ['low-cable-fly', 'dumbbell-fly', 'cable-crossover'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '三角肌中束', pool: ['cable-lateral-raise', 'lateral-raise', 'machine-lateral-raise'] },
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
    { role: 'accessory', label: '肱二头', pool: ['cable-curl', 'barbell-curl', 'incline-dumbbell-curl'] },
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
    { role: 'main', label: '垂直拉', pool: ['assisted-chin-up', 'neutral-grip-pull-up', 'chinup'] },
    { role: 'main', label: '水平拉', pool: ['chest-supported-row', 't-bar-row', 'pendlay-row'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'reverse-pec-deck', 'prone-y-raise'] },
    { role: 'accessory', label: '肱二头', pool: ['hammer-curl', 'machine-preacher-curl', 'incline-dumbbell-curl'] },
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
    { role: 'main', label: '深蹲', pool: ['leg-press', 'barbell-squat', 'front-squat'] },
    { role: 'secondary', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'accessory', label: '单腿', pool: ['step-up', 'bulgarian-split-squat', 'barbell-lunge'] },
    { role: 'accessory', label: '小腿', pool: ['machine-calf-raise', 'seated-calf-raise', 'donkey-calf-raise'] },
    { role: 'accessory', label: '小腿', pool: ['seated-calf-raise', 'smith-calf-raise', 'donkey-calf-raise'] },
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
    { role: 'main', label: '髋铰链', pool: ['hip-thrust-machine', 'barbell-hip-thrust', 'barbell-deadlift'] },
    { role: 'secondary', label: '腿举', pool: ['leg-press', 'hack-squat', 'smith-squat'] },
    { role: 'accessory', label: '腘绳肌', pool: ['leg-curl', 'seated-leg-curl', 'nordic-curl'] },
    { role: 'accessory', label: '小腿', pool: ['seated-calf-raise', 'smith-calf-raise', 'donkey-calf-raise'] },
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
    { role: 'main', label: '水平推', pool: ['machine-chest-press', 'barbell-bench-press', 'barbell-incline-press'] },
    { role: 'secondary', label: '垂直推', pool: ['machine-shoulder-press', 'dumbbell-shoulder-press', 'barbell-overhead-press'] },
    { role: 'accessory', label: '上斜推', pool: ['smith-bench-press', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'accessory', label: '胸孤立', pool: ['cable-crossover', 'dumbbell-fly', 'pec-deck'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '三角肌中束', pool: ['cable-lateral-raise', 'lateral-raise', 'machine-lateral-raise'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'overhead-cable-ext', 'skull-crusher'] },
    { role: 'accessory', label: '肱三头', pool: ['dumbbell-overhead-tricep-extension', 'dip', 'triceps-pushdown'] },
    { role: 'core', label: '核心', pool: ['plank', 'dead-bug', 'ab-wheel-rollout'] },
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
    { role: 'accessory', label: '水平拉', pool: ['chest-supported-row', 'seated-cable-row', 't-bar-row'] },
    { role: 'accessory', label: '后束与肩胛', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '肱二头', pool: ['cable-curl', 'barbell-curl', 'incline-dumbbell-curl'] },
    { role: 'accessory', label: '肱二头', pool: ['hammer-curl', 'machine-preacher-curl', 'incline-dumbbell-curl'] },
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
    { role: 'main', label: '深蹲', pool: ['leg-press', 'barbell-squat', 'front-squat'] },
    { role: 'secondary', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'accessory', label: '单腿', pool: ['step-up', 'bulgarian-split-squat', 'barbell-lunge'] },
    { role: 'accessory', label: '腿举', pool: ['leg-press', 'hack-squat', 'smith-squat'] },
    { role: 'accessory', label: '腘绳肌', pool: ['leg-curl', 'seated-leg-curl', 'nordic-curl'] },
    { role: 'accessory', label: '小腿', pool: ['machine-calf-raise', 'seated-calf-raise', 'donkey-calf-raise'] },
    { role: 'accessory', label: '小腿', pool: ['seated-calf-raise', 'smith-calf-raise', 'donkey-calf-raise'] },
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
    { role: 'main', label: '水平推', pool: ['machine-chest-press', 'barbell-bench-press', 'barbell-incline-press'] },
    { role: 'main', label: '水平拉', pool: ['machine-row', 'seated-cable-row', 'barbell-row'] },
    { role: 'secondary', label: '垂直推', pool: ['machine-shoulder-press', 'dumbbell-shoulder-press', 'barbell-overhead-press'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'overhead-cable-ext', 'skull-crusher'] },
    { role: 'accessory', label: '肱二头', pool: ['cable-curl', 'barbell-curl', 'incline-dumbbell-curl'] },
    { role: 'core', label: '核心', pool: ['plank', 'dead-bug', 'ab-wheel-rollout'] },
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
    { role: 'main', label: '上斜推', pool: ['smith-bench-press', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'secondary', label: '水平拉', pool: ['chest-supported-row', 'seated-cable-row', 't-bar-row'] },
    { role: 'accessory', label: '胸孤立', pool: ['low-cable-fly', 'dumbbell-fly', 'pec-deck'] },
    { role: 'accessory', label: '后束', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '肱二头', pool: ['cable-curl', 'hammer-curl', 'incline-dumbbell-curl'] },
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
    { role: 'main', label: '深蹲', pool: ['goblet-squat', 'barbell-squat', 'front-squat'] },
    { role: 'secondary', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'accessory', label: '单腿', pool: ['step-up', 'bulgarian-split-squat', 'barbell-lunge'] },
    { role: 'accessory', label: '小腿', pool: ['machine-calf-raise', 'seated-calf-raise', 'donkey-calf-raise'] },
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
    { role: 'main', label: '髋铰链', pool: ['hip-thrust-machine', 'barbell-hip-thrust', 'barbell-deadlift'] },
    { role: 'secondary', label: '腿举', pool: ['leg-press', 'hack-squat', 'smith-squat'] },
    { role: 'accessory', label: '腘绳肌', pool: ['leg-curl', 'seated-leg-curl', 'nordic-curl'] },
    { role: 'accessory', label: '小腿', pool: ['seated-calf-raise', 'smith-calf-raise', 'donkey-calf-raise'] },
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
    { role: 'main', label: '深蹲', pool: ['goblet-squat', 'barbell-squat', 'front-squat'] },
    { role: 'main', label: '水平推', pool: ['machine-chest-press', 'barbell-bench-press', 'barbell-incline-press'] },
    { role: 'main', label: '水平拉', pool: ['machine-row', 'seated-cable-row', 'barbell-row'] },
    { role: 'accessory', label: '髋铰链', pool: ['glute-bridge', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'accessory', label: '胸孤立', pool: ['cable-crossover', 'dumbbell-fly', 'pec-deck'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'overhead-cable-ext', 'skull-crusher'] },
    { role: 'accessory', label: '小腿', pool: ['machine-calf-raise', 'seated-calf-raise', 'donkey-calf-raise'] },
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
    { role: 'main', label: '髋铰链', pool: ['hip-thrust-machine', 'romanian-deadlift', 'barbell-deadlift'] },
    { role: 'main', label: '垂直拉', pool: ['assisted-pullup', 'lat-pulldown', 'pullup'] },
    { role: 'main', label: '垂直推', pool: ['machine-shoulder-press', 'dumbbell-shoulder-press', 'barbell-overhead-press'] },
    { role: 'secondary', label: '上斜推', pool: ['smith-bench-press', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'accessory', label: '单腿', pool: ['step-up', 'bulgarian-split-squat', 'barbell-lunge'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
    { role: 'accessory', label: '肱二头', pool: ['cable-curl', 'barbell-curl', 'incline-dumbbell-curl'] },
    { role: 'accessory', label: '肱三头', pool: ['triceps-pushdown', 'dumbbell-overhead-tricep-extension', 'dip'] },
    { role: 'accessory', label: '小腿', pool: ['seated-calf-raise', 'smith-calf-raise', 'donkey-calf-raise'] },
    { role: 'core', label: '核心', pool: ['side-plank', 'cable-crunch', 'hanging-leg-raise'] },
  ],
}

const SPLIT_TEMPLATES: Record<SplitId, DayTemplate[]> = {
  full: [FULL_A, FULL_B],
  ppl: [PPL3_PUSH, PPL3_PULL, PPL3_LEGS],
  ul: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
  hybrid: [UPPER_A, LOWER_A, PUSH_B, PULL_B, LEGS_B],
  ppl2: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B],
}

/** 分化本身决定的组数加成：循环越短，单次要补的容量越多 */
const SPLIT_SET_BONUS: Record<SplitId, Partial<Record<RoleId, number>>> = {
  full: { main: 1, accessory: 2, core: 1 },
  ppl: { main: 1, accessory: 1 },
  ul: { accessory: 1 },
  hybrid: { accessory: 1 },
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
  '减载 40–50%，全部动作 RPE ≤6，让超量恢复发生。',
]

const ROLE_NOTE: Record<RoleId, string> = {
  main: '本日主导动作 · 优先保证全程幅度与稳定轨迹',
  secondary: '第二发力点 · 离心控制 2–3 秒，不借力',
  accessory: '孤立补量 · 最后一组接近力竭前 1 次',
  core: '核心抗伸展/抗旋转 · 全程保持呼吸',
  conditioning: '代谢收尾 · 动作间不歇，组间休息 30 秒',
}

export function phaseOf(round: number): Phase {
  return PHASES.find((p) => round >= p.rounds[0] && round <= p.rounds[1]) ?? PHASES[0]
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

function rpeFor(phase: PhaseId): string {
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

function loadFor(goal: GoalId, phase: PhaseId, role: RoleId): string {
  if (role === 'conditioning') return '循环 3 轮'
  if (goal === 'strength') {
    if (role !== 'main' && role !== 'secondary') return '保留 2 次余力'
    switch (phase) {
      case 'adaptation':
        return '65–70% 1RM'
      case 'volume':
        return '75–80% 1RM'
      case 'intensity':
        return '85–90% 1RM'
      default:
        return '55–60% 1RM'
    }
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
): Prescription {
  const base = SETS_BY_PHASE[phase][role]
  const splitBonus = SPLIT_SET_BONUS[split][role] ?? 0
  const levelPenalty =
    level === 1 && (role === 'secondary' || role === 'accessory' || role === 'core') ? -1 : 0
  const sets = base + splitBonus + levelPenalty
  return {
    sets: Math.max(2, sets),
    reps: repsFor(goal, phase, role),
    rpe: rpeFor(phase),
    rest: restFor(goal, role),
    load: loadFor(goal, phase, role),
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

/** 按训练次序构造第 index 次训练；swaps 里记着的动作位会被替换 */
export function buildSession(
  config: PlanConfig,
  index: number,
  swaps: PlanSwaps = {},
): PlanSession {
  const split = SPLIT_MAP.get(config.split) ?? SPLITS[0]
  const total = PLAN_ROUNDS * split.days
  const safeIndex = Math.min(total, Math.max(1, Math.trunc(index)))
  const round = Math.ceil(safeIndex / split.days)
  const phase = phaseOf(round)
  const templates = SPLIT_TEMPLATES[split.id]
  const tpl = templates[(safeIndex - 1) % split.days]
  const conditioning =
    config.goal === 'recondition'
      ? { role: 'conditioning' as const, label: '代谢收尾', pool: ['kettlebell-swing'] }
      : null
  const slots = conditioning ? [...tpl.slots, conditioning] : tpl.slots

  const day: PlanDay = {
    key: tpl.key,
    title: tpl.title,
    en: tpl.en,
    focus: tpl.focus,
    warmup: tpl.warmup,
    exercises: slots.map((slot, slotIndex) => {
      const slotKey = `${tpl.key}:${slotIndex}`
      return {
        uid: `${safeIndex}:${slotKey}`,
        slotKey,
        exerciseId:
          swaps[slotKey] || slot.pool[Math.min(config.level - 1, slot.pool.length - 1)],
        role: slot.role,
        label: slot.label,
        prescription: prescriptionFor(config.goal, config.level, phase.id, slot.role, split.id),
        note: ROLE_NOTE[slot.role],
      }
    }),
  }

  return { index: safeIndex, round, phase, day, note: ROUND_NOTES[round - 1] ?? '' }
}

/** 全程训练序列：PLAN_ROUNDS × 每个循环的训练次数 */
export function buildPlan(config: PlanConfig, swaps: PlanSwaps = {}): PlanSession[] {
  const split = SPLIT_MAP.get(config.split) ?? SPLITS[0]
  return Array.from({ length: PLAN_ROUNDS * split.days }, (_, i) =>
    buildSession(config, i + 1, swaps),
  )
}

export type VolumeGroupType = 'large' | 'posterior' | 'medium' | 'small' | 'core'

export interface VolumeGroupDef {
  id: string
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
    zh: '上背/后束',
    type: 'medium',
    members: ['rhomboids', 'trapezius', 'deltoid-posterior'],
  },
  { id: 'quads', zh: '股四头', type: 'large', members: ['quadriceps'] },
  {
    id: 'glutes-hams',
    zh: '臀/腘绳',
    type: 'posterior',
    members: ['gluteus-maximus', 'gluteus-medius', 'hamstrings'],
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
  large: [9, 24],
  posterior: [10, 24],
  medium: [10, 30],
  small: [7, 18],
  core: [6, 20],
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

/** 水平对容量目标的折算 */
export const LEVEL_VOLUME_SCALE: Record<Level, number> = {
  1: 0.9,
  2: 1,
  3: 1.1,
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
