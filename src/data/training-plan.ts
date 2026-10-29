/**
 * 八周阶段性训练计划。
 *
 * 结构参考线性周期化（linear periodization）：
 *   解剖适应 → 容量累积 → 强度强化 → 减载恢复。
 * 每周的组数、次数、RPE 与组间休息由「目标 × 水平 × 分期 × 动作角色」推导，
 * 动作本身从动作库中按难度阶梯抽取，因此计划里的每个动作都能在肌骨模型里查看。
 */

export type GoalId = 'hypertrophy' | 'strength' | 'recondition'
export type PhaseId = 'adaptation' | 'volume' | 'intensity' | 'deload'
export type RoleId = 'main' | 'secondary' | 'accessory' | 'core' | 'conditioning'
export type Level = 1 | 2 | 3
export type DaysPerWeek = 2 | 3 | 4 | 5 | 6

export interface PlanConfig {
  goal: GoalId
  level: Level
  days: DaysPerWeek
  /** 计划首周周一（YYYY-MM-DD） */
  startDate: string
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
  weeks: [number, number]
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
  uid: string
  exerciseId: string
  role: RoleId
  /** 该动作在当天担任的角色名，如「水平推」 */
  label: string
  prescription: Prescription
  note: string
}

export interface PlanDay {
  key: string
  title: string
  en: string
  focus: string
  warmup: string
  /** 周一为 0 */
  weekday: number
  exercises: PlannedExercise[]
}

export interface PlanWeek {
  week: number
  phase: Phase
  days: PlanDay[]
  note: string
}

export const PLAN_WEEKS = 8

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
    weeks: [1, 2],
    intent: '先让肌腱、韧带与关节追上肌肉，建立稳定动作模式，不追求极限重量。',
    volume: '中低容量',
    rpe: 'RPE 6–7',
  },
  {
    id: 'volume',
    name: '容量累积期',
    en: 'Volume Accumulation',
    weeks: [3, 5],
    intent: '动作稳定后堆叠有效容量，用足够的机械张力与代谢压力推动围度增长。',
    volume: '高容量',
    rpe: 'RPE 7–8',
  },
  {
    id: 'intensity',
    name: '强度强化期',
    en: 'Intensification',
    weeks: [6, 7],
    intent: '次数下调、负荷上调，让神经与肌纤维承受更高张力，同时略降容量控制疲劳。',
    volume: '中容量 · 高强度',
    rpe: 'RPE 8–9',
  },
  {
    id: 'deload',
    name: '减载恢复期',
    en: 'Deload & Supercompensation',
    weeks: [8, 8],
    intent: '容量减半、强度回落，让延迟性疲劳消散，超量恢复在此时真正发生。',
    volume: '低容量',
    rpe: 'RPE 5–6',
  },
]

/** 每个周期只在固定的星期几训练，方便把计划映射到真实日期 */
const WEEKDAY_OFFSETS: Record<DaysPerWeek, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
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
  title: '推 · 上胸与肩',
  en: 'Push B',
  focus: '胸大肌锁骨部 · 三角肌前束 · 肱三头肌',
  warmup: WARMUP_UPPER,
  slots: [
    { role: 'main', label: '上斜推', pool: ['smith-bench-press', 'dumbbell-incline-press', 'barbell-incline-press'] },
    { role: 'secondary', label: '肩推', pool: ['machine-shoulder-press', 'arnold-press', 'landmine-press'] },
    { role: 'accessory', label: '胸孤立', pool: ['low-cable-fly', 'dumbbell-fly', 'cable-crossover'] },
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'front-raise', 'cable-lateral-raise'] },
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
    { role: 'accessory', label: '后束与肩胛', pool: ['face-pull', 'cable-rear-delt-fly', 'reverse-pec-deck'] },
    { role: 'accessory', label: '肱二头', pool: ['cable-curl', 'barbell-curl', 'incline-dumbbell-curl'] },
    { role: 'accessory', label: '斜方与握力', pool: ['barbell-shrug', 'upright-row', 'farmer-carry'] },
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
    { role: 'accessory', label: '斜方与握力', pool: ['cable-shrug', 'upright-row', 'farmer-carry'] },
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
    { role: 'accessory', label: '肱二头', pool: ['cable-curl', 'hammer-curl', 'incline-dumbbell-curl'] },
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
    { role: 'accessory', label: '内收与臀中', pool: ['band-lateral-walk', 'hip-abduction', 'cable-standing-hip-abduction'] },
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
    { role: 'accessory', label: '三角肌中束', pool: ['machine-lateral-raise', 'lateral-raise', 'cable-lateral-raise'] },
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
    { role: 'accessory', label: '单腿', pool: ['step-up', 'bulgarian-split-squat', 'barbell-lunge'] },
    { role: 'accessory', label: '肱二头', pool: ['cable-curl', 'barbell-curl', 'incline-dumbbell-curl'] },
    { role: 'core', label: '核心', pool: ['side-plank', 'cable-crunch', 'hanging-leg-raise'] },
  ],
}

