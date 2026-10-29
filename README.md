# 形骸 · Atlas of Strength

一个可以「点开肌肉看动作」的力量训练百科：在 3D 肌骨模型上选中肌群，检索对应的训练动作，看激活占比、动作要领与收缩示意；再把它排成一份按次数推进、带打卡与 3D 热图的训练计划。

- **177** 个训练动作 · **30** 块肌群 · **13** 类器械
- 3D 模型与 2D 示意共用同一套向心 / 离心节奏
- 计划不绑日历：按「第几练」推进，练完自动进下一练

## 功能

### 动作库（`/`）

- **3D 肌骨模型**：旋转、缩放，前 / 后 / 侧视角切换；点击网格选中肌群，主动肌、协同肌、稳定肌分色高亮。
- **双向联动**：模型上选肌群 → 下方筛选条件同步；筛动作 → 模型上高亮该动作会带到的肌群。
- **搜索**：中文名、英文名、别名、全拼（`wotui`）、首字母（`wt`）都能命中，多关键词按 AND 过滤并排序。拼音按**整音节**匹配，`fuwotui` 不会误命中 `wotui`。
- **筛选**：器械 / 肌群 / 难度三维过滤，可叠加搜索词。
- **动作详情**：以抽屉形式打开，含动作要领、常见错误、关节动作、向心离心节奏；支持同日动作间上下翻，也能「在 3D 模型中查看」。
- **肌肉收缩示意**：3D 模型按 `tempo` 驱动收缩相位（向心 → 顶峰等长 → 离心 → 间歇），可暂停与变速。
- **深链**：筛选与选中的动作写回 URL（`replace`，不堆历史），可直接分享。

### 训练计划（`/plan`）

- **三组参数**：目标（增肌塑形 / 力量突破 / 减脂体能）× 水平（入门 / 进阶 / 高阶）× 分化（全身 / 推拉腿 / 上下肢 / 五分化 / 推拉腿 ×2）。
- **周期化**：8 轮，分期 2/3/2/1 轮——解剖适应 → 容量累积 → 强度强化 → 减载恢复。每张分期卡显示命中的第几练、轮数与进度。
- **按次数推进**：训练序列是「第 1 练 … 第 N 练」，不绑定日期；有「下次」标记与跳转，练完即推进。
- **打卡**：按计划动作记录组数 / 次数 / 负重 / RPE，也可「自由打卡」补临时动作；记录可删除，按本次训练归档。
- **3D 肌肉热图**：可切换「本次 / 近 8 练 / 全部」。有效组 = 组数 × 该动作对肌群激活占比 × RPE 系数，颜色越深刺激越多。
- **本轮容量审计**：按当前轮处方累计直接组（主动肌 1 组、协同肌 0.5 组），与按分期 / 水平折算后的目标区间对比，标出不足、达标、偏高。
- **统计与建议**：动作位完成度、连续完成次数、总组数、估算时长、外部负荷容量、肌群有效组排行，以及下一次该怎么调。

### 交互细节

| 快捷键 | 行为 |
| --- | --- |
| `/` | 聚焦搜索并滚到模型区 |
| `Cmd / Ctrl + K` | 同上 |
| `Esc` | 依次关闭：抽屉 → 取消选中 → 清空搜索 → 取消肌群筛选 → 失焦 |

计划页数据存在 `localStorage` 的 `atlas.training.v1`（配置 + 打卡记录），换浏览器或清缓存会丢。

## 技术栈

Vue 3（`<script setup>` + TS）· Vite 6 · Vue Router 4 · Three.js（`OrbitControls` + raycaster 拾取）· Lucide 图标 · 纯手写 CSS（无 UI 框架）。

动作数据、训练模板、搜索索引全部本地静态化，无后端、无接口请求；打卡记录只存在浏览器本地。

## 快速开始

环境：Node ≥ 20、pnpm 10+（`packageManager` 已锁定 `pnpm@10.14.0`）。

```bash
pnpm install        # 安装依赖
pnpm dev            # http://127.0.0.1:5178
```

演示素材（`public/demo/`，507 个文件）与 3D 模型都已入库，克隆后无需额外同步；只有改动 `src/data/demo-map.ts` 或升级上游素材包时才需要 `pnpm sync:demo`。

