# 知体 Atlas

蓝白色交互式人体医学科普系统。使用真实解剖网格探索身体结构，配合器官档案、症状区域动画、疾病与药物知识，以及可选在线 AI 的健康科普助手。

## 本地启动

需要 Node.js 22 或更高版本。

```bash
npm ci
npm run dev
```

访问 **http://localhost:5173**。该命令同时启动前端和本地问答接口（127.0.0.1:8787）。无需 API 密钥即可使用全部模型、知识库、症状演示和本地问答功能。

```bash
npm test       # 医学边界、危险信号、来源和接口测试
npm run build # 前后端 TypeScript 检查与生产构建
npm start     # 同时提供 dist 静态页面和 API，访问 http://127.0.0.1:8787
```

`npm run dev:web` 仅运行前端；`npm run preview` 仅预览构建产物。没有接口服务时，助手明确使用本地科普演示。端口 5173 被占用时开发命令会提示失败，先关闭占用该端口的旧实例。

## 本地 Docker 部署

需要运行中的 Docker Desktop（或 Docker Engine）、Docker Compose 2.24+、Bash 和 curl；宿主机不需要安装 Node.js。首次构建需要联网下载基础镜像和 npm 依赖，模型全部随项目打包。

```bash
bash scripts/docker.sh up       # 构建、测试、启动/更新，等待健康并验证资源和 API
bash scripts/docker.sh status   # 容器状态与实际访问地址
bash scripts/docker.sh check    # 重新执行部署检查，不调用付费在线 AI
bash scripts/docker.sh logs     # 跟随日志；Ctrl-C 只退出日志，不停止服务
bash scripts/docker.sh restart  # 重启现有容器，不重新构建或加载新配置
bash scripts/docker.sh down     # 停止并移除本项目容器/网络，不删除镜像和本地文件
```

默认访问 **http://localhost:8080**，只绑定 `127.0.0.1`，不会暴露给局域网。Compose 项目名为 `zhiti-atlas`，运行镜像为 `zhiti-atlas:local`，不会停止其他 Docker 项目。端口被占用时会报错，不会自动结束占用进程。

配置文件为可选的 `.env.docker`，字段参考 `.env.docker.example`。修改 `ATLAS_PORT` 可更换本机端口，允许来源会自动匹配该端口；修改后重新执行 `up`。本地开发的 `.env` 不会自动用于 Docker。默认无需密钥，运行本地科普模式；只有在 `.env.docker` 中填写 `OPENAI_API_KEY` 和 `OPENAI_MODEL` 后才启用在线 AI。密钥文件被 Git 和 Docker 构建上下文排除，勿将其提交或分享；Docker 管理员仍可查看容器环境变量。

已有 Node.js 的环境也可使用 `npm run docker:up`、`docker:down`、`docker:restart`、`docker:status`、`docker:logs`、`docker:check`。单独构建使用 `bash scripts/docker.sh build`。脚本可从任意工作目录通过绝对路径调用；`up` 可重复执行，构建失败时不会替换正在运行的容器。

镜像采用多阶段构建：先执行全部自动测试并打包前后端，再仅将静态页面、模型、后端 JS 和检查脚本放入运行镜像。运行阶段不包含源码、node_modules、tsx 或 Vite 开发服务器；以非 root 用户运行，根文件系统只读，限制日志大小并配置健康检查、退出信号处理及 `unless-stopped` 重启策略。Docker Desktop 必须保持运行；手动停止的容器不会自行恢复。

启动验证涵盖首页、生产 JS、API 状态、Human Atlas 清单、压缩 GLB、原有模型补充、Draco 解码器、公开端口的同源请求和非法来源拒绝。可在宿主机额外运行 `SMOKE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs`。构建后的非容器启动方式仍为 `npm start`，现在直接运行 `dist-server/index.cjs`，须先执行 `npm run build`。

