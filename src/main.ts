import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'

const app = createApp(App)

/** 元素进入视口时轻微上浮淡入（尊重 prefers-reduced-motion） */
app.directive('reveal', {
  mounted(el: HTMLElement) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') return
    el.classList.add('reveal')
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          el.classList.add('is-in')
          io.disconnect()
        }
      },
      { threshold: 0, rootMargin: '0px 0px -5% 0px' },
    )
    io.observe(el)
  },
})

app.mount('#app')
