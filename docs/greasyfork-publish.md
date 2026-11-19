# Greasy Fork 发布信息

> 提交地址：https://greasyfork.org/zh-CN/scripts/new
> 需要登录你的 Greasy Fork 账号，我无法代你提交。

---

## 一、提交表单怎么填

### 脚本来源

选 **"从 URL 导入"**，填：

```
https://raw.githubusercontent.com/zhuzhihaocool-bit/esnai-course-helper/main/esnai-course-helper.user.js
```

> 这样做的好处：以后 GitHub 更新，Greasy Fork 能同步（或你再点一次导入）。
> 也可以选"直接输入代码"然后粘贴全文。

### 脚本名称

```
上海国家会计学院继续教育 · 课程助手
```

### 描述（一句话，会显示在列表里）

```
读取课程进度、学时达标自动进入下一门。不改播放位置、不改静音、不伪造学时。
```

### 附加标签（Additional tags）

```
继续教育 tampermonkey userscript 上海国家会计学院 esnai 课程助手
```

### 语言

```
中文（简体）
```

---

## 二、两份说明文字（直接复制粘贴）

### ① 脚本说明（Description，显示在脚本页顶部）

```markdown
## 这是什么

一个 Tampermonkey 用户脚本，用于 **ce.esnai.net**（上海国家会计学院远程教育网 · 天津资产评估师继续教育）。

**它只做三件事**：读课程进度、学时达标后在新标签打开下一门、关闭旧播放标签。

> ⚠️ **本脚本不代学、不刷课、不伪造学时。** 学时全部来自你本人实际播放的时间。
> 目标只有一个：把"守着看课"变成"挂着后台去做别的事"。

## 为什么不做"加速"

这个平台的学时机制很特殊，我用 DevTools 抓包确认过：

| 事实 | 证据 |
|---|---|
| 学时按**真实流逝时间**累计 | 每 60 秒向 `updateTimeSeconds.do` 上报 `seconds=60` |
| **倍速不增加学时** | 4x 播放时上报值仍是 `seconds=60` |
| 学时可能被**回扣** | 实测出现过 232 分钟 → 229 分钟 |

所以：

| 倍速 | 视频播完耗时 | 平台记录 | 还要补播 |
|---|---|---|---|
| 1x | 262 分钟 | 262 分钟 | 0 |
| 4x | 65 分钟 | 65 分钟 | **197 分钟** |

**总时长恒为 262 分钟，倍速只会让你多花注意力。**

任何"跳进度、二段播放、伪造上报值"的做法，在这个平台上都是负收益，
而且后者属于向发证机构申报虚假学时。

## 功能

- 📋 读取课程清单（课程名 / 百分比）
- ⟳ 列表页自动刷新（默认 5 分钟，可配置）
- 🎯 列表页显示 100% 时，在新标签打开下一门
- 🗂 新标签打开后自动释放旧播放标签（只保留一个）
- ▶ 自动播放兜底，被浏览器拦截时给出明显的点击按钮
- 🛡 视频播完但平台未满 100% 时**不跳转**，提示继续累计

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/)
2. 点本页的"安装此脚本"
3. 打开 `https://ce.esnai.net/cpvtianjin/study.do`，顶部出现蓝色横幅即成功

## 使用

保持两个标签页：

```
① 列表页 study.do   ← 总控台，别关，它会自己刷新
② 播放页            ← 点「现在就进这门」打开

之后不用管：学时满 → 新标签开下一门 → 旧标签自动释放 → 循环
```

## 设计约束（这些"不做"是踩坑换来的）

- ✗ 不写 `video.currentTime` —— 流媒体 seek 到非关键帧会**画面全黑但时间继续走**
- ✗ 不写 `video.muted` / `volume` —— 部分播放器会因此停掉解码
- ✗ 不 hook `fetch` / `XMLHttpRequest` —— 视频分片被强行读取会拖死播放器
- ✗ 不创建 iframe 加载本站 —— 脚本会在 iframe 内再次注入，造成**无限递归、浏览器卡死**
- ✗ 不伪造 `seconds` 上报值

脚本**只写一个播放器属性**：`playbackRate`（倍速）。这个操作可逆，不影响解码。

## 已知限制

- 仅适配天津站点（`ce.esnai.net/cpvtianjin/`）
- 依赖列表页做数据源，关掉列表页后百分比不更新
- 浏览器只允许脚本关闭自己 `window.open` 打开的标签
- 自动播放可能被 Chrome 拦截，此时需点一下按钮

## 更多文档

- 学时机制详细说明：[how-timing-works.md](https://github.com/zhuzhihaocool-bit/esnai-course-helper/blob/main/docs/how-timing-works.md)
- 问题排查：[troubleshooting.md](https://github.com/zhuzhihaocool-bit/esnai-course-helper/blob/main/docs/troubleshooting.md)

## 免责声明

本项目为浏览器用户脚本技术学习与研究之用。脚本不修改任何服务端数据，不伪造学时，不跳过学习过程。
使用者应遵守平台服务条款及所在地区相关规定，使用后果由使用者自行承担。
```

### ② 附加信息（Additional info，可选）

```markdown
源码与问题反馈：https://github.com/zhuzhihaocool-bit/esnai-course-helper

MIT License
```

---

## 三、提交前的检查

- [ ] GitHub 仓库是**公开**状态（Greasy Fork 需要能访问 raw 地址）
- [ ] 脚本 `@version` 与 `var VER` 一致
- [ ] 脚本能通过 `node --check`
- [ ] 没有泄露个人信息（姓名、订单号、Cookie）

---

## 四、提交后

1. Greasy Fork 会**人工审核**（通常几小时到两天）
2. 审核通过后，脚本页会出现"安装此脚本"按钮
3. 你在 Greasy Fork 的脚本页 → Admin → 可以补充"代码同步"设置：
   - 设置 **Sync type: Automatic**（自动从 GitHub 同步）
   - 这样以后 GitHub 推送新版本，Greasy Fork 会自动更新

### 注意

Greasy Fork 发布后，**脚本头的 `@downloadURL` / `@updateURL` 会指向 Greasy Fork**（Greasy Fork 会自动改写这两个字段）。
这是好事：Tampermonkey 从 Greasy Fork 更新比从 GitHub raw 更新更稳定（不受 raw 限流影响）。

---

## 五、如果被拒

常见原因：

| 原因 | 处理 |
|---|---|
| 判定为"作弊脚本" | 强调不伪造学时、不跳进度，附上 `docs/how-timing-works.md` 说明 |
| 描述里有敏感词（刷课/代学） | 本文件的文案已规避，不要自己加这类词 |
| 无法访问安装地址 | 确认仓库是 Public，raw 地址可访问 |
