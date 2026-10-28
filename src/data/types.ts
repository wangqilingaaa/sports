export type MuscleId =
  | 'sternocleidomastoid'
  | 'trapezius'
  | 'deltoid-anterior'
  | 'deltoid-lateral'
  | 'deltoid-posterior'
  | 'rotator-cuff'
  | 'pectoralis-major'
  | 'serratus-anterior'
  | 'latissimus-dorsi'
  | 'rhomboids'
  | 'erector-spinae'
  | 'teres-major'
  | 'biceps-brachii'
  | 'brachialis'
  | 'triceps-brachii'
  | 'forearm-flexors'
  | 'forearm-extensors'
  | 'rectus-abdominis'
  | 'external-oblique'
  | 'transverse-abdominis'
  | 'iliopsoas'
  | 'gluteus-maximus'
  | 'gluteus-medius'
  | 'adductors'
  | 'quadriceps'
  | 'hamstrings'
  | 'sartorius'
  | 'gastrocnemius'
  | 'soleus'
  | 'tibialis-anterior'

export type Region = 'neck' | 'shoulder' | 'chest' | 'back' | 'arm' | 'core' | 'glute' | 'thigh' | 'calf'

type View = 'front' | 'back'

type Layer = 'superficial' | 'deep'

export type Role = 'primary' | 'secondary' | 'stabilizer'

export interface Muscle {
  id: MuscleId
  zh: string
  en: string
  latin: string
  aliases: string[]
  region: Region
  view: View
  layer: Layer
  /** 主要功能，一句话 */
  action: string
  /** 粗略起止点，用于收缩模型文案 */
  origin: string
  insertion: string
}

export type EquipmentId =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'smith'
  | 'bodyweight'
  | 'pullup-bar'
  | 'dip-bar'
  | 'band'
  | 'suspension'
  | 'med-ball'
  | 'ab-wheel'

export interface Equipment {
  id: EquipmentId
  zh: string
  en: string
  aliases: string[]
  /** 器材介绍 */
  note: string
}

type MovementPattern =
  | 'push'
  | 'pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'carry'
  | 'rotation'
  | 'core'
  /** 单关节孤立（腿屈伸、腿弯举、提踵、髋外展等） */
  | 'isolation'

export interface MuscleHit {
  id: MuscleId
  role: Role
  /** 估算的肌肉激活度 0-100（相对该动作峰值 MVC 的近似值） */
  activation: number
}

export interface Exercise {
  id: string
  zh: string
  en: string
  aliases: string[]
  equipment: EquipmentId
  /** 动作模式 */
  pattern: MovementPattern
  level: 1 | 2 | 3
  /** 关节动作，如「肩关节水平内收」 */
  jointAction: string
  muscles: MuscleHit[]
  /** 动作要领 */
  cues: string[]
  /** 常见错误 */
  mistakes: string[]
  /** 向心 / 离心节奏，单位秒 */
  tempo: [number, number]
  /** 该动作的收缩特点补充说明（缺省时按主动肌自动生成） */
  contractionNote?: string
  /** 是否单侧动作 */
  unilateral?: boolean
}
