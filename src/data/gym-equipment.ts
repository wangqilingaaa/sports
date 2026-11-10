/**
 * 「我的器械」——健身房实际拥有的器械清单。
 *
 * 与 src/data/equipment.ts 的区别：那里是**动作库分类**（杠铃 / 固定器械 / 绳索…），
 * 用于动作检索；这里是**具体机型**，用于约束训练计划。计划生成、动作替换、
 * 自由打卡都会先求「已勾选器械能完成的动作」白名单，再从这个白名单里取动作。
 *
 * 清单里的自由重量与绳索按器械类别展开成动作 id 集合（新增同类动作会自动纳入），
 * 但会排除需要额外专有器械的变体（六角杠、地雷管、深蹲架、下斜凳等）。
 * 徒手动作单独作为一项，不占用任何器械，默认开启。
 */

import { EXERCISES, EXERCISE_MAP } from './exercises'
import type { EquipmentId } from './types'

export type GymGroupId = 'chest' | 'back' | 'arm' | 'leg' | 'free' | 'cable' | 'no-gear'

export interface GymGroup {
  id: GymGroupId
  zh: string
}

export const GYM_GROUPS: GymGroup[] = [
  { id: 'chest', zh: '胸 · 肩' },
  { id: 'back', zh: '背' },
  { id: 'arm', zh: '手臂 · 核心' },
  { id: 'leg', zh: '腿 · 臀' },
  { id: 'free', zh: '自由重量' },
  { id: 'cable', zh: '绳索' },
  { id: 'no-gear', zh: '无需器械' },
]

export type GymEquipmentId =
  | 'shoulder-press'
  | 'rear-kick'
  | 'plate-chest-press'
  | 'plate-shoulder-press'
  | 'chest-press'
  | 'pec-fly'
  | 'rear-delt-fly'
  | 'lateral-raise'
  | 'lat-pulldown'
  | 'seated-row'
  | 'dip-chin-assist'
  | 'leg-press'
  | 'perfect-squat'
  | 'leg-extension'
  | 'prone-leg-curl'
  | 'seated-leg-curl'
  | 'hip-abductor'
  | 'hip-adductor'
  | 'biceps-curl'
  | 'abdominal-crunch'
  | 'cable-crossover'
  | 'dumbbell'
  | 'barbell'
  | 'no-gear'

export interface GymEquipment {
  id: GymEquipmentId
  zh: string
  en: string
  group: GymGroupId
  /** 这台器械能完成的动作 id */
  exercises: string[]
  /** 界面补充说明 */
  note: string
}

/** 按动作库分类取全部动作，并剔除需要额外专有器械的变体 */
function equipmentExercises(equipment: EquipmentId, exclude: string[] = []): string[] {
  const blocked = new Set(exclude)
  return EXERCISES.filter((ex) => ex.equipment === equipment && !blocked.has(ex.id)).map(
    (ex) => ex.id,
  )
}

/** 杠铃：只认奥杆与杠铃片，六角杠 / 地雷管 / 深蹲架 / 下斜凳不在清单里 */
const BARBELL_IDS = equipmentExercises('barbell', [
  'trap-bar-deadlift',
  'landmine-press',
  'rack-pull',
  'decline-bench-press',
])

const DUMBBELL_IDS = equipmentExercises('dumbbell')
const CABLE_IDS = equipmentExercises('cable')

/** 完全不需要器械的垫上/徒手动作；单杠、双杠、健腹轮、长凳相关动作均不在此列 */
const NO_GEAR_IDS = [
  'pushup',
  'incline-push-up',
  'bodyweight-squat',
  'wall-sit',
  'glute-bridge',
  'single-leg-glute-bridge',
  'clamshell',
  'superman',
  'prone-y-raise',
  'plank',
  'side-plank',
  'bear-plank',
  'dead-bug',
  'bird-dog',
  'hollow-body-hold',
  'reverse-crunch',
  'bicycle-crunch',
  'v-up',
  'lying-leg-raise',
  'side-plank-hip-dip',
  'copenhagen-plank',
]

