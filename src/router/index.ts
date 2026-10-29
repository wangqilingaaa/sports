import { createRouter, createWebHistory } from 'vue-router'
import AtlasView from '@/views/AtlasView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'atlas', component: AtlasView },
    { path: '/plan', name: 'plan', component: () => import('@/views/TrainingPlanView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    // 只改筛选参数时保持阅读位置，别把用户拽回顶部或锚点
    if (to.path === from.path && to.hash === from.hash) return false
    if (to.hash) {
      const target = document.querySelector(to.hash)
      if (target) {
        // scrollBehavior 不认 CSS scroll-margin-top，这里手动让出固定顶栏的高度
        const topbar = document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0
        const top = target.getBoundingClientRect().top + window.scrollY - topbar
        return { top: Math.max(0, top), behavior: 'smooth' }
      }
      return { el: to.hash, behavior: 'smooth' }
    }
    // 跨页切换用即时归顶：全局 scroll-behavior: smooth 会让长页面停在中途
    return { top: 0, behavior: 'instant' }
  },
})

export default router
