import { ref } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { muscleIdForStructure } from '@/data/model-mapping'
import type { MuscleId } from '@/data/types'

/** 一块肌腹（模型里的一个网格） */
interface AnatomyMesh {
  mesh: THREE.Mesh
  id: MuscleId | null
  base: THREE.Material | THREE.Material[]
}

const MODEL_URL = `${import.meta.env.BASE_URL}models/ecorche.meshopt.glb`

const progress = ref(0)
const failed = ref(false)
const loaded = ref(false)

interface AnatomyModel {
  scene: THREE.Group
  /** 肌肉层网格 */
  muscles: AnatomyMesh[]
}

let promise: Promise<AnatomyModel> | null = null

export function useAnatomyModel() {
  function load() {
    if (promise) return promise

    promise = new Promise((resolve, reject) => {
      const loader = new GLTFLoader()
      loader.setMeshoptDecoder(MeshoptDecoder)

      loader.load(
        MODEL_URL,
        (gltf) => {
          const scene = gltf.scene
          scene.updateMatrixWorld(true)

          scene.traverse((o) => {
            const name = ((o.userData?.name as string) ?? o.name ?? '').toLowerCase()
            if (name === 'axis') o.visible = false
          })

          const muscles: AnatomyMesh[] = []
          scene.traverse((o) => {
            const mesh = o as THREE.Mesh
            if (!mesh.isMesh || !mesh.visible) return
            if (!String(mesh.userData?.layer ?? '').includes('muscle')) return
            const rawName = (mesh.userData?.name as string) ?? mesh.name ?? ''
            muscles.push({ mesh, id: muscleIdForStructure(rawName), base: mesh.material })
          })

          loaded.value = true
          progress.value = 100
          resolve({ scene, muscles })
        },
        (evt) => {
          progress.value = evt.total
            ? Math.min(99, Math.round((evt.loaded / evt.total) * 100))
            : Math.min(95, Math.round((evt.loaded / 6_000_000) * 100))
        },
        (err) => {
          failed.value = true
          reject(err)
        },
      )
    })

    return promise
  }

  return { load, progress, failed, loaded }
}

/** 给场景加一套暖白色解剖打光 */
export function addAnatomyLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xfff4e4, 0x6a5747, 1.35))

  const key = new THREE.DirectionalLight(0xfff1dd, 2.2)
  key.position.set(2.4, 3.4, 3.2)
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xe6ecff, 1.0)
  fill.position.set(-2.8, 1.7, 1.8)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xffd9bf, 1.6)
  rim.position.set(-0.6, 2.6, -3.4)
  scene.add(rim)
}
