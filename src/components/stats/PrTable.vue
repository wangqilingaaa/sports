<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDate, type PrLift } from '@/composables/useTrainingStats'

const props = withDefaults(defineProps<{ prs: PrLift[]; goalIds?: string[] }>(), {
  goalIds: () => [],
})

const expanded = ref(false)

const shown = computed(() => (expanded.value ? props.prs : props.prs.slice(0, 8)))
</script>

<template>
  <div class="stats-pr">
    <div class="stats-pr-head">
      <span>全量历史 · 不受时间范围影响</span>
      <span v-if="prs.length">{{ prs.length }} 个负重动作</span>
    </div>

    <div v-if="!prs.length" class="stats-chart-empty">还没有负重记录；自重动作不计入 PR。</div>

    <template v-else>
      <table class="stats-table">
        <thead>
          <tr>
            <th>动作</th>
            <th>最佳 e1RM</th>
            <th>最重单组</th>
            <th>最近</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in shown" :key="row.id">
            <td class="stats-table-name">
              {{ row.zh }}
              <span v-if="goalIds.includes(row.id)" class="stats-goal-tag">目标</span>
              <span>{{ row.entries }} 条记录</span>
            </td>
            <td>
              <b>{{ row.bestE1rm.value }}</b> kg
              <span>{{ row.bestE1rm.weight }} kg × {{ row.bestE1rm.reps }}</span>
            </td>
            <td>
              <b>{{ row.bestWeight.weight }}</b> kg
              <span>{{ row.bestWeight.reps }} 次</span>
            </td>
            <td>{{ formatDate(row.lastAt) }}</td>
          </tr>
        </tbody>
      </table>

      <button v-if="prs.length > 8" class="stats-more" @click="expanded = !expanded">
        {{ expanded ? '收起' : `显示全部 ${prs.length} 项` }}
      </button>
    </template>
  </div>
</template>
