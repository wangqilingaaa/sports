const PINYIN: Record<string, string> = {
  杠: 'gang', 铃: 'ling', 卧: 'wo', 推: 'tui', 平: 'ping', 板: 'ban', 坐: 'zuo', 姿: 'zi',
  腿: 'tui', 举: 'ju', 蝴: 'hu', 蝶: 'die', 机: 'ji', 夹: 'jia', 胸: 'xiong', 俯: 'fu',
  弯: 'wan', 器: 'qi', 械: 'xie', 肩: 'jian', 髋: 'kuan', 外: 'wai', 展: 'zhan', 站: 'zhan',
  提: 'ti', 踵: 'zhong', 绳: 'sheng', 索: 'suo', 高: 'gao', 位: 'wei', 下: 'xia', 拉: 'la',
  划: 'hua', 船: 'chuan', 面: 'mian', 压: 'ya', 直: 'zhi', 臂: 'bi', 跪: 'gui', 卷: 'juan',
  腹: 'fu', 史: 'shi', 密: 'mi', 斯: 'si', 深: 'shen', 蹲: 'dun', 单: 'dan', 壶: 'hu',
  摆: 'bai', 荡: 'dang', 脚: 'jiao', 杯: 'bei', 农: 'nong', 夫: 'fu', 行: 'xing', 走: 'zou',
  徒: 'tu', 手: 'shou', 撑: 'cheng', 反: 'fan', 向: 'xiang', 臀: 'tun', 桥: 'qiao', 支: 'zhi',
  侧: 'ce', 北: 'bei', 欧: 'ou', 挺: 'ting', 靠: 'kao', 墙: 'qiang', 静: 'jing', 引: 'yin',
  体: 'ti', 上: 'shang', 胛: 'jia', 悬: 'xuan', 垂: 'chui', 双: 'shuang', 屈: 'qu',
  伸: 'shen', 弹: 'tan', 力: 'li', 带: 'dai', 开: 'kai', 后: 'hou', 踢: 'ti', 吊: 'diao',
  箭: 'jian', 步: 'bu', 药: 'yao', 球: 'qiu', 砸: 'za', 地: 'di', 俄: 'e', 罗: 'luo',
  转: 'zhuan', 健: 'jian', 轮: 'lun', 半: 'ban', 程: 'cheng', 出: 'chu', 前: 'qian',
  马: 'ma', 尼: 'ni', 亚: 'ya', 哑: 'ya', 飞: 'fei', 鸟: 'niao', 身: 'shen', 锤: 'chui',
  式: 'shi', 集: 'ji', 保: 'bao', 加: 'jia', 利: 'li', 分: 'fen', 耸: 'song', 内: 'nei',
  收: 'shou', 中: 'zhong', 束: 'shu',
  斜: 'xie', 倒: 'dao', 蹬: 'deng', 哈: 'ha', 克: 'ke', 低: 'di', 过: 'guo', 顶: 'ding',
  握: 'wo', 腕: 'wan', 伐: 'fa', 木: 'mu', 牧: 'mu', 师: 'shi', 椅: 'yi', 助: 'zhu',
}

function toPinyin(input: string): string {
  return [...input].map((c) => PINYIN[c] ?? c).join('')
}

function toInitials(input: string): string {
  return [...input].map((c) => (PINYIN[c] ?? c).charAt(0)).join('')
}

/** 归一化：小写、去空格与标点，兼容全角 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[·・.,，。、\-_/\\|()[\]{}'"“”‘’：:；;!！?？+&@#*%^~`]/g, '')
}

interface IndexEntry {
  id: string
  fields: Array<{ text: string; weight: number }>
  tokens: string[]
  /** 逐字音节，用于避免「跨音节」误匹配（如 fu-wotui ≠ wo-tui） */
  syllables: string[]
}

interface IndexSource {
  id: string
  zh: string
  en: string
  aliases: string[]
  equipmentText: string[]
  muscleText: string[]
  patternText: string
}

const W = {
  zh: 1,
  en: 0.95,
  alias: 0.8,
  pinyin: 0.62,
  initials: 0.5,
  equipment: 0.36,
  muscle: 0.4,
  pattern: 0.2,
}

export function buildIndex(sources: IndexSource[]): IndexEntry[] {
  return sources.map((s) => {
    const fields: Array<{ text: string; weight: number }> = []
    const push = (text: string, weight: number) => {
      const n = normalize(text)
      if (n) fields.push({ text: n, weight })
    }
    push(s.zh, W.zh)
    push(s.en, W.en)
    s.aliases.forEach((a) => push(a, W.alias))
    push(toPinyin(s.zh), W.pinyin)
    push(toInitials(s.zh), W.initials)
    s.aliases.forEach((a) => {
      if (/^[a-z]/i.test(normalize(a))) push(a, W.alias * 0.9)
    })
    s.equipmentText.forEach((t) => push(t, W.equipment))
    s.muscleText.forEach((t) => push(t, W.muscle))
    push(s.patternText, W.pattern)

    const tokens = new Set<string>()
    fields.forEach((f) => tokens.add(f.text))
    const syllables = [...s.zh].map((ch) => PINYIN[ch]).filter(Boolean) as string[]
    return { id: s.id, fields, tokens: [...tokens], syllables }
  })
}

function scoreField(field: string, q: string): number {
  if (field === q) return 1
  if (field.startsWith(q)) return 0.86
  if (field.includes(q)) return 0.68
  // 缩写 / 首字母：允许 q 为字段首字母序列的前缀
  if (q.length >= 2 && initialsOf(field).startsWith(q)) return 0.4
  return 0
}

function initialsOf(field: string): string {
  return field
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0))
    .join('')
}

/** 仅允许整音节拼接命中：wo+tui 命中 wotui，fu+wo+tui 不会命中 wotui */
function matchSyllables(syl: string[], q: string): number {
  if (!syl.length || !q) return 0
  for (let i = 0; i < syl.length; i++) {
    let acc = ''
    for (let j = i; j < syl.length; j++) {
      acc += syl[j]
      if (acc === q) return 1
      if (acc.length >= q.length) break
    }
  }
  return 0
}

/** 多关键词 AND 匹配，返回按相关度排序的 id → 分数 */
export function searchIndex(index: IndexEntry[], rawQuery: string): Map<string, number> {
  const result = new Map<string, number>()
  const q = normalize(rawQuery)
  if (!q) return result

  const terms = rawQuery
    .trim()
    .split(/[\s\u3000]+/)
    .map(normalize)
    .filter(Boolean)

  const groups = terms.length ? terms : [q]

  for (const entry of index) {
    let total = 0
    let matchedAll = true
    for (const term of groups) {
      let best = matchSyllables(entry.syllables, term) * 0.66
      for (const f of entry.fields) {
        const s = scoreField(f.text, term) * f.weight
        if (s > best) best = s
      }
      if (best <= 0) {
        matchedAll = false
        break
      }
      total += best
    }
    if (!matchedAll) continue
    // 整串命中额外加分（例如「卧推」同时命中 zh 与 pinyin）
    const whole = scoreField(normalize(entry.fields[0].text), q)
    result.set(entry.id, total / groups.length + whole * 0.25)
  }
  return result
}