export const GYM_EQUIPMENT: GymEquipment[] = [
  /* ───────────── 胸 · 肩 ───────────── */
  {
    id: 'shoulder-press',
    zh: '坐姿推肩机',
    en: 'Shoulder Press',
    group: 'chest',
    exercises: ['machine-shoulder-press'],
    note: '清单第 1 项 · 固定轨迹垂直推',
  },
  {
    id: 'plate-chest-press',
    zh: '挂片式推胸机',
    en: 'Plate-Loaded Chest Press',
    group: 'chest',
    exercises: ['plate-loaded-chest-press'],
    note: '清单第 3 项 · 左右独立挂片臂',
  },
  {
    id: 'plate-shoulder-press',
    zh: '挂片式推肩机',
    en: 'Plate-Loaded Shoulder Press',
    group: 'chest',
    exercises: ['plate-loaded-shoulder-press'],
    note: '清单第 4 项 · 左右独立挂片臂',
  },
  {
    id: 'chest-press',
    zh: '坐姿推胸机',
    en: 'Chest Press',
    group: 'chest',
    exercises: ['machine-chest-press'],
    note: '清单第 22 项 · 配重块固定轨迹',
  },
  {
    id: 'pec-fly',
    zh: '蝴蝶机 · 夹胸',
    en: 'Pec Fly',
    group: 'chest',
    exercises: ['pec-deck'],
    note: '清单第 21 项 · 胸孤立',
  },
  {
    id: 'rear-delt-fly',
    zh: '反向飞鸟机',
    en: 'Pec Fly · Rear Delt',
    group: 'chest',
    exercises: ['reverse-pec-deck'],
    note: '清单第 7 项 · 两用机的后束方向',
  },
  {
    id: 'lateral-raise',
    zh: '侧平举机',
    en: 'Lateral Raise',
    group: 'chest',
    exercises: ['machine-lateral-raise'],
    note: '清单第 19 项 · 肩中束孤立',
  },

  /* ───────────── 背 ───────────── */
  {
    id: 'lat-pulldown',
    zh: '高位下拉机',
    en: 'Lat Pulldown',
    group: 'back',
    exercises: [
      'lat-pulldown',
      'close-grip-lat-pulldown',
      'wide-grip-lat-pulldown',
      'straight-arm-pulldown',
    ],
    note: '清单第 8 / 18 项 · 同一机型，宽窄握与直臂下压',
  },
  {
    id: 'seated-row',
    zh: '坐姿划船机',
    en: 'Seated Row',
    group: 'back',
    exercises: ['machine-row'],
    note: '清单第 20 项 · 固定轨迹水平拉',
  },
  {
    id: 'dip-chin-assist',
    zh: '引体 / 双杠辅助机',
    en: 'Dip Assist / Chin Assist',
    group: 'back',
    exercises: ['assisted-pullup', 'assisted-chin-up', 'assisted-dip'],
    note: '清单第 17 项 · 助力配重可调',
  },

  /* ───────────── 手臂 · 核心 ───────────── */
  {
    id: 'biceps-curl',
    zh: '二头肌弯举机',
    en: 'Biceps Curl',
    group: 'arm',
    exercises: ['machine-biceps-curl'],
    note: '清单第 15 项 · 上臂固定肘屈',
  },
  {
    id: 'abdominal-crunch',
    zh: '卷腹机',
    en: 'Abdominal Crunch',
    group: 'arm',
    exercises: ['machine-abdominal-crunch'],
    note: '清单第 16 项 · 配重可调躯干屈曲',
  },

  /* ───────────── 腿 · 臀 ───────────── */
  {
    id: 'leg-press',
    zh: '腿举机',
    en: 'Leg Press',
    group: 'leg',
    exercises: ['leg-press'],
    note: '清单第 5 / 10 项 · 同一机型',
  },
  {
    id: 'perfect-squat',
    zh: '完美深蹲机',
    en: 'Perfect Squat',
    group: 'leg',
    exercises: ['perfect-squat'],
    note: '清单第 6 项 · 固定轨迹深蹲',
  },
  {
    id: 'leg-extension',
    zh: '坐姿腿屈伸机',
    en: 'Leg Extension',
    group: 'leg',
    exercises: ['leg-extension'],
    note: '清单第 14 项 · 股四头孤立',
  },
  {
    id: 'prone-leg-curl',
    zh: '俯卧腿弯举机',
    en: 'Prone Leg Curl',
    group: 'leg',
    exercises: ['leg-curl'],
    note: '清单第 9 项 · 腘绳肌孤立',
  },
  {
    id: 'seated-leg-curl',
    zh: '坐姿腿弯举机',
    en: 'Seated Leg Curl',
    group: 'leg',
    exercises: ['seated-leg-curl'],
    note: '清单第 13 项 · 髋屈位拉长腘绳肌',
  },
  {
    id: 'hip-abductor',
    zh: '髋外展机',
    en: 'Hip Abductor',
    group: 'leg',
    exercises: ['hip-abduction'],
    note: '清单第 11 项 · 臀中肌',
  },
  {
    id: 'hip-adductor',
    zh: '髋内收机',
    en: 'Hip Adductor',
    group: 'leg',
    exercises: ['hip-adduction'],
    note: '清单第 12 项 · 内收肌群',
  },
  {
    id: 'rear-kick',
    zh: '后踢腿机',
    en: 'Rear Kick',
    group: 'leg',
    exercises: ['glute-kickback-machine'],
    note: '清单第 2 项 · 髋伸展孤立',
  },

  /* ───────────── 自由重量 / 绳索 / 徒手 ───────────── */
  {
    id: 'cable-crossover',
    zh: '龙门架 · 多功能绳索',
    en: 'Cable Crossover / Functional Trainer',
    group: 'cable',
    exercises: CABLE_IDS,
    note: '清单第 23 项 · 含直杆、绳索、V 把等常规配件',
  },
  {
    id: 'dumbbell',
    zh: '哑铃',
    en: 'Dumbbell',
    group: 'free',
    exercises: DUMBBELL_IDS,
    note: '清单第 24 项 · 默认可用训练凳与地面',
  },
  {
    id: 'barbell',
    zh: '杠铃',
    en: 'Barbell',
    group: 'free',
    exercises: BARBELL_IDS,
    note: '清单第 25 项 · 奥杆与杠铃片；已排除六角杠、地雷管、架上硬拉、下斜凳变体',
  },
  {
    id: 'no-gear',
    zh: '徒手动作',
    en: 'No Equipment',
    group: 'no-gear',
    exercises: NO_GEAR_IDS,
    note: '不占用器械的垫上/核心动作；单杠、双杠、健腹轮类动作不在计划里',
  },
]

