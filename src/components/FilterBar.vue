<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { EQUIPMENT, EQUIPMENT_MAP, LEVEL_LABEL } from '@/data/equipment'
import { MUSCLES, MUSCLE_MAP, REGION_LABEL, REGION_ORDER } from '@/data/muscles'
import { useAtlas } from '@/composables/useAtlas'
import EquipmentIcon from './EquipmentIcon.vue'

const atlas = useAtlas()
const open = ref(false)

const byRegion = REGION_ORDER.map((region) => ({
  region,
  label: REGION_LABEL[region],
  items: MUSCLES.filter((m) => m.region === region),
})).filter((g) => g.items.length > 0)

const levels = [1, 2, 3] as const

const activeCount = computed(
  () =>
    (atlas.query.value.trim() ? 1 : 0) +
    (atlas.equipment.value !== 'all' ? 1 : 0) +
    (atlas.muscleFilter.value ? 1 : 0) +
    (atlas.levelFilter.value !== 0 ? 1 : 0),
)

const muscleName = computed(() =>
  atlas.muscleFilter.value ? MUSCLE_MAP.get(atlas.muscleFilter.value)?.zh ?? '' : '',
)
</script>

<template>
  <button class="filter-toggle" :class="{ 'is-open': open }" @click="open = !open">
    筛选条件
    <b v-if="activeCount">{{ activeCount }} 项生效</b>
    <i><ChevronDown :size="14" :stroke-width="1.75" /></i>
  </button>

  <div class="filters" :class="{ 'is-open': open }">
    <div class="filter-row">
      <span class="filter-key">器械</span>
      <div class="filter-track">
        <button
          class="fchip"
          :class="{ 'is-active': atlas.equipment.value === 'all' }"
          @click="atlas.equipment.value = 'all'"
        >
          全部<i>{{ atlas.totalExercises }}</i>
        </button>
        <button
          v-for="eq in EQUIPMENT"
          :key="eq.id"
          class="fchip"
          :class="{ 'is-active': atlas.equipment.value === eq.id }"
          :title="eq.note"
          @click="atlas.setEquipment(eq.id)"
        >
          <EquipmentIcon :id="eq.id" />
          {{ eq.zh }}
          <i>{{ atlas.equipmentCounts.value[eq.id] ?? 0 }}</i>
        </button>
      </div>
    </div>

    <div class="filter-row">
      <span class="filter-key">肌群</span>
      <div class="filter-track">
        <template v-for="g in byRegion" :key="g.region">
          <span class="filter-sep">{{ g.label }}</span>
          <button
            v-for="m in g.items"
            :key="m.id"
            class="fchip"
            :class="{ 'is-active': atlas.muscleFilter.value === m.id }"
            :title="`${m.en} · ${m.action}`"
            @click="atlas.toggleMuscle(m.id)"
          >
            {{ m.zh }}
            <i>{{ atlas.muscleCounts.value[m.id] ?? 0 }}</i>
          </button>
        </template>
      </div>
    </div>

    <div class="filter-row">
      <span class="filter-key">难度</span>
      <div class="filter-track">
        <button
          v-for="lv in levels"
          :key="lv"
          class="fchip"
          :class="{ 'is-active': atlas.levelFilter.value === lv }"
          @click="atlas.levelFilter.value = atlas.levelFilter.value === lv ? 0 : lv"
        >
          {{ LEVEL_LABEL[lv] }}
        </button>

        <div class="filter-row-tail">
          <span v-if="atlas.hasFilters.value" class="filter-summary">
            <template v-if="muscleName">{{ muscleName }} · </template>
            <template v-if="atlas.equipment.value !== 'all'">
              {{ EQUIPMENT_MAP.get(atlas.equipment.value)?.zh }} · 
            </template>
            <b>{{ atlas.results.value.length }}</b> / {{ atlas.totalExercises }} 个动作
          </span>
          <button v-if="atlas.hasFilters.value" class="filter-reset" @click="atlas.resetFilters()">
            清除全部
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
