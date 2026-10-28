<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useAtlas } from '@/composables/useAtlas'
import { useContraction } from '@/composables/useContraction'
import { addAnatomyLights, useAnatomyModel } from '@/composables/useAnatomyModel'
import { MUSCLE_MAP, ROLE_LABEL } from '@/data/muscles'
import { MODEL_ATTRIBUTION } from '@/data/model-mapping'
import type { MuscleId, Role } from '@/data/types'

const atlas = useAtlas()
const { c: contraction } = useContraction()
const { load, progress, failed } = useAnatomyModel()

const host = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const activeView = ref<'front' | 'back' | 'side' | ''>('front')

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let rafId = 0
let rafId2 = 0
let observer: ResizeObserver | null = null
let camAnim: { from: THREE.Spherical; to: THREE.Spherical; t: number } | null = null
let lastFlex = -1
let pendingPick = false
let baseRadius = 3.4
let mountedAt = 0

interface MeshEntry {
  mesh: THREE.Mesh
  id: MuscleId | null
  base: THREE.Material | THREE.Material[]
  pivot: THREE.Group | null
  role: Role | 'coverage' | null
}

const entries: MeshEntry[] = []
let flexEntries: MeshEntry[] = []
let pickables: THREE.Mesh[] = []
const byMesh = new WeakMap<THREE.Object3D, MeshEntry>()

const MATERIALS = {
  primary: new THREE.MeshStandardMaterial({
    color: 0xb23a2b,
    roughness: 0.42,
    metalness: 0.02,
    emissive: new THREE.Color(0x7d2114),
    emissiveIntensity: 0.45,
  }),
  secondary: new THREE.MeshStandardMaterial({
    color: 0xcf8038,
    roughness: 0.45,
    metalness: 0.02,
    emissive: new THREE.Color(0x8a4d16),
    emissiveIntensity: 0.3,
  }),
  stabilizer: new THREE.MeshStandardMaterial({
    color: 0x6e948b,
    roughness: 0.5,
    metalness: 0.02,
    emissive: new THREE.Color(0x2f4a44),
    emissiveIntensity: 0.24,
  }),
  coverage: new THREE.MeshStandardMaterial({
    color: 0xc4695a,
    roughness: 0.5,
    metalness: 0.02,
    emissive: new THREE.Color(0x6f2f24),
    emissiveIntensity: 0.22,
  }),
  hover: new THREE.MeshStandardMaterial({
    color: 0xd8ab97,
    roughness: 0.55,
    metalness: 0.02,
    emissive: new THREE.Color(0x7a3f2e),
    emissiveIntensity: 0.28,
  }),
  dim: new THREE.MeshStandardMaterial({ color: 0xe2d7c8, roughness: 0.95, metalness: 0 }),
} as const

/* ── 场景 ── */
function initScene(el: HTMLElement) {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  el.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40)
  camera.position.set(0, 0.9, 3.4)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.9, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 1.2
  controls.maxDistance = 6
  controls.minPolarAngle = 0.35
  controls.maxPolarAngle = Math.PI - 0.35
  controls.addEventListener('start', () => {
    camAnim = null
    activeView.value = ''
  })

  addAnatomyLights(scene)

  // 脚下接触阴影
  const cv = document.createElement('canvas')
  cv.width = cv.height = 256
  const ctx = cv.getContext('2d')!
  const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 126)
  grad.addColorStop(0, 'rgba(86, 58, 42, 0.28)')
  grad.addColorStop(0.55, 'rgba(86, 58, 42, 0.1)')
  grad.addColorStop(1, 'rgba(86, 58, 42, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(cv),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.002
  scene.add(shadow)

  resize()
  observer = new ResizeObserver(resize)
  observer.observe(el)
  rafId = requestAnimationFrame(loop)
}