export const GYM_EQUIPMENT_MAP = new Map<GymEquipmentId, GymEquipment>(
  GYM_EQUIPMENT.map((item) => [item.id, item]),
)

export const GYM_EQUIPMENT_IDS: ReadonlySet<string> = new Set(
  GYM_EQUIPMENT.map((item) => item.id),
)

/** 默认全选：即用户给出的这份健身房清单 */
export const DEFAULT_GYM_EQUIPMENT: GymEquipmentId[] = GYM_EQUIPMENT.map((item) => item.id)

/** 已勾选器械能完成的动作集合；动作库里不存在的 id 会被忽略 */
export function allowedExerciseIds(selected: readonly GymEquipmentId[]): Set<string> {
  const enabled = new Set<string>(selected)
  const out = new Set<string>()
  for (const item of GYM_EQUIPMENT) {
    if (!enabled.has(item.id)) continue
    for (const id of item.exercises) if (EXERCISE_MAP.has(id)) out.add(id)
  }
  return out
}

/** 某动作由哪些器械提供，用于界面标注 */
export const EXERCISE_GYM_OWNERS: Map<string, GymEquipmentId[]> = (() => {
  const map = new Map<string, GymEquipmentId[]>()
  for (const item of GYM_EQUIPMENT) {
    for (const id of item.exercises) {
      const owners = map.get(id) ?? []
      owners.push(item.id)
      map.set(id, owners)
    }
  }
  return map
})()