Compose 使用的可选配置文件与健康等待行为见 [Docker 环境变量文档](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/) 和 [Compose up 文档](https://docs.docker.com/reference/cli/docker/compose/up/)。

## 已实现

| 模块       | 行为                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| 三维人体   | 真实 GLB 解剖网格；全身、上半身、器官聚焦，旋转、缩放、四向视角、复位与热点标签 |
| 器官拆分   | 19 个器官组按原始比例分列陈列；标签、直接点选与聚焦联动，支持恢复原位及窄屏布局 |
| 外观与细节 | 中性科普外观；解剖细节/柔和展示切换，自然组织配色、表面明暗和选中器官轮廓提示   |
| 人体系统   | 神经、呼吸、循环、消化、泌尿、骨骼、肌肉 7 大系统，23 个科普结构入口            |
| 图层       | 整体、器官、骨骼、肌肉快速预设；皮肤透明度与六类图层开关，可选大图层按需加载    |
| 器官档案   | 功能、正常状态、相关疾病、异常症状、风险因素、日常保护和参考来源                |
| 症状演示   | 胸痛、咳嗽、头痛、腹痛、腰背痛、心悸；区域动画与组合危险信号提醒                |
| 疾病百科   | 8 个常见疾病主题的搜索、分类、基础照护、药物类别和注意事项                      |
| 药物知识   | 7 种常见药物知识，包含作用、适用情况、副作用、禁忌及注意事项；不提供剂量        |
| 健康助手   | 四段式科普回答、建议问题、追问；本地/在线状态与每条回答的来源清晰可见           |
| 交互与适配 | 器官搜索、浏览器本地收藏、桌面三栏、移动端目录、键盘导航、弹窗焦点管理          |

覆盖的科普结构：大脑、眼睛、耳朵、鼻腔、口腔、牙齿、心脏、肺、气管、食管、肝脏、胃、胆囊、胰腺、小肠、大肠、肾脏、输尿管、膀胱，以及骨骼、肌肉、血管、神经系统。细小结构使用语义分组，不代表逐个微细解剖结构都经过人工核验。

器官拆分参考 Human Atlas 的结构陈列交互，粒度为上述 19 个器官组，不是逐一拆开 2,193 个源结构。它只平移整个器官组，不修改几何、比例或组内结构关系；陈列位置不代表解剖位置。进入拆分时暂时隐藏体表及整体系图层，切回全身/上半身恢复原有图层配置，图层预设则应用新配置。

## 可选在线 AI

将 `.env.example` 复制为 `.env`，在**本机编辑器**中填写，随后重新启动服务：

```dotenv
OPENAI_API_KEY=你的服务端密钥
OPENAI_MODEL=你的账户可用且支持结构化输出的模型ID
OPENAI_BASE_URL=https://api.openai.com/v1
```

不预设某个模型的账户访问权限。默认通过 OpenAI Responses API 调用；自定义地址需使用 HTTPS，并实现兼容的 `/responses` 接口和结构化输出。

- 密钥只由 Node 服务读取，不能放进 `VITE_*` 环境变量，也不会发送到前端。
- 在线模式会明确提示：用户提问将发送给已配置的 AI 服务。默认不会调用外部模型。
- 危险信号优先在本地处理，直接显示求助信息，不等待、不发送给在线模型。
- 服务设置 `store: false`；本项目不持久化对话或记录提问日志。外部服务商的数据政策仍适用。
- 输入上限 500 字；请求体限制、同源检查、每分钟 20 次限制、25 秒上游超时、结构验证及医学回答边界检查均已实现。
- 在线错误明确显示，并提供重试；不会把本地回答伪装成在线生成。

接口：

```text
GET  /api/health/status
     -> { mode: "local" | "online" }
POST /api/health/chat
     body: { question: string, context?: string }
     -> { mode, answer: { sections, urgent, sourceIds }, notice? }
```

实现依据：[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)。在线适配器已通过模拟上游的自动化测试；本次未配置实际密钥，尚未进行真实付费模型调用验证。

## 精度、内容与许可

这是一套**可运行的医学科普演示系统**，不是经过临床验证的医学教学产品、诊断工具或患者模型。骨骼、肌肉、脑、心脏、腹部器官及血管已更新为 [Human Atlas](https://github.com/ashemag/human-atlas) 使用的 BodyParts3D 4.0 数据，固定上游版本 `1c38bf35c254a891200d3cedecfd57abebe83d8d`。引入 2,193 个原始结构、约 217 万个三角形，按现有中文器官分类组织成 24 个渲染批次。导入保留源顶点、法线、拓扑和 FMA/FJ 标识，并修正了上游脑室、肝脏分段等显示分组。

上游当前数据未提供肺叶表面和完整周围神经，因此继续使用原有 Z-Anatomy 肺叶和脊髓/周围神经作为补充；体表保留原有 BodyParts3D 中性皮肤。新结构沿 Z 轴整体平移 -13 mm，以对齐现有 BodyParts3D 体表坐标原点；旧版补充结构仍为近似配准。颜色、可见性、分类和标签作了科普化处理，尚需专业人员逐结构校核。

默认展示上半身和“解剖细节”材质，使脑沟、肺叶、器官轮廓与组织层次更容易辨认。中性科普外观使用单独的 `skin-neutral.glb`：局部平滑皮肤的外生殖器与乳头特征，保持原网格拓扑；原始 `skin.glb` 保留不覆盖。运行时隐藏生殖相关结构，保留肾脏、输尿管、膀胱和骨盆。这是对男性来源模型的中性化展示，并非独立的女性解剖模型，也不用于生殖系统教学。可用 `public/models/prepare_neutral_skin.py` 重现资产处理，测试覆盖局部修改范围、拓扑质量和结构过滤边界。

首屏六个模型约 **17.1 MB**；肌肉、血管和神经在启用时单独加载。新增模型总计约 **30.9 MB**，以 gzip 压缩 GLB 本地托管，兼容服务器已解压和浏览器主动解压两种响应。模型与 Draco 解码器不依赖第三方 CDN。界面字体可使用在线 Google Fonts，离线时回退到本机字体。

导入可用 `node --import tsx scripts/import-human-atlas.ts /path/to/human-atlas` 重现，需要上述固定版本的上游检出目录。`public/models/human-atlas/manifest.json` 记录来源、文件校验和、纳入/省略的结构和补充资产。测试逐结构验证重新分组后源几何的字节一致性、器官覆盖、分类边界和下载解码。

医学内容附有 **41 个 NHS / NIH 等权威健康资料来源**。规则提醒用于介绍危险信号，**未触发规则不意味着安全**；知识库覆盖范围有限，不能给出明确诊断、处方、剂量或治疗保证。

新增 Human Atlas / BodyParts3D 4.0 数据采用 CC BY 4.0，应用参考代码采用 MIT。原有中性皮肤及 Z-Anatomy 补充资产保留各自许可；仓库中的历史 Z-Anatomy 文件仍含上游不同组件的授权声明。详见 [完整模型来源与许可](public/models/ATTRIBUTION.md)，不可将新增资产许可一概套用到历史文件。

## 目录

```text
src/App.tsx                       应用导航、探索工作台、症状界面
src/styles.css                    视觉样式与响应式布局
src/components/AnatomyScene.tsx   Three.js 场景、拾取、图层和动画
src/components/anatomy/          器官映射、表面材质与中性展示过滤
src/components/KnowledgeViews.tsx 疾病、药物、问答、来源和帮助
src/data/medical.ts              科普条目及原始来源
src/lib/health.ts                本地风险规则和科普回答
server/health-service.ts         在线模型适配与回答验证
server/index.ts                  HTTP API 和生产静态资源服务
public/models/                  GLB、解码器、处理脚本与许可
tests/                          规则、内容和接口测试
```

本地收藏保存在当前浏览器；问答仅保留在当前页面内，刷新或离开助手页面后清除。没有账号系统、数据库或患者健康档案。
