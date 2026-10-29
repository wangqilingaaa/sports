# 训练计划改为按完成次数推进

## 背景

现有计划把训练映射到真实日历：`startDate` 固定为某个周一，每个训练日绑定星期几，打卡按日期存储，页面围绕「第 N 周 / 本周 / 近 4 周」展示。用户希望计划不再和具体日期、周绑定，改为按完成次数推进。

## 目标

- 计划只由「第几次训练」驱动，不出现日期、星期、周数。
- 完成一次训练后自动指向下一次未完成的训练。
- 保留线性周期化：适应 → 容量 → 强度 → 减载，按训练次数分段。
- 已有按日期存储的打卡记录迁移后不丢失。

## 数据模型（`src/data/training-plan.ts`）

- `PlanConfig` 删除 `startDate`。
- `PlanDay` 删除 `weekday`。
- `Phase.weeks` 改为 `Phase.rounds`，`PLAN_ROUNDS = 8`。
- 总训练次数 = `PLAN_ROUNDS × days`。
- 新增 `PlanSession { index, round, phase, day, note }`。
- `buildSession(config, index)` 按 `(index - 1) % days` 轮转训练日模板；`buildPlan(config)` 返回全部训练。
- 轮次决定分期：第 1–2 轮适应、3–5 轮容量、6–7 轮强度、8 轮减载。
- 原按周提示文案改为按轮次提示，文案不再出现「周」。

## 状态与打卡（`src/composables/useTraining.ts`）

- `selectedWeek + selectedDay` 合并为 `selectedIndex`；进入页面默认选中下一次未完成的训练。
- `LogEntry.date` 改为 `sessionIndex`；`createdAt` 仅内部用于排序。
- 完成判定：某次训练存在带 `sessionKey` 的打卡即视为完成。
- 统计：本次动作完成数、本次组数与容量、估算时长、连续完成训练次数。
- 热图范围：`session`（本次）/ `recent`（近 8 练）/ `all`（全部）。
- 建议文案基于最近 4 练完成度。
- 旧存档迁移：用旧 `startDate` 将日期折算为 `sessionIndex`，无法精确匹配的自由记录归入该轮首个训练日。
- 删除 `restart()`，改为 `syncNext()`。

## 界面

- 页头显示「第 N 练 · 共 M 练」与当前分期。
- 周条 + 训练日 Tab 合并为一条可横向滚动的训练序列：序号 + 训练日简称 + 完成态，下一次训练虚线标记，选中项自动滚入视野。
- 分期卡显示「第 a–b 练」，点击跳到该阶段第一练。
- 训练卡、记录卡、自由打卡落款改为「第 N 练」。
- 侧栏热图、统计、排行、建议与页脚原则文案去掉「周」相关措辞。
- 样式类 `.week-*`、`.day-tab*` 替换为 `.session-*`。

## 验证

- `pnpm typecheck`、`pnpm build` 通过。
- 手动验证：空进度默认第 1 练；打卡后下一次训练前移；刷新后进度保留；旧存档迁移成功；全部完成后显示完成态。