const DAY_TEMPLATES: Record<DaysPerWeek, DayTemplate[]> = {
  2: [FULL_A, FULL_B],
  3: [PUSH_A, PULL_A, LEGS_A],
  4: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
  5: [PUSH_A, PULL_A, LEGS_A, UPPER_B, LOWER_B],
  6: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B],
}

const WEEK_NOTES = [
  '第 1 周：用偏轻负荷校准动作轨迹与器械高度，所有组保留 3 次余力。',
  '第 2 周：同一负荷下每组多做 1–2 次，或增加 1 个递增组。',
  '第 3 周：主项组数 +1，进入容量累积；睡眠不足时把孤立动作减 1 组。',
  '第 4 周：容量峰值周，组间休息不要压缩，宁可少做一组也不要降质量。',
  '第 5 周：完成度 ≥80% 的主项 +2.5kg（下肢 +5kg），否则重复上周负荷。',
  '第 6 周：次数下调、负荷上调，主项留 1 次余力，孤立动作到力竭前 1 次。',
  '第 7 周：强度峰值周，只对状态最好的 1–2 个主项冲击顶层组。',
  '第 8 周：减载 40–50%，全部动作 RPE ≤6，让超量恢复发生。',
]

const ROLE_NOTE: Record<RoleId, string> = {
  main: '本日主导动作 · 优先保证全程幅度与稳定轨迹',
  secondary: '第二发力点 · 离心控制 2–3 秒，不借力',
  accessory: '孤立补量 · 最后一组接近力竭前 1 次',
  core: '核心抗伸展/抗旋转 · 全程保持呼吸',
  conditioning: '代谢收尾 · 动作间不歇，组间休息 30 秒',
}

export function phaseOf(week: number): Phase {
  return PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) ?? PHASES[0]
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

function prescriptionFor(goal: GoalId, level: Level, phase: PhaseId, role: RoleId): Prescription {
  const base = SETS_BY_PHASE[phase][role]
  const bonus = level === 3 && role === 'main' && (phase === 'volume' || phase === 'intensity') ? 1 : 0
  const sets = goal === 'recondition' && role === 'main' ? Math.min(base, 3) : base + bonus
  return {
    sets: Math.max(1, sets),
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

export function buildWeek(config: PlanConfig, week: number): PlanWeek {
  const phase = phaseOf(week)
  const templates = DAY_TEMPLATES[config.days]
  const offsets = WEEKDAY_OFFSETS[config.days]
  const conditioning =
    config.goal === 'recondition'
      ? { role: 'conditioning' as const, label: '代谢收尾', pool: ['kettlebell-swing'] }
      : null

  const days = templates.map((tpl, dayIndex) => {
    const slots = conditioning ? [...tpl.slots, conditioning] : tpl.slots
    return {
      key: tpl.key,
      title: tpl.title,
      en: tpl.en,
      focus: tpl.focus,
      warmup: tpl.warmup,
      weekday: offsets[dayIndex] ?? dayIndex,
      exercises: slots.map((slot, slotIndex) => ({
        uid: `${week}:${tpl.key}:${slotIndex}`,
        exerciseId: slot.pool[Math.min(config.level - 1, slot.pool.length - 1)],
        role: slot.role,
        label: slot.label,
        prescription: prescriptionFor(config.goal, config.level, phase.id, slot.role),
        note: ROLE_NOTE[slot.role],
      })),
    }
  })

  return { week, phase, days, note: WEEK_NOTES[week - 1] ?? '' }
}

export function buildPlan(config: PlanConfig): PlanWeek[] {
  return Array.from({ length: PLAN_WEEKS }, (_, i) => buildWeek(config, i + 1))
}

/** 每周总组数，用于展示训练量 */
export function weeklySets(week: PlanWeek): number {
  return week.days.reduce(
    (sum, day) => sum + day.exercises.reduce((s, e) => s + e.prescription.sets, 0),
    0,
  )
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
