import type { Equipment, EquipmentId } from './types'

export const EQUIPMENT: Equipment[] = [
  {
    id: 'barbell',
    zh: '杠铃',
    en: 'Barbell',
    aliases: ['奥杆', '自由杆', 'barbell', 'BB', '大杆'],
    note: '自由重量之王，可加载最大负荷，适合复合动作。',
  },
  {
    id: 'dumbbell',
    zh: '哑铃',
    en: 'Dumbbell',
    aliases: ['哑铃片', 'db', 'dumbbells', '小哑铃'],
    note: '双侧独立，活动范围大，便于纠正左右力量差。',
  },
  {
    id: 'kettlebell',
    zh: '壶铃',
    en: 'Kettlebell',
    aliases: ['壶铃球', 'kb', 'kettle bell', '炮筒'],
    note: '重心偏离握把，摆荡类动作能训练爆发力与髋铰链。',
  },
  {
    id: 'machine',
    zh: '固定器械',
    en: 'Machine',
    aliases: ['器械', '组合器械', '坐式器械', '固定轨迹', 'gym machine'],
    note: '运动轨迹固定，学习成本低，适合孤立与力竭训练。',
  },
  {
    id: 'cable',
    zh: '绳索',
    en: 'Cable',
    aliases: ['龙门架', '钢索', '拉力器', '绳索器械', 'crossover', 'cable machine'],
    note: '全程恒定张力，角度可调，适合雕刻肌肉细节。',
  },
  {
    id: 'smith',
    zh: '史密斯机',
    en: 'Smith Machine',
    aliases: ['史密斯', 'smitch', '轨道杠铃', '滑轨杠铃'],
    note: '杠铃固定在滑轨上，安全锁便于独自冲大重量。',
  },
  {
    id: 'bodyweight',
    zh: '自重',
    en: 'Bodyweight',
    aliases: ['徒手', '无器械', '自身体重', 'calisthenics', 'bw'],
    note: '无需器械，用体重与杠杆改变难度。',
  },
  {
    id: 'pullup-bar',
    zh: '单杠',
    en: 'Pull-up Bar',
    aliases: ['引体杆', '横杆', 'pullup bar', 'pull up bar'],
    note: '垂直拉的根本，宽窄握距改变发力重心。',
  },
  {
    id: 'dip-bar',
    zh: '双杠',
    en: 'Dip Bar',
    aliases: ['平行杠', '双杠架', 'dip station', 'parallel bars'],
    note: '上肢推的经典自重工具，可负重进阶。',
  },
  {
    id: 'band',
    zh: '弹力带',
    en: 'Resistance Band',
    aliases: ['阻力带', '拉力带', '橡皮筋', 'band', '弹力绳'],
    note: '阻力随拉伸递增，适合热身、康复与居家训练。',
  },
  {
    id: 'suspension',
    zh: '悬吊带',
    en: 'Suspension Trainer',
    aliases: ['TRX', '悬吊', '吊带', '悬挂训练'],
    note: '不稳定支撑迫使核心参与，自重动作可秒调难度。',
  },
  {
    id: 'med-ball',
    zh: '药球',
    en: 'Medicine Ball',
    aliases: ['实心球', '重力球', 'med ball', 'wall ball'],
    note: '可抛掷，用于旋转与爆发力训练。',
  },
  {
    id: 'ab-wheel',
    zh: '健腹轮',
    en: 'Ab Wheel',
    aliases: ['腹肌轮', '滚轮', 'ab roller', '健腹器'],
    note: '抗伸展训练的利器，对核心稳定要求极高。',
  },
]

export const EQUIPMENT_MAP = new Map<EquipmentId, Equipment>(EQUIPMENT.map((e) => [e.id, e]))

export const PATTERN_LABEL = {
  push: '水平/垂直推',
  pull: '水平/垂直拉',
  squat: '蹲',
  hinge: '髋铰链',
  lunge: '单腿',
  carry: '负重行走',
  rotation: '旋转',
  core: '核心',
  isolation: '单关节孤立',
} as const

export const LEVEL_LABEL = {
  1: '入门',
  2: '进阶',
  3: '高阶',
} as const
