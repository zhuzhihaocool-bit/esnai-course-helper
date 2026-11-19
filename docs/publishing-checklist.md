# 发布检查清单

开源前逐条核对。打勾的表示已完成。

## 内容

- [x] 主脚本 `esnai-course-helper.user.js` 可独立运行，无外部依赖
- [x] 脚本头部元信息完整（`@name` / `@namespace` / `@version` / `@match` / `@license` / `@supportURL`）
- [x] 版本号在两处一致（`@version` 与 `var VER`）
- [x] `README.md` 说明：做什么、不做什么、为什么、怎么装
- [x] `LICENSE`（MIT）
- [x] `CHANGELOG.md`
- [x] `docs/how-timing-works.md`（学时机制，含实测抓包）
- [x] `docs/troubleshooting.md`（常见问题）
- [x] `.gitignore` / `.gitattributes`
- [x] 免责声明（README 末尾）
- [x] 明确写出"不做"清单及原因

## 需要你手动替换的占位符

发布前必须改掉，否则会指向错误地址：

| 文件 | 占位符 | 改成 |
|---|---|---|
| `esnai-course-helper.user.js` | `<zhuzhihaocool-bit>`（在 `@namespace` / `@author` / `@homepageURL` / `@supportURL`） | 你的 GitHub 用户名 |
| `README.md` | 无 | — |
| `CHANGELOG.md` | 无 | — |
| `LICENSE` | `esnai-course-helper contributors` | 可保留，或改成你的名字 |

替换命令（在仓库根目录）：

```bash
# 把 zhuzhihaocool-bit 换成你的 GitHub 用户名
sed -i 's/zhuzhihaocool-bit/YOUR_GITHUB_NAME/g' esnai-course-helper.user.js
```

## 建议补充（非必需，但能让项目更完整）

- [ ] **截图**：列表页横幅、播放页面板各一张，放 `docs/images/`，README 里引用
- [ ] **Greasy Fork 同步**：发布到 https://greasyfork.org 可获得自动更新（在脚本头加 `@downloadURL` / `@updateURL`）
- [ ] **Issue 模板**：`.github/ISSUE_TEMPLATE/bug_report.md`（要求填版本号、浏览器版本、Console 报错）
- [ ] **GitHub Actions**：push 时自动跑 `node --check` 校验语法
- [ ] **`.github/workflows/check.yml`** 示例：

```yaml
name: syntax-check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: node --check esnai-course-helper.user.js
      - run: node scripts/build.js
```

## 发布步骤

```bash
# 1. 替换占位符
sed -i 's/zhuzhihaocool-bit/YOUR_GITHUB_NAME/g' esnai-course-helper.user.js

# 2. 重新生成开发版（可选）
node scripts/build.js

# 3. 语法校验
node --check esnai-course-helper.user.js

# 4. 提交
git add -A
git commit -m "chore: 替换占位符为实际仓库地址"

# 5. 在 GitHub 创建空仓库（不要初始化 README），然后：
git remote add origin https://github.com/YOUR_GITHUB_NAME/esnai-course-helper.git
git branch -M main
git push -u origin main
```

## 发布后

- [ ] 仓库 About 里填一句话简介 + topics：`userscript` `tampermonkey` `esnai` `继续教育`
- [ ] 打开 Issues
- [ ] 如果需要自动更新，发布到 Greasy Fork 并在脚本头补 `@downloadURL`

## 不建议做的事

- ❌ 不要在 README 里宣传"刷课""代学""加速完成"——本项目刻意不做这些
- ❌ 不要在 Issue 里接受"跳过视频"类需求，理由见 `docs/how-timing-works.md`
- ❌ 不要提交任何含个人账号信息、课程 ID、抓包 Cookie 的截图
