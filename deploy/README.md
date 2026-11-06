# 景明自托管部署手册（阿里云 / 腾讯云轻量）

> 目标：2 核 2G 轻量服务器 + Docker + Nginx，跑 Web / PWA / API，Redis 负责同步码。
> 前置：域名、ICP 备案（境内服务器必须）、服务器防火墙放行 80/443。

---

## 0. 需要准备的东西

- 轻量应用服务器：2 核 2G、3M 带宽（10–100 位老师够用）
- 域名：已完成实名认证
- ICP 备案：境内服务器必须先备案（2–4 周），备案期间继续用 Vercel
- GitHub 仓库：`29150905-system/dsh-product-lab`
- 阿里云容器镜像服务 ACR（个人版免费）或腾讯云 TCR

---

## 1. 配置镜像仓库（一次）

### 阿里云 ACR
1. 开通「容器镜像服务」个人版（免费）
2. 创建命名空间（例如 `jingming`）和仓库（例如 `web`）
3. 在 GitHub 仓库 → Settings → Secrets and variables → Actions 添加：

| Secret | 示例值 |
|---|---|
| `ACR_REGISTRY` | `registry.cn-hangzhou.aliyuncs.com` |
| `ACR_NAMESPACE` | `jingming` |
| `ACR_REPO` | `web` |
| `ACR_USERNAME` | 阿里云账号（或 RAM 用户名） |
| `ACR_PASSWORD` | ACR 固定密码 |

4. 打开 Actions → **Docker Image (ACR)** → Run workflow
5. 构建成功后会得到镜像：`registry.cn-hangzhou.aliyuncs.com/jingming/web:latest`

> 没配 secrets 时 workflow 只做「构建验证」，不会 push。

---

## 2. 服务器初始化

```bash
# 以 Ubuntu 22.04/24.04 为例
sudo apt update && sudo apt upgrade -y

# 安装 Docker（官方脚本）
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# 确认
docker --version
docker compose version
```

创建目录：

```bash
sudo mkdir -p /opt/jingming && sudo chown $USER:$USER /opt/jingming
cd /opt/jingming
```

把仓库里的 `docker-compose.yml` 拷过来（或服务器上 `git clone` 后复制）：

```bash
# 本地执行
scp docker-compose.yml deploy/env.production.example user@服务器IP:/opt/jingming/
```

> 服务器不需要拉 GitHub 源码，只需要 compose 文件 + 镜像。

---

## 3. 配置环境变量

```bash
cd /opt/jingming
cp env.production.example .env.production
nano .env.production
```

至少填：

```bash
DEEPSEEK_API_KEY=sk-...
```

`REDIS_URL` 不用填，compose 会注入 `redis://redis:6379`。
`.env.production` 权限收紧：

```bash
chmod 600 .env.production
```

---

## 4. 启动服务

```bash
cd /opt/jingming
export IMAGE=registry.cn-hangzhou.aliyuncs.com/jingming/web:latest
docker compose pull
docker compose up -d

# 看状态
docker compose ps
docker compose logs -f web
```

验证：

```bash
curl -I http://127.0.0.1:3000/
# 应该返回 200
```

> 首次启动会拉起 Redis，Web 等 Redis healthy 后才启动。

---

## 5. Nginx + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf /etc/nginx/conf.d/jingming.conf
# 改里面的域名
sudo nginx -t && sudo systemctl reload nginx
```

申请证书：

```bash
sudo certbot --nginx -d 你的域名
```

或手动 webroot 方式（先用 80 端口验证）：

```bash
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d 你的域名
```

自动续期：

```bash
sudo certbot renew --dry-run
```

---

## 6. 更新与回滚

更新：

```bash
cd /opt/jingming
docker compose pull
docker compose up -d
```

回滚（用之前的 sha tag）：

```bash
export IMAGE=registry.cn-hangzhou.aliyuncs.com/jingming/web:<旧sha>
docker compose up -d
```

只重启 Web：

```bash
docker compose restart web
```

---

## 7. 备份与监控

- **Redis**：`redis-data` 卷（appendonly）；`docker compose exec redis redis-cli BGSAVE`
- **学生数据**：本来就只存在用户浏览器，服务器不存，迁移不涉及
- **环境变量**：`.env.production` 单独备份
- 日志：`docker compose logs -f --tail=200 web`
- 磁盘：`df -h`，Docker 镜像定期 `docker image prune -f`

---

## 8. 常见问题

| 现象 | 排查 |
|---|---|
| 502 Bad Gateway | `docker compose ps` 看 web 是否 healthy；`docker compose logs web` |
| 同步码提示「同步服务还没配置」 | 检查 `.env.production` 或 compose 的 `REDIS_URL` |
| 生成学情很慢/超时 | DeepSeek 网络；看 `docker compose logs web`，Nginx `proxy_read_timeout` 已设 120s |
| 构建镜像 OOM | 不要在 2G 服务器上 build，用 GitHub Actions 或本机 ≥4G 内存 |
| 证书续期失败 | 80 端口是否被占用/被墙；`sudo nginx -t` |
| 国内访问慢 | 确认 DNS 已切到国内服务器且已备案 |

---

## 9. 迁移完成后必须做的事

1. 改 APK 的 `mobile/capacitor.config.json` 里 `server.url` 为新域名，重新构建 APK
2. 已安装的 PWA 指向旧域名：做旧域名 301 跳转，或让老师重装
3. Vercel 保留 1–2 周作为回滚，再关掉
4. 同步更新 `.env.example` / 隐私政策里的域名

---

## 10. 内存评估

- Next.js standalone 运行时：约 150–400MB
- Redis：约 10–30MB
- Nginx：约 10–20MB
- 2G 内存余量充足；**构建不要在服务器上做**（Next build 容易超过 2G）