function resize() {
  const el = host.value
  if (!el || !renderer || !camera) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

/** 按包围盒把整具人体框满画面 */
function frameModel(root: THREE.Object3D) {
  if (!camera || !controls) return
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const vertical = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
  const horizontal = size.x / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect)
  const dist = Math.max(vertical, horizontal) * 1.02
  baseRadius = dist
  camera.position.set(center.x, center.y, center.z + dist)
  controls.target.copy(center)
  controls.update()
}

/** 切到指定观察角度（沿球面插值，保留当前缩放） */
function viewTo(theta: number, key: 'front' | 'back' | 'side') {
  if (!camera || !controls) return
  activeView.value = key
  const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
  let delta = theta - from.theta
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  camAnim = { from, to: new THREE.Spherical(from.radius, Math.PI / 2, from.theta + delta), t: 0 }
}

function loop() {
  rafId = requestAnimationFrame(loop)
  if (!renderer || !scene || !camera || !controls) return

  // 沿球面插值，避免正面↔背面切换时穿过人体
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + 0.11)
    const e = 1 - Math.pow(1 - camAnim.t, 3)
    const sph = new THREE.Spherical(
      THREE.MathUtils.lerp(camAnim.from.radius, camAnim.to.radius, e),
      THREE.MathUtils.lerp(camAnim.from.phi, camAnim.to.phi, e),
      THREE.MathUtils.lerp(camAnim.from.theta, camAnim.to.theta, e),
    )
    camera.position.copy(new THREE.Vector3().setFromSpherical(sph).add(controls.target))
    if (camAnim.t >= 1) camAnim = null
  }
  controls.update()

  // 主动肌随收缩相位轻微隆起
  const flex = 1 + 0.055 * contraction.value
  if (Math.abs(flex - lastFlex) > 0.0008) {
    lastFlex = flex
    for (const e of flexEntries) e.pivot?.scale.setScalar(flex)
  }

  renderer.render(scene, camera)
}

/* ── 载入 ── */
async function buildModel() {
  try {
    const { scene: root, muscles: meshes } = await load()
    if (!scene) return

    for (const item of meshes) {
      const mesh = item.mesh
      let pivot: THREE.Group | null = null
      const parent = mesh.parent

      if (parent) {
        const box = new THREE.Box3().setFromObject(mesh)
        if (!box.isEmpty()) {
          const centerWorld = box.getCenter(new THREE.Vector3())
          const centerLocal = parent.worldToLocal(centerWorld.clone())
          pivot = new THREE.Group()
          pivot.position.copy(centerLocal)
          parent.add(pivot)
          mesh.position.sub(centerLocal)
          pivot.add(mesh)
        }
      }

      const entry: MeshEntry = { mesh, id: item.id, base: item.base, pivot, role: null }
      entries.push(entry)
      byMesh.set(mesh, entry)
      if (item.id) pickables.push(mesh)
    }

    scene.add(root)
    frameModel(root)
    refreshMaterials()
    focusView()
    loading.value = false
  } catch {
    loading.value = false
  }
}

/* ── 高亮 ── */
function refreshMaterials() {
  const hl = atlas.highlight.value
  const dimmed = !!atlas.activeExercise.value
  const hovered = atlas.hoveredMuscle.value
  flexEntries = []

  for (const e of entries) {
    const hit = e.id ? hl.get(e.id) : undefined
    let mat: THREE.Material | THREE.Material[] = e.base
    e.role = null

    if (hit) {
      mat = MATERIALS[hit.role]
      e.role = hit.role
      if (hit.role === 'primary' && e.pivot) flexEntries.push(e)
    } else if (dimmed) {
      mat = MATERIALS.dim
    } else if (e.id && hovered === e.id) {
      mat = MATERIALS.hover
    }

    if (e.mesh.material !== mat) e.mesh.material = mat
    if (e.pivot && e.role !== 'primary') e.pivot.scale.setScalar(1)
  }
  lastFlex = -1
}

/* ── 交互 ── */
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let downX = 0
let downY = 0

