import { EXERCISES } from './exercises'
import { EQUIPMENT_MAP, PATTERN_LABEL } from './equipment'
import { MUSCLE_MAP } from './muscles'
import { buildIndex } from './search'

/** 动作库全文索引：名称、别名、拼音、器械、肌群；动作库与计划页换动作共用同一份 */
export const EXERCISE_INDEX = buildIndex(
  EXERCISES.map((ex) => {
    const equip = EQUIPMENT_MAP.get(ex.equipment)!
    const muscles = ex.muscles.map((h) => MUSCLE_MAP.get(h.id)!).filter(Boolean)
    return {
      id: ex.id,
      zh: ex.zh,
      en: ex.en,
      aliases: ex.aliases,
      equipmentText: [equip.zh, equip.en, ...equip.aliases],
      muscleText: muscles.flatMap((mu) => [mu.zh, mu.en, ...mu.aliases.slice(0, 2)]),
      patternText: PATTERN_LABEL[ex.pattern],
    }
  }),
)
