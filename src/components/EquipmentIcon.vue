<script setup lang="ts">
import { computed } from 'vue'
import type { EquipmentId } from '@/data/types'

const props = defineProps<{ id: EquipmentId }>()

const ICONS: Record<EquipmentId, string[]> = {
  barbell: ['M1.5 12h21', 'M4.5 7.5v9', 'M7.5 5.5v13', 'M16.5 5.5v13', 'M19.5 7.5v9'],
  dumbbell: ['M8 12h8', 'M5 8v8', 'M2 10v4', 'M19 8v8', 'M22 10v4'],
  kettlebell: [
    'M9.2 8.4C9.8 6.6 10.8 5.4 12 5.4s2.2 1.2 2.8 3',
    'M12 9c3.3 0 6 2.6 6 5.9S15.3 19.5 12 19.5 6 17.9 6 14.9 8.7 9 12 9z',
    'M9 19.7h6',
  ],
  machine: ['M4 3v18', 'M20 3v18', 'M4 9h16', 'M4 15h6', 'M14 15h6', 'M9 12v6'],
  cable: ['M5 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5', 'M7.5 7C12 9.5 9 13.5 17 17.5', 'M14.5 15h6.5v5.5h-6.5z'],
  smith: ['M6 3v18', 'M18 3v18', 'M3 11h18', 'M4 5.5h2', 'M18 5.5h2'],
  bodyweight: [
    'M12 3.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
    'M12 7.6v6',
    'M12 9.6 7.6 12.6',
    'M12 9.6 16.4 12.6',
    'M12 13.6 9 20',
    'M12 13.6 15 20',
  ],
  'pullup-bar': ['M3 5h18', 'M6 5V2.5', 'M18 5V2.5', 'M9 5v4', 'M15 5v4', 'M9 9h6'],
  'dip-bar': ['M3 5h6', 'M15 5h6', 'M6 5v15', 'M18 5v15', 'M4 20h4', 'M16 20h4'],
  band: ['M3 8c4-4 14-4 18 0', 'M3 8c4 4 14 4 18 0', 'M3 16c4-4 14-4 18 0', 'M3 16c4 4 14 4 18 0'],
  suspension: ['M12 2v5', 'M12 7 6 19', 'M12 7l6 12', 'M3.5 16.5h5', 'M15.5 16.5h5'],
  'med-ball': ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16', 'M5.8 8.4c4 2.4 8.4 2.4 12.4 0', 'M5.8 15.6c4-2.4 8.4-2.4 12.4 0'],
  'ab-wheel': ['M12 7.2a6 6 0 1 0 0 12 6 6 0 0 0 0-12', 'M2.5 13.2h3.5', 'M18 13.2h3.5', 'M12 4.5v2.4'],
}

const paths = computed(() => ICONS[props.id] ?? [])
</script>

<template>
  <svg
    class="equip-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>
