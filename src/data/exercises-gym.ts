import type { Exercise, MuscleHit, MuscleId, Role } from './types'

const m = (id: MuscleId, role: Role, activation: number): MuscleHit => ({ id, role, activation })

/**
 * 健身房器械清单专属动作。
 *
 * 这些动作对应的是「具体机型」而不是通用器械类别（例如挂片式推胸机与坐姿推胸器
 * 是两台不同的机器），动作库原有的条目无法准确代表它们，因此单独补齐。
 * 演示帧复用轨迹最接近的已有素材，登记见 src/data/demo-map.ts。
 */
export const GYM_EXERCISES: Exercise[] = [
  {
    id: 'plate-loaded-chest-press',
    zh: '挂片式推胸',
    en: 'Plate-Loaded Chest Press',
    aliases: ['挂片推胸', '挂片式推胸机', 'plate loaded chest press', '挂片推胸器'],
    equipment: 'machine',
    pattern: 'push',
    level: 2,
    jointAction: '肩关节水平内收 · 伸肘',
    muscles: [
      m('pectoralis-major', 'primary', 91),
      m('deltoid-anterior', 'secondary', 64),
      m('triceps-brachii', 'secondary', 62),
      m('serratus-anterior', 'stabilizer', 34),
    ],
    cues: ['把座椅调到握把与胸中部齐平', '肩胛后缩贴住靠背，推起时不要送肩', '离心放到胸大肌有拉伸感即停，别让配重落回'],
    mistakes: ['座位过低变成下斜推，肩前侧被挤压', '肘部完全锁死把张力卸到关节上', '左右手不同步，挂片侧受力不均'],
    tempo: [1.2, 2.4],
    contractionNote:
      '挂片机左右两侧独立运动，轨迹略带收敛：胸大肌在向心末段被充分缩短，离心时配重臂把肩水平外展拉开，单侧力量差会直接暴露出来。',
  },
  {
    id: 'plate-loaded-shoulder-press',
    zh: '挂片式推肩',
    en: 'Plate-Loaded Shoulder Press',
    aliases: ['挂片推肩', '挂片式推肩机', 'plate loaded shoulder press'],
    equipment: 'machine',
    pattern: 'push',
    level: 2,
    jointAction: '肩关节外展与屈曲 · 伸肘',
    muscles: [
      m('deltoid-anterior', 'primary', 88),
      m('deltoid-lateral', 'secondary', 68),
      m('triceps-brachii', 'secondary', 60),
      m('pectoralis-major', 'secondary', 42),
      m('rotator-cuff', 'stabilizer', 30),
    ],
    cues: ['握把与耳朵齐平，坐下后先收紧核心', '推到顶端不锁肘，保持三角肌持续张力', '下放到耳侧即可，别让肩关节过度后伸'],
    mistakes: ['腰部反弓用上胸顶重量', '握距过窄把动作变成窄推', '下放过深，肩前侧被反复牵拉'],
    tempo: [1.2, 2.4],
    contractionNote:
      '独立挂片臂让两侧肩各自承担负荷，三角肌前束在向心阶段缩短、中束负责维持外展角度；离心阶段两束同时被拉长，是肩部围度最有效的刺激段。',
  },
  {
    id: 'perfect-squat',
    zh: '完美深蹲机',
    en: 'Perfect Squat Machine',
    aliases: ['完美深蹲', '深蹲机', 'perfect squat', '蹬地深蹲机'],
    equipment: 'machine',
    pattern: 'squat',
    level: 1,
    jointAction: '髋膝踝三关节屈伸（躯干近直立）',
    muscles: [
      m('quadriceps', 'primary', 88),
      m('gluteus-maximus', 'primary', 78),
      m('hamstrings', 'secondary', 48),
      m('adductors', 'secondary', 40),
      m('erector-spinae', 'stabilizer', 32),
    ],
    cues: ['背贴靠垫、双脚踩满踏板，膝盖对准脚尖', '下蹲到能保持腰椎中立的最大幅度', '用脚掌整体蹬起，别用脚尖把配重顶出去'],
    mistakes: ['臀部离开靠垫，腰椎承受剪切力', '膝盖内扣', '只做半程，股四头从未被充分拉长'],
    tempo: [1.4, 2.4],
    contractionNote:
      '固定轨迹把躯干角度锁定，股四头肌在离心下蹲时被拉长并持续承重，向心蹬起时与臀大肌一起缩短；因为省去了躯干稳定成本，膝盖不适时比自由深蹲更容易控制负荷。',
  },
  {
    id: 'machine-biceps-curl',
    zh: '二头肌弯举机',
    en: 'Machine Biceps Curl',
    aliases: ['二头弯举机', '器械弯举', '坐姿弯举机', 'biceps curl machine', 'machine curl'],
    equipment: 'machine',
    pattern: 'isolation',
    level: 1,
    jointAction: '肘关节屈曲（上臂固定）',
    muscles: [
      m('biceps-brachii', 'primary', 92),
      m('brachialis', 'secondary', 64),
      m('forearm-flexors', 'stabilizer', 36),
    ],
    cues: ['把肘关节对准转轴，上臂全程贴住垫子', '顶峰停一拍再慢慢放回', '回放接近伸直时保留张力，不让配重落底'],
    mistakes: ['抬肘借力，把弯举变成肩屈', '靠身体后仰甩起重量', '手腕过度屈曲代偿前臂'],
    tempo: [1.1, 2.4],
    contractionNote:
      '上臂被垫子固定后，肱二头肌无法借肩屈助力，全程张力都落在肘屈上；器械的凸轮还能在顶峰附近保持负荷，离心段被拉长时张力不衰减。',
  },
  {
    id: 'machine-abdominal-crunch',
    zh: '卷腹机',
    en: 'Machine Abdominal Crunch',
    aliases: ['器械卷腹', '坐姿卷腹机', 'ab crunch machine', '腹肌训练机'],
    equipment: 'machine',
    pattern: 'core',
    level: 1,
    jointAction: '脊柱屈曲（抗髋屈代偿）',
    muscles: [
      m('rectus-abdominis', 'primary', 90),
      m('external-oblique', 'secondary', 56),
      m('transverse-abdominis', 'secondary', 48),
      m('iliopsoas', 'secondary', 34),
    ],
    cues: ['调好配重与转轴，胸口贴住垫子', '用腹肌把肋骨往骨盆方向卷，而不是把头往前拽', '回放时控制配重，别让躯干被拉回去'],
    mistakes: ['双手抱头用力拉颈部', '靠髋屈肌把上身拽起来', '幅度过大导致腰椎反复屈伸'],
    tempo: [1.2, 2.2],
    contractionNote:
      '卷腹机把阻力直接加到躯干屈曲上，腹直肌向心时缩短并让胸廓靠近骨盆，离心时在被拉长状态下继续承受配重，比徒手卷腹更容易量化渐进超负荷。',
  },
]