`pnpm dev` 只监听 `127.0.0.1:5178`，不能从局域网其他设备访问；需要时改 `vite.config.ts` 的 `server.host`。

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 本地开发服务器 |
| `pnpm build` | `vue-tsc --noEmit` 类型检查 + 生产构建到 `dist/` |
| `pnpm typecheck` | 只做类型检查，不出产物 |
| `pnpm preview` | 预览 `dist/` 产物 |
| `pnpm sync:demo` | 从 `@bryllim/workout-guide` 复制演示帧到 `public/demo/` |

`sync:demo` 只复制 `src/data/demo-map.ts` 里登记过的 slug（每个 3 帧），不会把上游 900+ 张图全量塞进产物；已失效的旧目录会被清掉。素材缺失或 slug 不在上游 manifest 时会以非 0 退出并列出问题。

> 部署到静态托管时注意：路由使用 `createWebHistory`，需要配置 SPA 回退（所有未命中路径重写到 `index.html`），否则直接访问 `/plan` 会 404。

## 目录结构

```
src/
├── views/            页面：AtlasView（动作库）/ TrainingPlanView（训练计划）
├── components/       模型、列表、筛选、抽屉、2D 示意
│   └── plan/         计划页组件：训练日、容量审计、自由打卡、3D 热图
├── composables/      全局状态与逻辑
│   ├── useAtlas.ts           动作库状态（筛选、选中、高亮）
│   ├── useAtlasQuerySync.ts  URL ↔ 状态双向同步
│   ├── useAnatomyModel.ts    模型加载与网格映射
│   ├── useContraction.ts     收缩相位时钟
│   └── useTraining.ts        计划生成、打卡、热图、建议（含 localStorage）
├── data/             静态数据（动作、肌群、器械、模板、搜索索引、素材映射）
├── styles/           main.css / plan.css
└── router/           路由与滚动行为
scripts/sync-demo-assets.mjs   素材同步
public/models/                 3D 模型（含署名文件）
public/demo/                   动作演示帧 frame-1..3.png
docs/superpowers/specs/        计划设计文档
```

## 数据维护

### 新增一个动作

1. 在 `src/data/exercises-ext.ts` 追加条目（`src/data/exercises.ts` 为基础库），字段定义见 `src/data/types.ts` 的 `Exercise`——必填 `id / zh / en / aliases / equipment / pattern / level / jointAction / muscles / cues / mistakes / tempo`。
2. `muscles` 用 `{ id, role, activation }` 描述，`role` 为 `primary | secondary | stabilizer`，`activation` 是相对峰值的近似百分比（0–100）。
3. 在 `src/data/demo-map.ts` 登记「动作 id → 上游 slug」，然后跑 `pnpm sync:demo`。
4. 想进训练计划，还要在 `src/data/training-plan.ts` 的对应日模板 `slots[].pool` 里加入该 id（按由易到难排列，程序按水平取档）。

### 素材来源

演示帧来自 `@bryllim/workout-guide` 依赖包。`public/demo/` 下现有 **169 组**素材，对应 177 个动作（其中 8 个动作复用同一组帧）。

## 3D 模型与许可

`public/models/ecorche.meshopt.glb`（约 5.7 MB，`EXT_meshopt_compression` + `KHR_mesh_quantization`）来自开源解剖项目 **Écorché**，许可 **CC BY-SA 4.0**；上游数据合并自 BodyParts3D（CC BY-SA 2.1 Japan）与 Z-Anatomy（CC BY-SA 4.0）。

- 分发模型或其衍生文件时必须保留署名，并以 CC BY-SA 4.0 相同方式共享；**源码不受该许可约束**。
- 应用内已在三维视图右下角保留来源与许可标注。
- 完整署名、网格清单与替换说明见 [`public/models/ATTRIBUTION.md`](public/models/ATTRIBUTION.md)。替换模型时，只需把文件放进该目录并在 `src/data/model-mapping.ts` 补「网格名 → 肌群 id」映射。

## 免责声明

训练计划基于常见的力量训练周期化原则整理；RPE、组数区间与肌肉激活占比均为训练实践中的近似值，不构成医疗或康复建议。存在疼痛、关节不适或既往伤病，请先咨询专业人士。

## 设计文档

- [训练计划：分化替代频次 + 每轮容量校准](docs/superpowers/specs/2026-10-29-split-volume-plan-design.md)
- [训练计划改为按完成次数推进](docs/superpowers/specs/2026-10-29-session-driven-plan-design.md)
