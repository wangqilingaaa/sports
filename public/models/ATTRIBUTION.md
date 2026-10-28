# 3D 模型来源与许可

本目录下的 `ecorche.meshopt.glb` 不是本项目原创，来自开源解剖模型项目 **Écorché**：

- 项目：Écorché — open 3D skeleton and muscles, one named mesh per structure
- 作者：Charleeh
- 源码 / 模型：https://github.com/Charleeh/ecorche
- 许可：**CC BY-SA 4.0**（https://creativecommons.org/licenses/by-sa/4.0/）
- 文件：`model/ecorche.meshopt.glb`（5.7 MB，EXT_meshopt_compression + KHR_mesh_quantization）

上游数据来源（Écorché 由二者合并、修形、镜像对齐后导出）：

- **BodyParts3D** — Database Center for Life Science (DBCLS)，CC BY-SA 2.1 Japan
  https://lifesciencedb.jp/bp3d/
- **Z-Anatomy** — The libre 3D atlas of anatomy，CC BY-SA 4.0
  https://www.z-anatomy.com/

模型内容：634 个独立命名的网格（198 骨、42 软骨、28 牙、2 眼，203 浅层肌、159 深层肌），
米制单位、Y 轴向上、脚底位于 y = 0、面朝 +Z。每个节点在 `extras` 中带 `name / layer / side / source / fma / group / tissue`。

## 使用须知

- 分发本作品（含修改后的模型）时，必须保留上述署名，并以 **CC BY-SA 4.0** 相同许可分发模型及其衍生文件。
- 本项目的源代码不受该许可约束，仅模型文件及其衍生文件适用。
- 应用内已在三维视图右下角保留来源与许可标注（链接到项目主页）。

如需替换为其他模型，把它们放到本目录并在 `src/data/model-mapping.ts` 中补充
「网格名 → 肌群 id」的映射即可，组件逻辑不需要改动。
