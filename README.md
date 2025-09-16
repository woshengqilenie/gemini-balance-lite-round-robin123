# Gemini Balance Lite (安全增强版)

本仓库是 [tech-shrimp/gemini-balance-lite](https://github.com/tech-shrimp/gemini-balance-lite) 的一个优化版本，专为 Vercel 平台部署而设计，提供了更高的安全性和稳定性。

### 原作者：技术爬爬虾
[B站](https://space.bilibili.com/316183842)，[Youtube](https://www.youtube.com/@Tech_Shrimp)，抖音，公众号 全网同名。转载请注明作者。


## 项目简介

Gemini API 代理, 使用边缘函数把 Gemini API 免费中转到国内。还可以聚合多个 Gemini API Key，随机选取 API Key 的使用实现负载均衡，使得 Gemini API 免费额度成倍增加。

---

## Vercel 部署 (推荐的最终安全版)

这个版本经过了特别优化，以提供最高的安全性和稳定性。它通过服务端环境变量来管理所有真实的 API 密钥，客户端只使用一个您自己设定的“访问密码”。

#### **1. 一键部署**

您可以直接点击下方的按钮，将这个优化过的版本一键部署到您自己的 Vercel 账户：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/woshengqilenie/gemini-balance-lite)

#### **2. 关闭 Vercel 部署保护 (关键步骤)**

部署成功后，您需要手动关闭一个安全设置，以允许 API 请求通过。

1.  在 Vercel 项目页面，点击 **Settings** -> **Deployment Protection**。
2.  找到 **Vercel Authentication** 区域。
3.  **点击蓝色的开关**，将它从 "Enabled" 切换到 **"Disabled"** 状态，并保存。

#### **3. 配置环境变量 (核心步骤)**

这是最关键的一步，您需要设置“访问密码”和“真实密钥池”。

1.  在 Vercel 项目页面，点击 **Settings** -> **Environment Variables**。
2.  **创建“访问密码” (ACCESS_KEY):**
    *   **Key:** `ACCESS_KEY`
    *   **Value:** 输入一个**您自己设定的、专属的密码** (例如: `my-secret-pass-2025`)。这个密码将是您所有客户端的唯一“门票”。
    *   点击 **Save**。
3.  **创建“真实密钥池” (GEMINI_API_KEYS):**
    *   点击 **Add Another**。
    *   **Key:** `GEMINI_API_KEYS`
    *   **Value:** 填入您**所有真实有效**的 Gemini API Key，用**英文逗号 (`,`)** 分隔。
    *   点击 **Save**。

#### **4. 重新部署以激活**

添加完环境变量后，**必须**重新部署一次才能生效。

1.  点击顶部的 **Deployments** 选项卡。
2.  找到最顶部的那条部署记录，点击它右侧的 "..." 菜单，选择 **Redeploy**，并确认。

#### **5. 配置您的 AI 客户端 (以 CCR 为例)**

等待 Vercel 重新部署成功后，您的专属安全代理服务就已经完全准备就绪了。

这个服务是一个**通用**的 Gemini API 代理，您可以将它接入任何支持自定义 Gemini API 端点的 AI 客户端。配置的核心原则是：

*   **API 地址/端点 (Endpoint / API Base URL):** 使用您的 Vercel 部署域名。
*   **API 密钥 (API Key):** 使用您在 Vercel 环境变量中设置的 `ACCESS_KEY` 作为“访问密码”。

#### **配置示例 (以 Claude Code Router 为例)**

1.  在您的 Vercel 项目主页的 **Domains** 区域，找到并复制您的主域名 (例如 `gemini-balance-lite-wsqlns-projects.vercel.app`)。

2.  打开您的 Claude Code Router `config.json` 文件，并将其修改为以下格式，确保**每一个键名的大小写和空格都完全一致**：

    ```json
    {
      "PROXY URL": "http://127.0.0.1:<您的代理端口>",
      "LOG": true,
      "API TIMEOUT MS": 600000,
      "NON INTERACTIVE MODE": false,
      "Providers": [
        {
          "name": "gemini",
          "api base url": "https://<您的Vercel主域名>/v1beta/models/",
          "api key": "<您在ACCESS_KEY中设置的专属密码>",
          "models": [
            "gemini-2.5-flash",
            "gemini-2.5-pro"
          ],
          "transformer": {
            "use": ["gemini"]
          }
        }
      ],
      "Router": {
        "default": "gemini,gemini-2.5-pro",
        "background": "gemini,gemini-2.5-flash",
        "think": "gemini,gemini-2.5-pro",
        "longContext": "gemini,gemini-2.5-pro",
        "longContextThreshold": 60000,
        "webSearch": "gemini,gemini-2.5-flash"
      }
    }
    ```
    *   将 `<您的代理端口>` 替换为您 CCR 本地的代理端口 (例如 `10808`)。
    *   将 `<您的Vercel主域名>` 替换为您 Vercel 项目的真实主域名。
    *   将 `<您在ACCESS_KEY中设置的专属密码>` 替换为您在 Vercel 中为 `ACCESS_KEY` 设置的密码。

#### **其他客户端的配置思路**

对于其他客户端（如 LobeChat, One API, NextChat 等），请在其设置中找到“自定义 Gemini 模型”或“自定义 API 端点”的选项，然后填入：

*   **API Base URL / Endpoint:** `https://<您的Vercel主域名>`
*   **API Key:** `<您在ACCESS_KEY中设置的专属密码>`

---

## 其他平台部署 (原作者说明)

<details>
<summary>点击展开 Deno, Cloudflare, Netlify 的部署说明</summary>

### Deno部署

1. [fork](https://github.com/tech-shrimp/gemini-balance-lite/fork)原作者项目
2. 登录/注册 https://dash.deno.com/
3. 创建项目 https://dash.deno.com/new_project
4. 选择此项目，填写项目名字（请仔细填写项目名字，关系到自动分配的域名）
5. Entrypoint 填写 `src/deno_index.ts` 其他字段留空
6. 点击 <b>Deploy Project</b>
7. ... (后续步骤请参考原作者仓库)

### Cloudflare Worker 部署
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tech-shrimp/gemini-balance-lite)

*   (请参考原作者仓库说明)

### Netlify部署
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/tech-shrimp/gemini-balance-lite)

*   (请参考原作者仓库说明)

</details>

## 打赏
#### 帮忙点点关注点点赞，谢谢啦~
B站：[https://space.bilibili.com/316183842](https://space.bilibili.com/316183842)<br>
Youtube: [https://www.youtube.com/@Tech_Shrimp](https://www.youtube.com/@Tech_Shrimp)
