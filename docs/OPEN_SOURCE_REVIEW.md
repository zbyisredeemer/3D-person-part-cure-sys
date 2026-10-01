# 开源发布检查 — 2026-10-01

## 原有缺项与处理

| 项目 | 处理 |
| --- | --- |
| 仓库公开但无应用许可证 | 原创代码、脚本和文档采用 MIT；增加 NOTICE 划定第三方例外 |
| 模型多许可证容易混淆 | README、NOTICE 与英文介绍明确 CC、ShareAlike 和非商业组件条款，保留原有归属记录 |
| 贡献和漏洞反馈入口 | 增加 CONTRIBUTING、SECURITY、隐私说明与 Issue / PR 模板；启用私密漏洞报告 |
| 缺少持续验证 | 增加 Node.js 22/24 测试、类型检查、构建、HTTP 冒烟和 Docker CI |
| 构建缺少完整版权声明 | 构建时收集生产依赖许可证并随静态文件、服务端配套文件和 Docker 镜像分发 |
| 依赖锁定特定镜像源 | 保持版本和 integrity 不变，将下载源规范为 npm 官方 registry |
| 无正式发布 | 增加更新记录，按本次通过验证的 main 创建 v1.0.0 |

## 本地核验

- `npm ci --registry=https://registry.npmjs.org` 成功；依赖审计 0 个已知漏洞。
- `npm test`：69 项通过。
- TypeScript 检查、前后端生产构建及 HTTP 冒烟检查通过。
- Gitleaks 8.30.1 扫描待发布 main 的原有全部 8 个提交，无泄漏发现；GitHub secret-scanning 告警列表为空。
- GitHub CI 的实际执行结果请查仓库 Actions；不得以工作流文件存在代替执行成功。

扫描只能说明本次规则未命中，不构成没有漏洞的保证。复核日的上游来源：[BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)、[Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy#attributions)。

## 仍存在的产品边界

- 历史 Z-Anatomy 素材没有完成逐网格商业授权清理；完整资源包不能宣传为全部 MIT 或无限制商用。
- 医学内容、细小解剖结构和旧模型配准仍需专业审校，产品未经临床验证。
- 在线 AI 没有用户认证和账单配额；公网启用前须自行增加网关保护。
- 本次没有使用真实密钥发起付费模型调用，也没有发布公网托管网站。
- 另一个本地工作区的功能分支不包含在本次 main 发布范围内。
