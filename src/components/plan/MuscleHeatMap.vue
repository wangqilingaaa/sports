<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { addAnatomyLights, useAnatomyModel } from '@/composables/useAnatomyModel'
import { HEAT_TIERS, heatTier } from '@/data/training-plan'
import { MUSCLE_MAP } from '@/data/muscles'
import type { MuscleId } from '@/data/types'

const props = defineProps<{
  /** 每块肌群的有效训练组数 */
  scores: Partial<Record<MuscleId, number>>
}>()

const { load, progress, failed } = useAnatomyModel()

const host = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const activeView = ref<'front' | 'back' | 'side' | ''>('front')
const hoveredId = ref<MuscleId | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let root: THREE.Object3D | null = null
let rafId = 0
let rafId2 = 0
let observer: ResizeObserver | null = null
let camAnim: { from: THREE.Spherical; to: THREE.Spherical; t: number } | null = null
let baseRadius = 3.2
let pendingPick = false

interface HeatEntry {
  mesh: THREE.Mesh
  id: MuscleId | null
}

const entries: HeatEntry[] = []
const pickables: THREE.Mesh[] = []
const byMesh = new WeakMap<THREE.Object3D, HeatEntry>()

/* 每档强度一套材质：顶点色只留给静息态，热区用纯色 + 自发光更易读 */
const restMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.66,
  metalness: 0,
})
const restHoverMat = new THREE.MeshStandardMaterial({
  color: 0xd8c9b6,
  vertexColors: true,
  roughness: 0.58,
  metalness: 0,
  emissive: new THREE.Color(0x6b5744),
  emissiveIntensity: 0.24,
})
const tierMats = HEAT_TIERS.map(
  (t) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(t.color),
      roughness: 0.46,
      metalness: 0.03,
      emissive: new THREE.Color(t.emissive),
      emissiveIntensity: t.intensity,
    }),
)
const tierHoverMats = HEAT_TIERS.map(
  (t) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(t.color).offsetHSL(0, 0.02, 0.08),
      roughness: 0.34,
      metalness: 0.03,
      emissive: new THREE.Color(t.emissive),
      emissiveIntensity: t.intensity + 0.24,
    }),
)

function tierIndex(score: number): number {
  if (score <= 0.15) return -1
  let idx = 0
  HEAT_TIERS.forEach((t, i) => {
    if (score >= t.min) idx = i
  })
  return idx
}

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
  renderer.domElement.style.touchAction = 'none'
  el.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40)
  camera.position.set(0, 0.9, 3.2)

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

  const cv = document.createElement('canvas')
  cv.width = cv.height = 256
  const ctx = cv.getContext('2d')!
  const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 126)
  grad.addColorStop(0, 'rgba(86, 58, 42, 0.26)')
  grad.addColorStop(0.55, 'rgba(86, 58, 42, 0.09)')
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

function frameModel(model: THREE.Object3D) {
  if (!camera || !controls) return
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const vertical = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
  const horizontal =
    size.x / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect)
  const dist = Math.max(vertical, horizontal) * 1.02
  baseRadius = dist
  camera.position.set(center.x, center.y, center.z + dist)
  controls.target.copy(center)
  controls.minDistance = dist * 0.45
  controls.maxDistance = dist * 1.9
  controls.update()
}

function viewTo(theta: number, key: 'front' | 'back' | 'side') {
  if (!camera || !controls) return
  activeView.value = key
  const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
  let delta = theta - from.theta
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  camAnim = { from, to: new THREE.Spherical(baseRadius, Math.PI / 2, from.theta + delta), t: 0 }
}

function loop() {
  rafId = requestAnimationFrame(loop)
  if (!renderer || !scene || !camera || !controls) return

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
  renderer.render(scene, camera)
}

/* ── 载入与着色 ── */
async function buildModel() {
  try {
    const { scene: model, muscles } = await load()
    root = model
    for (const item of muscles) {
      const entry: HeatEntry = { mesh: item.mesh, id: item.id }
      entries.push(entry)
      byMesh.set(item.mesh, entry)
      if (item.id) pickables.push(item.mesh)
    }
    scene?.add(model)
    frameModel(model)
    refreshMaterials()
    loading.value = false
  } catch {
    loading.value = false
  }
}

