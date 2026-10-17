# Relief Portfolio · 石膏浮雕个人网站 Skill

用自己的资料、图片和深度素材，制作带动态浮雕、文字扰动和图案加载页的个人网站。

提供两条可运行路线：**单背景入门版**与**多浮雕长廊版**。这不是一键复制任意网站的工具，也不是自动生成精确人物模型的服务。

## 两种版本

| | 单背景 `single` | 长廊 `gallery` |
|---|---|---|
| 素材 | 1幅背景 | 至少2幅，数量可扩展 |
| 电脑 | 背景与文字上下滚动 | 完整浮雕横排，滚轮左右移动，不吸附 |
| 手机 | 早期视口背景裁切 | 按屏幕宽度等比纵向拼接，保留外框 |
| 动画 | 流场遮罩显现 | 浮雕从同材质白石膏底板中隆起、缓慢回落 |
| 文字 | 独立手动扰动 | 独立手动扰动，自动动画不移动文字 |

**单背景版保留早期机制，不等于当前长廊版减少图片数量。** 两套模板的坐标映射和着色器应配套使用。

## 先准备什么

1. 姓名、昵称、身份、标题、简介、关键词、作品和联系方式；未提供的内容留空。
2. 每幅同构图的备用外观图与**线性高度图**。普通灰度照片不能直接当真实深度。
3. 可选的匹配GLB模型；没有GLB时会用高度图生成网格。
4. 加载页图案：亮色图案，黑底或透明底，建议正方形居中。
5. 长廊素材顺序，以及每幅原图的宽高比 `aspect = 宽 / 高`。

本仓库不包含任何个人资料、人物图片、人物模型、原站资源或API密钥，需自行提供素材。AI图像生成服务与Blender需在相应制作阶段自行准备。

## 安装为 Skill

将本仓库放入个人技能目录，并保持文件夹名为 `relief-portfolio`。已存在同名目录时先备份，避免覆盖自己的修改。

```bash
git clone https://github.com/chshka/relief-portfolio.git ~/.codex/skills/relief-portfolio
```

Windows PowerShell：

```powershell
git clone https://github.com/chshka/relief-portfolio.git "$env:USERPROFILE/.codex/skills/relief-portfolio"
```

如果自定义了 `CODEX_HOME`，使用该目录下的 `skills/relief-portfolio`。在新会话中确认技能可见，然后输入 `$relief-portfolio`。没有技能加载功能的助手也可以读取 [SKILL.md](SKILL.md) 按步骤操作。

## 直接复制的调用提示词

### 单背景入门

> 使用 $relief-portfolio，按单背景入门版制作个人网站。资料见附件，背景和加载图案由我提供。先检查外观图与深度是否匹配；只有图片时先做一幅建模样板，给我正面与斜面预览再接入网页。保留自动显现、手动文字扰动和图案进度加载。缺少作品留空，验证电脑与手机后交付，先不发布。

### 多浮雕长廊

> 使用 $relief-portfolio，按多浮雕长廊版制作网站。资料及素材顺序见profile.gallery.json。电脑满视口高横向紧贴排列，滚轮横移，文字背景同速；手机完整等比纵排。材质统一为白石膏，鼠标与自动动画使浮雕逐渐隆起，离开后回落。自动动画不影响文字。现有内容集中前几幅，为后续补充留空间。先本地验证，不发布。

## 不通过助手，直接生成项目

需要Python 3和Node.js；网站本身没有npm运行依赖，也不需要编译。

1. 将 [单背景资料模板](assets/profile.example.json) 或 [长廊资料模板](assets/profile.gallery.example.json) 复制到工作目录。
2. 填入真实资料和素材路径。路径相对于JSON文件；模型可为空，高度图不能省略。
3. 运行：

```bash
python scripts/scaffold.py --mode single --profile /path/to/profile.json --out /path/to/my-single-site
# 或
python scripts/scaffold.py --mode gallery --profile /path/to/profile.gallery.json --out /path/to/my-gallery-site
```

