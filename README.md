# 推敲

粘贴一段中文，模糊之处会以深浅标出，点击任意一处，逐个想清楚。

## 本地运行

```bash
npm install
cp .env.local.example .env.local
# 编辑 .env.local，填入 KIMI_API_KEY
npm run dev
```

打开 http://localhost:3000

## 环境变量

| 变量 | 说明 |
|---|---|
| `KIMI_API_KEY` | 必填。Moonshot (Kimi) 的 API key，在 https://platform.moonshot.cn 申请 |
| `KIMI_MODEL` | 可选，默认 `moonshot-v1-32k`。可选 `moonshot-v1-8k` / `moonshot-v1-128k` / `kimi-latest` 等 |

## 部署到 Vercel

1. 把本仓库推到 GitHub
2. 在 https://vercel.com/new 导入该仓库
3. 在 **Environment Variables** 里添加 `KIMI_API_KEY`（可选再加 `KIMI_MODEL`）
4. Deploy

## 项目结构

```
app/
  layout.js
  page.js
  api/analyze/route.js   # 调用 Kimi，返回 JSON
components/
  Tuiqiao.jsx            # UI 主体
```

## 核心流程

前端把文本 POST 到 `/api/analyze` → 服务端调用 Kimi 的 chat/completions（OpenAI 兼容格式，`response_format: json_object`）→ 返回结构化 JSON：每句的抽象层、话语行为层、句间逻辑、模糊词（含 severity、可能含义、精确改写、追问）、跳层点。