function refreshMaterials() {
  for (const e of entries) {
    const score = e.id ? props.scores[e.id] ?? 0 : 0
    const idx = tierIndex(score)
    const hovered = !!e.id && hoveredId.value === e.id
    let mat: THREE.MeshStandardMaterial
    if (idx < 0) mat = hovered ? restHoverMat : restMat
    else mat = hovered ? tierHoverMats[idx] : tierMats[idx]
    if (e.mesh.material !== mat) e.mesh.material = mat
  }
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

function pick(): MuscleId | null {
  if (!camera) return null
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(pickables, false)[0]
  return hit ? (byMesh.get(hit.object)?.id ?? null) : null
}

function onPointerMove(e: PointerEvent) {
  pointerFromEvent(e)
  pendingPick = true
}

function onPointerDown(e: PointerEvent) {
  downX = e.clientX
  downY = e.clientY
}

function onPointerUp(e: PointerEvent) {
  if (e.button !== 0) return
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return
  pointerFromEvent(e)
  const id = pick()
  if (id) {
    hoveredId.value = id
    refreshMaterials()
    if (renderer) renderer.domElement.style.cursor = 'pointer'
  }
}

function onPointerLeave() {
  hoveredId.value = null
  refreshMaterials()
}

function tick() {
  if (pendingPick) {
    pendingPick = false
    if (renderer) {
      const id = pick()
      if (id !== hoveredId.value) {
        hoveredId.value = id
        refreshMaterials()
      }
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab'
    }
  }
  rafId2 = requestAnimationFrame(tick)
}

/* ── 读数 ── */
const hoveredMuscle = computed(() =>
  hoveredId.value ? MUSCLE_MAP.get(hoveredId.value) ?? null : null,
)
const hoveredScore = computed(() =>
  hoveredId.value ? props.scores[hoveredId.value] ?? 0 : 0,
)
const hoveredTier = computed(() => heatTier(hoveredScore.value))

const trainedCount = computed(
  () => Object.values(props.scores).filter((v) => (v ?? 0) > 0.15).length,
)

watch(
  () => props.scores,
  () => refreshMaterials(),
  { deep: true },
)

onMounted(() => {
  if (!host.value) return
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
  if (root && scene) scene.remove(root)
  controls?.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
  restMat.dispose()
  restHoverMat.dispose()
  for (const m of [...tierMats, ...tierHoverMats]) m.dispose()
  renderer = null
  scene = null
  camera = null
  controls = null
  root = null
})
</script>

<template>
  <div class="heat-stage">
    <div ref="host" class="heat-canvas" aria-label="按训练强度着色的三维肌肉模型"></div>

    <div v-if="loading" class="stage-loading">
      <div class="loading-label">载入三维肌肉模型</div>
      <div class="loading-track"><i :style="{ width: progress + '%' }"></i></div>
      <div class="loading-num">{{ failed ? '加载失败，请检查模型文件' : progress + '%' }}</div>
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

    <div class="heat-legend" aria-label="训练强度图例">
      <span class="heat-legend-title">有效组强度</span>
      <span v-for="t in HEAT_TIERS" :key="t.id" class="heat-legend-row">
        <i :style="{ background: t.color }"></i>
        {{ t.label }}
        <em>{{ t.range }}</em>
      </span>
    </div>

    <div class="heat-readout">
      <template v-if="hoveredMuscle">
        <span class="readout-name">{{ hoveredMuscle.zh }}</span>
        <span class="readout-en">{{ hoveredMuscle.en }}</span>
        <span class="heat-readout-foot">
          <span class="heat-readout-tag" :style="{ color: hoveredTier?.color ?? 'var(--ink-3)' }">
            {{ hoveredTier?.label ?? '未训练' }}
          </span>
          <b>{{ hoveredScore.toFixed(1) }}</b> 有效组
        </span>
      </template>
      <template v-else>
        <span class="readout-name">训练强度热图</span>
        <span class="readout-en">Muscle load · effective sets</span>
        <span class="heat-readout-foot">已训练 <b>{{ trainedCount }}</b> 块肌群 · 拖动旋转</span>
      </template>
    </div>
  </div>
</template>
