# 部署与故障排查

## 使用发布包

1. 安装 Node.js 22.12+，推荐 22 或 24。
2. 在 Releases 下载 `zhiti-atlas-1.0.1.tar.gz` 及 `.sha256` 到同一目录。
3. 核对下载文件完整性：

```bash
# macOS
shasum -a 256 -c zhiti-atlas-1.0.1.tar.gz.sha256
# Linux
sha256sum -c zhiti-atlas-1.0.1.tar.gz.sha256
```

Windows 可运行 `Get-FileHash .\zhiti-atlas-1.0.1.tar.gz -Algorithm SHA256`，与 `.sha256` 文件内容对照。校验和用于发现传输损坏；请从可信的仓库 Release 下载文件和校验和。

4. 解压后启动：

```bash
tar -xzf zhiti-atlas-1.0.1.tar.gz
cd zhiti-atlas-1.0.1
node start.mjs
```

访问 http://127.0.0.1:8787。发布包不需要 `npm ci`；它包含前后端构建产物、模型和许可。`node /绝对路径/start.mjs` 也可从其他目录运行。

可复制包内 `.env.example` 为 `.env`，编辑端口、允许来源或可选 AI 配置，再重新启动。配置文件应保存在解压目录内。修改端口时同步修改 `ALLOWED_ORIGINS`，例如端口 8788 对应 `http://127.0.0.1:8788,http://localhost:8788`。

## 其他运行方式

| 目的 | 方式 |
| --- | --- |
| 修改源码 | `npm ci` 后 `npm run dev`；前端 5173，API 8787 |
| 源码生产部署 | `npm run build` 后 `npm start`；页面和 API 共用 8787 |
| 本地容器 | `bash scripts/docker.sh up`；默认 http://localhost:8080 |
| 验证源码 | `npm run check`；无需 API 密钥 |
| 验证发布包 | 先构建，再 `npm run release:check`；检查 SHA-256、归档内容和解压运行 |

发布包制作需要 `tar` 命令。正式 CI 在 Linux 上验证 Node.js 22/24 和 Docker；本地验证环境为 macOS，Windows 尚未做实际运行验证。

## 升级和回退

停止旧进程，将新版本解压到新目录。手动迁移自己的 `.env`，不要覆盖为示例配置；启动并确认页面、模型、API 正常后再停用旧目录。需要回退时停止新进程，再运行旧目录的 `start.mjs`。项目没有服务端数据库迁移。

收藏仍由浏览器按站点来源保存；改变域名或端口后会使用不同的存储。问答仅在页面内存中，不会被发布包升级迁移。

## 常见问题

- **端口已被占用 / EADDRINUSE**：停止自己启动的旧实例，或在 `.env` 修改 `API_PORT` 和 `ALLOWED_ORIGINS`；不要随意结束未知进程。
- **模型加载失败**：先检查 `/models/human-atlas/manifest.json` 能否打开，确认压缩包完整解压；通过 HTTP 服务访问，不要直接双击 `dist/index.html`。
- **WebGL 不可用**：确认浏览器支持 WebGL 并启用硬件加速；更新浏览器后重新加载。模型需要一定显存，大图层可按需打开。
- **提问返回 403**：页面地址须与 `ALLOWED_ORIGINS` 精确匹配，包含协议与端口。Origin 检查不是认证机制。
- **提问返回 429**：当前限制为同一来源 IP 每分钟 20 次，等待后再试；反向代理可能让多个用户共享来源地址。
- **显示本地模式**：默认行为；仅同时配置服务端密钥和模型才启用在线 AI。`vite preview` 不启动 API。
- **嵌入 iframe 被拒绝**：生产服务默认发送 `X-Frame-Options: DENY`，请直接打开应用页面。

公网部署在线 AI 前，必须阅读 [安全政策](../SECURITY.md)，配置认证、配额、总预算与 HTTPS。原有模型授权和医学使用边界同样适用于发布包。