function pointerFromEvent(e: PointerEvent) {
  if (!renderer) return
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
}

function onPointerMove(e: PointerEvent) {
  pointerFromEvent(e)
  pendingPick = true
}

function onPointerLeave() {
  atlas.hoveredMuscle.value = null
}

function onPointerDown(e: PointerEvent) {
  downX = e.clientX
  downY = e.clientY
}

function onPointerUp(e: PointerEvent) {
  if (!camera || e.button !== 0) return
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
  pointerFromEvent(e)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(pickables, false)[0]
  const entry = hit ? byMesh.get(hit.object) : undefined
  if (entry?.id) atlas.toggleMuscle(entry.id)
  // 点空白处放弃当前动作，模型回到肌群/筛选高亮
  else if (atlas.selectedId.value) atlas.clearSelection()
}

function pickHover() {
  if (!camera || !renderer) return
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(pickables, false)[0]
  const entry = hit ? byMesh.get(hit.object) : undefined
  const id = entry?.id ?? null
  if (id !== atlas.hoveredMuscle.value) atlas.hoveredMuscle.value = id
  renderer.domElement.style.cursor = id ? 'pointer' : 'grab'
}

/* ── 读数 ── */
const hoveredMuscle = computed(() =>
  atlas.hoveredMuscle.value ? MUSCLE_MAP.get(atlas.hoveredMuscle.value) ?? null : null,
)

const hoveredHit = computed(() =>
  atlas.hoveredMuscle.value ? atlas.highlight.value.get(atlas.hoveredMuscle.value) ?? null : null,
)

const readout = computed(() => {
  const m = hoveredMuscle.value
  if (m) {
    const hit = hoveredHit.value
    return {
      zh: m.zh,
      en: m.en,
      tag: hit ? (hit.role === 'coverage' ? '筛选中' : ROLE_LABEL[hit.role]) : '本动作未参与',
      metric: hit?.activation ? `${hit.activation}% 激活` : '—',
      tone: hit?.role ?? 'none',
    }
  }
  const ex = atlas.activeExercise.value
  if (ex) {
    const primary = ex.muscles
      .filter((h) => h.role === 'primary')
      .map((h) => MUSCLE_MAP.get(h.id)?.zh)
      .filter(Boolean)
    const act = ex.muscles.find((h) => h.role === 'primary')?.activation
    return {
      zh: primary.join(' · ') || '目标肌群',
      en: ex.en,
      tag: '主动肌',
      metric: act ? `${act}% 激活` : '—',
      tone: 'primary',
    }
  }
  const filterId = atlas.muscleFilter.value
  if (filterId) {
    const mu = MUSCLE_MAP.get(filterId)
    if (mu) {
      const n = atlas.muscleCounts.value[filterId] ?? 0
      return { zh: mu.zh, en: mu.en, tag: '筛选中的肌群', metric: `${n} 个动作`, tone: 'coverage' }
    }
  }
  return {
    zh: '全身肌群',
    en: 'Drag to rotate · scroll to zoom',
    tag: '',
    metric: '拖动旋转 · 点击肌群',
    tone: 'none',
  }
})

const toneColor = computed(() => {
  switch (readout.value.tone) {
    case 'primary':
    case 'coverage':
      return 'var(--accent)'
    case 'secondary':
      return 'var(--amber)'
    case 'stabilizer':
      return 'var(--teal)'
    default:
      return 'var(--ink-3)'
  }
})

watch(
  () => [atlas.highlight.value, atlas.hoveredMuscle.value, atlas.activeExercise.value],
  () => refreshMaterials(),
)

