import type { MuscleId } from './types'

/**
 * Écorché 模型的网格名 → 本项目肌群 id 的映射。
 * 名称来自 glTF 节点 extras.name，形如 "Clavicular part of left deltoid"，
 * 先做归一化（去左右、去 (2)、小写），再按精确名匹配，避免把「足部蚓状肌」这类同名词误判。
 */
const RAW: Record<string, MuscleId> = {
  // 颈
  sternocleidomastoid: 'sternocleidomastoid',

  // 肩
  'clavicular part of deltoid': 'deltoid-anterior',
  'acromial part of deltoid': 'deltoid-lateral',
  'spinal part of deltoid': 'deltoid-posterior',
  supraspinatus: 'rotator-cuff',
  infraspinatus: 'rotator-cuff',
  'teres minor': 'rotator-cuff',
  subscapularis: 'rotator-cuff',

  // 背
  'descending part of trapezius': 'trapezius',
  'transverse part of trapezius': 'trapezius',
  'ascending part of trapezius': 'trapezius',
  'latissimus dorsi': 'latissimus-dorsi',
  'rhomboid major': 'rhomboids',
  'rhomboid minor': 'rhomboids',
  'iliocostalis lumborum': 'erector-spinae',
  'iliocostalis thoracis': 'erector-spinae',
  'iliocostalis cervicis': 'erector-spinae',
  'longissimus thoracis': 'erector-spinae',
  'longissimus cervicis': 'erector-spinae',
  'longissimus capitis': 'erector-spinae',
  'spinalis thoracis': 'erector-spinae',
  'teres major': 'teres-major',

  // 胸
  'clavicular part of pectoralis major': 'pectoralis-major',
  'sternocostal part of pectoralis major': 'pectoralis-major',
  'abdominal part of pectoralis major': 'pectoralis-major',
  'serratus anterior': 'serratus-anterior',

  // 手臂
  'long head of biceps brachii': 'biceps-brachii',
  'short head of biceps brachii': 'biceps-brachii',
  brachialis: 'brachialis',
  'long head of triceps brachii': 'triceps-brachii',
  'lateral head of triceps brachii': 'triceps-brachii',
  'medial head of triceps brachii': 'triceps-brachii',

  // 前臂屈肌群
  'flexor carpi radialis': 'forearm-flexors',
  'humeral head of flexor carpi ulnaris': 'forearm-flexors',
  'ulnar head of flexor carpi ulnaris': 'forearm-flexors',
  'flexor digitorum superficialis': 'forearm-flexors',
  'flexor digitorum profundus': 'forearm-flexors',
  'palmaris longus': 'forearm-flexors',
  'humeral head of pronator teres': 'forearm-flexors',
  'ulnar head of pronator teres': 'forearm-flexors',
  'pronator quadratus': 'forearm-flexors',
  'flexor pollicis longus': 'forearm-flexors',
  brachioradialis: 'forearm-flexors',

  // 前臂伸肌群
  'extensor carpi radialis longus': 'forearm-extensors',
  'extensor carpi radialis brevis': 'forearm-extensors',
  'extensor carpi ulnaris': 'forearm-extensors',
  'extensor digitorum': 'forearm-extensors',
  'extensor digiti minimi': 'forearm-extensors',
  'extensor pollicis brevis': 'forearm-extensors',
  'extensor pollicis longus': 'forearm-extensors',
  'extensor indicis': 'forearm-extensors',
  supinator: 'forearm-extensors',
  anconeus: 'forearm-extensors',

  // 核心
  'rectus abdominis': 'rectus-abdominis',
  'external oblique': 'external-oblique',
  'transversus abdominis': 'transverse-abdominis',
  'psoas major': 'iliopsoas',
  iliacus: 'iliopsoas',

  // 臀
  'gluteus maximus': 'gluteus-maximus',
  'gluteus medius': 'gluteus-medius',

  // 腿
  'adductor brevis': 'adductors',
  'adductor longus': 'adductors',
  'adductor magnus': 'adductors',
  'adductor minimus': 'adductors',
  gracilis: 'adductors',
  pectineus: 'adductors',
  'rectus femoris': 'quadriceps',
  'vastus lateralis': 'quadriceps',
  'vastus medialis': 'quadriceps',
  'vastus intermedius': 'quadriceps',
  'long head of biceps femoris': 'hamstrings',
  'short head of biceps femoris': 'hamstrings',
  semitendinosus: 'hamstrings',
  semimembranosus: 'hamstrings',
  sartorius: 'sartorius',
  'lateral head of gastrocnemius': 'gastrocnemius',
  'medial head of gastrocnemius': 'gastrocnemius',
  soleus: 'soleus',
  'tibialis anterior': 'tibialis-anterior',
}

function normalizeStructureName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\((?:2|3)\)/g, ' ')
    .replace(/\b(left|right)\b/g, ' ')
    .replace(/\bmuscle\b/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const NORMALIZED: Record<string, MuscleId> = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [normalizeStructureName(k), v]),
)

export function muscleIdForStructure(raw: string): MuscleId | null {
  return NORMALIZED[normalizeStructureName(raw)] ?? null
}

export const MODEL_ATTRIBUTION = {
  title: 'Écorché · open 3D skeleton & muscles',
  author: 'Charleeh',
  license: 'CC BY-SA 4.0',
  source: 'https://github.com/Charleeh/ecorche',
  upstream: 'BodyParts3D (DBCLS) · Z-Anatomy',
}
