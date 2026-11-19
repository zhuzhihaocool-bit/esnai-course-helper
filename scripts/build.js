#!/usr/bin/env node
/**
 * 从主脚本生成开发版。
 *
 * 用法：node scripts/build.js
 *
 * 做的事：
 *   1. 读取根目录的主脚本
 *   2. 把 @version 改成 x.y.z-dev，@name 加"（开发版）"后缀
 *   3. 注入 DBG 日志与 window.__esh 调试入口
 *   4. 输出到 dev/esnai-course-helper.dev.user.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'esnai-course-helper.user.js');
const OUT = path.join(ROOT, 'dev', 'esnai-course-helper.dev.user.js');

function main() {
    if (!fs.existsSync(SRC)) {
        console.error('找不到主脚本：' + SRC);
        process.exit(1);
    }

    let code = fs.readFileSync(SRC, 'utf8');

    // 版本号加 -dev
    code = code.replace(/(\/\/ @version\s+)([\d.]+)/, (m, p1, p2) => p1 + p2 + '-dev');

    // 名称加后缀
    code = code.replace(/(\/\/ @name\s+)(.+)/, (m, p1, p2) => p1 + p2 + '（开发版）');

    // 注入调试日志：在 IIFE 内 'use strict' 之后
    const hook = `
    /* ===== 开发版注入 ===== */
    var __DBG = true;
    function DBG() {
        if (!__DBG) return;
        var a = Array.prototype.slice.call(arguments);
        a.unshift('[esh]');
        console.log.apply(console, a);
    }
    window.__esh = {
        version: typeof VER !== 'undefined' ? VER : 'unknown',
        cache: function () { try { return JSON.parse(localStorage.getItem('sh-courses') || '[]'); } catch (e) { return []; } },
        done: function () { try { return JSON.parse(localStorage.getItem('sh-done') || '[]'); } catch (e) { return []; } },
        reset: function () {
            ['sh-auto','sh-courses','sh-done','sh-arrive','sh-rate','sh-refresh','sh-active-player']
                .forEach(function (k) { localStorage.removeItem(k); });
            location.reload();
        }
    };
    DBG('开发版已加载，调试入口 window.__esh');
    /* ===== 注入结束 ===== */
`;
    code = code.replace("'use strict';", "'use strict';\n" + hook);

    // 确保目录存在
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, code, 'utf8');

    const lines = code.split('\n').length;
    console.log('已生成开发版：' + path.relative(ROOT, OUT));
    console.log('  行数：' + lines);
}

main();