/** 把镜头转到主动肌所在的一侧（正面 / 背面） */
function focusView() {
  const ex = atlas.activeExercise.value
  if (!ex || !camera || !controls) return
  const primaries = ex.muscles.filter((h) => h.role === 'primary')
  if (!primaries.length) return
  const back = primaries.filter((h) => MUSCLE_MAP.get(h.id)?.view === 'back').length
  const theta = back > primaries.length / 2 ? Math.PI : 0
  activeView.value = theta === Math.PI ? 'back' : 'front'
  const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
  let delta = theta - from.theta
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  const to = new THREE.Spherical(baseRadius, Math.PI / 2, from.theta + delta)

  if (performance.now() - mountedAt < 2500) {
    camera.position.copy(new THREE.Vector3().setFromSpherical(to).add(controls.target))
    camAnim = null
    controls.update()
  } else {
    camAnim = { from, to, t: 0 }
  }
}

watch(() => atlas.selectedId.value, focusView)

onMounted(() => {
  if (!host.value) return
  mountedAt = performance.now()
  try {
    initScene(host.value)
  } catch {
    loading.value = false
    return
  }

  const el = renderer?.domElement
  el?.addEventListener('pointermove', onPointerMove)
  el?.addEventListener('pointerleave', onPointerLeave)
  el?.addEventListener('pointerdown', onPointerDown)
  el?.addEventListener('pointerup', onPointerUp)

  const tick = () => {
    if (pendingPick) {
      pendingPick = false
      pickHover()
    }
    rafId2 = requestAnimationFrame(tick)
  }
  rafId2 = requestAnimationFrame(tick)

  buildModel()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  cancelAnimationFrame(rafId2)
  observer?.disconnect()
  const el = renderer?.domElement
  el?.removeEventListener('pointermove', onPointerMove)
  el?.removeEventListener('pointerleave', onPointerLeave)
  el?.removeEventListener('pointerdown', onPointerDown)
  el?.removeEventListener('pointerup', onPointerUp)
  controls?.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
  for (const m of Object.values(MATERIALS)) m.dispose()
  renderer = null
  scene = null
  camera = null
  controls = null
})
</script>

<template>
  <div class="hero-stage" :class="{ 'is-docked': !!atlas.muscleFilter.value }">
    <div ref="host" class="hero-canvas">
      <div v-if="loading" class="stage-loading">
        <div class="loading-label">载入三维解剖模型</div>
        <div class="loading-track"><i :style="{ width: progress + '%' }"></i></div>
        <div class="loading-num">{{ failed ? '加载失败，请检查模型文件' : progress + '%' }}</div>
      </div>
    </div>

    <div class="stage-views">
      <button class="view-btn" :class="{ 'is-active': activeView === 'front' }" @click="viewTo(0, 'front')">
        正面
      </button>
      <button class="view-btn" :class="{ 'is-active': activeView === 'side' }" @click="viewTo(Math.PI / 2, 'side')">
        侧面
      </button>
      <button class="view-btn" :class="{ 'is-active': activeView === 'back' }" @click="viewTo(Math.PI, 'back')">
        背面
      </button>
    </div>

    <div class="stage-legend">
      <span class="legend-item"><i class="legend-dot" style="background: var(--accent)"></i>主动肌</span>
      <span class="legend-item"><i class="legend-dot" style="background: #d4803c"></i>协同肌</span>
      <span class="legend-item"><i class="legend-dot" style="background: #6e948b"></i>稳定肌</span>
    </div>

    <div class="stage-readout">
      <span class="readout-name">{{ readout.zh }}</span>
      <span class="readout-en">{{ readout.en }}</span>
      <div class="readout-foot">
        <span v-if="readout.tag" class="readout-tag" :style="{ color: toneColor }">{{ readout.tag }}</span>
        <span class="readout-metric">{{ readout.metric }}</span>
      </div>
    </div>

    <a class="stage-credit" :href="MODEL_ATTRIBUTION.source" target="_blank" rel="noreferrer">
      Écorché · CC BY-SA 4.0
    </a>

    <!-- 肌群动作浮层（App 注入），贴在本舞台右侧 -->
    <slot />
  </div>
</template>