Windows遇到编码问题可使用 `python -X utf8`。输出目录必须不存在，脚手架不覆盖已有项目。

4. 进入生成目录：

```bash
cd /path/to/my-gallery-site
npm run dev
```

打开 **http://127.0.0.1:4173/**。端口冲突时可设置 `PORT` 环境变量。此地址仅供本机预览，不能作为对外网站链接。

## 从零制作路线

| 步骤 | 要完成的事 | 文档 |
|---|---|---|
| 1 | 选版本、准备真实资料、整理素材 | [输入契约与提示词](references/inputs-and-prompts.md) |
| 2 | 拆解参考效果、生成白石膏外观目标 | [完整教程](references/tutorial.md) |
| 3 | 估算并校正深度，Blender生成样板 | [建模与资产契约](references/modeling.md) |
| 4 | 验证正面、斜面与网页灯光，再处理系列素材 | [建模与资产契约](references/modeling.md) |
| 5 | 生成网站、调整文字与背景位置 | [完整教程](references/tutorial.md) |
| 6 | 调整隆起、流场、独立文字与加载页 | [组件与机制](references/components.md) |
| 7 | 检查桌面、手机、失败降级和性能 | [验收与部署](references/verification-and-deploy.md) |
| 8 | 选择静态托管，或域名+服务器方案 | [验收与部署](references/verification-and-deploy.md) |

## 实际用了什么

- **HTML / CSS / 原生JavaScript**：语义内容、响应式排版、导航与滚动。
- **Web Component + WebGL / GLSL**：实际网格绘制、流场、动态高度、法线、近似局部遮蔽与文字视觉层。
- **Python脚手架**：校验输入、转义资料、复制素材、生成新项目。
- **Blender脚本**：从已准备好的线性高度图生成高度场、GLB和正面/斜面预览。
- **Node.js**：本地静态服务器。

运行网页不需要REA、React、Three.js或GSAP。REA用于另行要求的参考站分析；它不负责生成网站或人物几何。图像生成工具也不是网页运行依赖。

主要文件：`relief-background.js`管理画布与素材；`relief-surface.js`管理顶点和自动路径；`relief-flow.js`管理流场和材质；`relief-text.js`管理独立文字特效；`loading-screen.js`管理加载页。完整对应表见[组件文档](references/components.md)。

## 验证与边界

已验证两套模板可在独立目录生成，桌面和手机尺寸模拟、GLB/高度网格路径、HTML转义、禁止覆盖、JavaScript语法及Blender辅助脚本运行通过。详见[验证记录](docs/validation.md)。

- 单张图只能估算面向正面的高浮雕，不能恢复遮挡背面或保证人物细节准确。
- GLB加载器只支持约定格式，不能加载任意压缩、骨骼或复杂节点场景。
- 流动与接触阴影是实时视觉近似，不是完整流体物理或光线追踪。
- 高度图可能经浏览器8位上传而损失细节；高精度需要升级几何或纹理管线。
- 通用建模脚本输出开放高度场，不能直接当成可打印的封闭模型。
- 尚未验证真实手机帧率，也没有在此仓库执行公网部署。

加载进度代表资源阶段完成比例，不是精确下载字节百分比；长廊只等待首屏资源，其余按需加载。

## 目录

```text
SKILL.md                    技能入口
agents/openai.yaml          技能界面信息
assets/starter/             早期单背景模板
assets/gallery-starter/     当前长廊模板
assets/profile*.json        两种资料模板
scripts/scaffold.py         网站生成器
scripts/build_height_relief.py  Blender建模起点
references/                 教程、输入、建模、组件、验收部署
 docs/validation.md         验证结果
```

公开仓库不代表所有第三方素材可自由使用。请使用自己有权使用的图片、模型和字体；本仓库不授予这些素材的权利。

