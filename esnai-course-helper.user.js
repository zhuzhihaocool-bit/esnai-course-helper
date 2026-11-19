// ==UserScript==
// @name         上海国家会计学院继续教育 · 课程助手
// @namespace    https://github.com/zhuzhihaocool-bit/esnai-course-helper
// @version      1.8.1
// @description  读取课程进度、学时达标后在新标签打开下一门，并关闭旧播放标签。不改播放位置、不改静音、不监听网络、不创建 iframe。
// @author       zhuzhihaocool-bit
// @match        https://ce.esnai.net/*
// @homepageURL  https://github.com/zhuzhihaocool-bit/esnai-course-helper
// @supportURL   https://github.com/zhuzhihaocool-bit/esnai-course-helper/issues
// @license      MIT
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * 上海国家会计学院继续教育（ce.esnai.net）课程助手
 * MIT License
 *
 * 设计约束（这些"不做"是本项目存在的理由，请勿移除）：
 *   ✗ 不写 video.currentTime —— 流媒体 seek 到非关键帧会导致画面全黑但时间继续走
 *   ✗ 不写 video.muted / volume —— 部分播放器会因此停掉解码
 *   ✗ 不 hook fetch / XMLHttpRequest —— 视频分片被强行读取会拖死播放器
 *   ✗ 不创建 iframe 加载本站 —— 脚本会在 iframe 内再次注入，造成无限递归、浏览器卡死
 *   ✓ 只做：读 DOM、写 localStorage、window.open、video.playbackRate
 */

(function () {
    'use strict';

    /* ================= 安全边界（这一版的所有"不做"） =================
     * ✗ 不写 video.currentTime（跳转会打坏流媒体解码 → 黑屏）
     * ✗ 不写 video.muted / volume（可能干扰播放器）
     * ✗ 不 hook fetch / XMLHttpRequest（会拖死视频分片加载）
     * ✗ 不创建任何 iframe（会递归加载导致浏览器卡死）
     * ✗ 不在 iframe 内运行（只在最外层页面）
     * ✓ 只做：读 DOM、写 localStorage、window.open、video.playbackRate
     * ================================================================ */

    if (window.top !== window.self) return;                       // 只在最外层页面运行

    var K_ON = 'sh-auto';
    var K_COURSES = 'sh-courses';
    var K_DONE = 'sh-done';
    var K_ARRIVE = 'sh-arrive';
    var K_RATE = 'sh-rate';

    var VER = '1.8.1';
    var RATES = [1, 1.25, 1.5, 2, 3, 4];

    function ls(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
    function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function list(k) { try { var a = JSON.parse(ls(k, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function has(k, id) { return list(k).indexOf(String(id)) >= 0; }
    function add(k, id) { var a = list(k); if (id && a.indexOf(String(id)) < 0) { a.push(String(id)); set(k, JSON.stringify(a)); } }
    function del(k, id) { set(k, JSON.stringify(list(k).filter(function (x) { return x !== String(id); }))); }
    function tx(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
    function autoOn() { return ls(K_ON, '0') === '1'; }
    function listUrl() { return location.origin + '/cpvtianjin/study.do'; }
    function cwId() { var m = location.search.match(/courseWareId=(\d+)/i); return m ? m[1] : ''; }
    function isPlayer() { return /studyView\.do/i.test(location.pathname); }

    /* ---------------- 顶部横幅 ---------------- */
    // 主横幅：列表页的总控横幅永不自动消失（ms 只对播放页的临时提示生效）
    function banner(html, ms) {
        if (ms && !isPlayer()) ms = 0;    // 列表页忽略自动隐藏
        var b = document.getElementById('sh-banner');
        if (!b) {
            b = document.createElement('div');
            b.id = 'sh-banner';
            b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483646;padding:7px 34px 7px 14px;' +
                'font:12.5px/1.6 -apple-system,"Microsoft YaHei",sans-serif;color:#fff;background:#0969da;' +
                'box-shadow:0 2px 8px rgba(0,0,0,.2);text-align:center';
            document.body.appendChild(b);
            document.body.style.paddingTop = '38px';   // 让出横幅高度，避免遮住站点抬头
        }
        b.innerHTML = html +
            '<span id="sh-x" style="position:absolute;right:10px;top:6px;cursor:pointer;opacity:.85">✕</span>';
        b.style.display = '';
        var x = document.getElementById('sh-x');
        if (x) x.onclick = function () {
            b.style.display = 'none';
            document.body.style.paddingTop = '';
        };
        if (ms) setTimeout(function () {
            if (b) { b.style.display = 'none'; document.body.style.paddingTop = ''; }
        }, ms);
    }

    function bind(id, fn) { var e = document.getElementById(id); if (e) e.onclick = fn; }

    // 一次性提示用独立浮层：主横幅（倒计时/按钮）不受影响
    function toast(html, ms) {
        var t = document.getElementById('sh-toast');
        if (t) { try { t.parentNode.removeChild(t); } catch (e) {} }
        t = document.createElement('div');
        t.id = 'sh-toast';
        t.style.cssText = 'position:fixed;top:44px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
            'background:rgba(31,35,40,.94);color:#fff;padding:8px 16px;border-radius:8px;' +
            'font:12.5px/1.6 -apple-system,"Microsoft YaHei",sans-serif;' +
            'box-shadow:0 6px 20px rgba(0,0,0,.3);max-width:88vw;text-align:center';
        t.innerHTML = html;
        document.body.appendChild(t);
        if (ms !== 0) setTimeout(function () { try { if (t.parentNode) t.parentNode.removeChild(t); } catch (e) {} }, ms || 6000);
    }

    // 统一入口：一律新标签打开，当前标签保持不动
    function openNew(url, label) {
        if (!url) return;
        var w = null;
        try { w = window.open(url, '_blank'); } catch (e) { w = null; }
        if (w && !w.closed) {
            toast('✓ 已在新标签打开' + (label ? '「' + label + '」' : '') + '　本页继续当总控', 5000);
            return true;
        }
        // 被弹窗拦截：给一个按钮，点击手势一定能开新标签
        toast('<b>浏览器拦了新标签</b>　' +
              '<span id="sh-allow" style="text-decoration:underline;cursor:pointer">点这里打开' +
              (label ? '「' + label + '」' : '') + '</span>', 0);
        bind('sh-allow', function () {
            try { window.open(url, '_blank'); } catch (e) {}
            var t = document.getElementById('sh-toast');
            if (t) t.parentNode.removeChild(t);
            toast('✓ 已在新标签打开' + (label ? '「' + label + '」' : ''), 5000);
        });
        return false;
    }

    /* ---------------- 课程清单（只读 DOM） ---------------- */
    function idsOf(html) {
        var cw = '', oi = '';
        var m1 = html.match(/courseWareId["'\s:=]{0,3}(\d{3,})/i);
        if (m1) cw = m1[1];
        var m2 = html.match(/orderItemId["'\s:=]{0,3}(\d{3,})/i);
        if (m2) oi = m2[1];
        if (!cw) {
            var m3 = html.match(/(?:toStudy|play|study|open)\w*\s*\(\s*['"]?(\d{3,})['"]?\s*,\s*['"]?(\d{3,})['"]?/i);
            if (m3) { cw = m3[1]; oi = oi || m3[2]; }
        }
        if (!cw) {
            var m4 = html.match(/(?:toStudy|play|study|open)\w*\s*\(\s*['"]?(\d{3,})['"]?\s*[,)]/i);
            if (m4) cw = m4[1];
        }
        return { cw: cw, oi: oi };
    }

    function buildHref(cw, oi) {
        if (!cw) return '';
        return location.origin + '/cpvtianjin/studyView.do?courseWareId=' + cw + (oi ? '&orderItemId=' + oi : '');
    }

    function pickName(cells) {
        var best = '', n = -1;
        for (var i = 0; i < cells.length; i++) {
            var t = tx(cells[i].textContent);
            if (!t || t.indexOf('%') >= 0) continue;
            if (/^[\d.\s学时]+$/.test(t)) continue;
            if (/^(资产评估|会计|审计|金融|税务|经济|管理)$/.test(t)) continue;   // 类别列
            if (t.length > n) { n = t.length; best = t; }
        }
        // 剥离末尾「讲师名 + 序号」：如「…重点难点问题讲解 赵强 6」
        best = best.replace(/\s+(?:[\u4e00-\u9fa5]{2,3})\s+\d{1,3}$/, '');
        best = best.replace(/\s+\d{1,3}$/, '');
        // 剥离末尾孤立的人名（2-3 个汉字且前面是空格）
        best = best.replace(/\s+[\u4e00-\u9fa5]{2,3}$/, function (m) {
            // 只在长度明显偏短时剥离，避免误删正常词尾
            return m.length >= 3 ? '' : m;
        });
        return best.trim().slice(0, 50);
    }

    function scan() {
        var out = [], seen = {}, rows = document.querySelectorAll('tr');
        for (var r = 0; r < rows.length; r++) {
            var tr = rows[r];
            var whole = tx(tr.textContent);
            if (!whole || !/(?:^|[^\d])(\d{1,3})\s*%/.test(whole)) continue;
            var cells = Array.prototype.slice.call(tr.children);
            if (cells.length < 2) continue;

            // 从独立的单元格取百分比：tr.textContent 会把相邻单元格直接粘在一起
            // （"赵强 6" + "68%" → "668%"），按整行匹配会读错
            var pct = null;
            for (var ci = 0; ci < cells.length; ci++) {
                var ct = tx(cells[ci].textContent);
                var cm = ct.match(/^(\d{1,3})\s*%$/);
                if (cm) { pct = parseInt(cm[1], 10); break; }
            }
            if (pct === null) {
                var pm = whole.match(/(?:^|[^\d])(\d{1,3})\s*%/);
                if (pm) pct = parseInt(pm[1], 10);
            }
            var ids = idsOf(tr.outerHTML || '');
            var name = pickName(cells);
            var key = ids.cw || ('n:' + name);
            if (seen[key]) continue;
            seen[key] = 1;

            out.push({
                id: ids.cw || ('n:' + name),
                name: name,
                pct: pct,
                href: buildHref(ids.cw, ids.oi)
            });
        }
        return out;
    }

    function cache() { try { var a = JSON.parse(ls(K_COURSES, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function saveCache(l) {
        set(K_COURSES, JSON.stringify(l));
        set(K_COURSES + '-at', String(Date.now()));
    }
    function entry(id) {
        var l = cache();
        for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i];
        return null;
    }

    // 待学：列表页没到 100%、且不在完成/跳过名单
    function pending(l) {
        return l.filter(function (c) {
            if (c.pct !== null && c.pct >= 100) return false;
            if (has(K_DONE, c.id)) return false;
            return true;
        }).sort(function (a, b) {
            var pa = (a.pct === null ? 999 : a.pct);
            var pb = (b.pct === null ? 999 : b.pct);
            return pb - pa;      // 学过的优先收尾（百分比高的先）
        });
    }

    /* ---------------- 列表页 ---------------- */
    // 列表页自动刷新：让表格里的百分比保持最新，不依赖手动 F5
    function refreshSec() {
        var sec = parseInt(ls('sh-refresh', '300'), 10) || 300;
        if (sec < 15) sec = 15;
        return sec;
    }

    function startAutoRefresh() {
        var sec = refreshSec();

        if (window.__shRefreshTimer) clearInterval(window.__shRefreshTimer);

        // 记录本次会话内刷新次数，用于在横幅上自证"真的在刷"
        window.__shRefreshCount = window.__shRefreshCount || 0;
        window.__shRefreshAt = Date.now();

        window.__shRefreshTimer = setInterval(function () {
            // 不依赖 autoOn：用户要的是"列表页保持最新"，与是否自动跳课无关
            // 不再判断 document.hidden：列表页常常在后台标签，后台更要刷新
            window.__shRefreshCount++;
            try { sessionStorage.setItem('sh-refresh-count', String(window.__shRefreshCount)); } catch (e) {}
            try { sessionStorage.setItem('sh-refresh-at', String(Date.now())); } catch (e) {}
            location.reload();
        }, sec * 1000);
    }

    // 每秒更新横幅上的倒计时，让"它在工作"看得见
    function startTick(sec) {
        if (window.__shTickTimer) clearInterval(window.__shTickTimer);
        window.__shTickTimer = setInterval(function () {
            var el = document.getElementById('sh-tick');
            if (!el) return;
            var t0 = 0;
            try { t0 = parseInt(sessionStorage.getItem('sh-refresh-at') || '0', 10) || 0; } catch (e) {}
            var base = t0 || window.__shRefreshAt || Date.now();
            var left = Math.max(0, sec - Math.round((Date.now() - base) / 1000));
            el.textContent = '⟳ ' + left + ' 秒后刷新此页';
        }, 1000);
    }

    function onList() {
        var tries = 0;
        (function wait() {
            var l = scan();
            if (!l.length && ++tries < 30) {
                banner('正在等待课程表格加载… ' + tries + ' 秒');
                setTimeout(wait, 1000);
                return;
            }
            if (!l.length) {
                banner('没扫到课程表格　<span id="sh-rl" style="text-decoration:underline;cursor:pointer">重新加载页面</span>');
                bind('sh-rl', function () { location.reload(); });
                return;
            }

            saveCache(l);

            var on = autoOn();
            var p = pending(l);
            var next = p[0];

            // 接力：上一门播完跳回列表页 → 自动进下一门（3 秒可取消）
            if (on && ls(K_ARRIVE, '') === '1') {
                set(K_ARRIVE, '');
                if (next && next.href) {
                    var n = 3;
                    var iv = setInterval(function () {
                        if (n <= 0) {
                            clearInterval(iv);
                            openNew(next.href, next.name);      // 新标签，列表页原样留着
                            return;
                        }
                        banner('<b>接力进入下一门</b>　' + n + ' 秒后在新标签打开「' + next.name + '」　' +
                               '<span id="sh-stop" style="text-decoration:underline;cursor:pointer">停止</span>');
                        bind('sh-stop', function () { clearInterval(iv); set(K_ON, '0'); location.reload(); });
                        n--;
                    }, 1000);
                    return;
                }
            }

            var refSec = refreshSec();
            var count = 0;
            try { count = parseInt(sessionStorage.getItem('sh-refresh-count') || '0', 10) || 0; } catch (e) {}
            var extra = '共 ' + l.length + ' 门　待学 ' + p.length + ' 门　' +
                        '<span id="sh-tick" style="color:#7ee787;font-weight:600">⟳ 自动刷新已就绪</span>' +
                        '（本次会话已刷 ' + count + ' 次）　' +
                        '<span id="sh-rnow" style="text-decoration:underline;cursor:pointer">立即刷新</span>' +
                        '　v' + VER;
            if (!next) {
                banner('<b>🎉 没有待学的课程了</b>　' + extra);
                set(K_ON, '0');
                return;
            }

            var badge = on
                ? '<b style="background:#1a7f37;padding:1px 7px;border-radius:4px;font-size:11px">已开启</b>'
                : '<b style="background:#cf222e;padding:1px 7px;border-radius:4px;font-size:11px">已关闭</b>';
            banner(
                '<div style="display:flex;align-items:center;justify-content:center;gap:9px;flex-wrap:wrap">' +
                  '<span>自动跳课 ' + badge + '</span>' +
                  '<span style="opacity:.45">|</span>' +
                  '<span>待学 <b>' + p.length + '</b> 门</span>' +
                  '<span style="opacity:.45">|</span>' +
                  '<span>下一门 <b>' + next.name.slice(0, 18) + '</b>' +
                    '<span style="opacity:.75">（' + (next.pct === null ? '?' : next.pct) + '%）</span></span>' +
                  '<span id="sh-enter" style="background:#fff;color:#0969da;padding:2px 10px;border-radius:5px;' +
                    'cursor:pointer;font-weight:600;font-size:12px">现在就进这门 →</span>' +
                '</div>' +
                '<div style="opacity:.85;font-size:11px;margin-top:4px">' + extra + '　' +
                  '<span id="sh-go" style="text-decoration:underline;cursor:pointer">' + (on ? '关闭自动' : '开启自动') + '</span>' +
                '</div>');

            bind('sh-go', function () { set(K_ON, on ? '0' : '1'); location.reload(); });
            bind('sh-enter', function () { openNew(next.href, next.name); });

            bind('sh-rnow', function () { location.reload(); });
            // 记住总控横幅已在，后续刷新重建
            startAutoRefresh();
            startTick(refreshSec());
        })();
    }

    /* ---------------- 播放页 ---------------- */
    function longestVideo() {
        var vs = document.querySelectorAll('video'), best = null, bd = 0;
        for (var i = 0; i < vs.length; i++) {
            var d = isFinite(vs[i].duration) ? vs[i].duration : 0;
            if (d > bd) { bd = d; best = vs[i]; }
        }
        if (!best || bd < 60) return null;      // 只有短片段：不认，避免误判完成
        return best;
    }

    function fmt(s) {
        s = Math.max(0, Math.round(s));
        var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
        function p(n) { return (n < 10 ? '0' : '') + n; }
        return (h ? h + ':' + p(m) : m) + ':' + p(x);
    }

    // 单实例守卫：同一个浏览器只保留一个播放标签
    var TAB_ID = 'p' + Date.now() + Math.random().toString(36).slice(2, 7);
    function claimActive() {
        try {
            localStorage.setItem('sh-active-player', JSON.stringify({ id: TAB_ID, at: Date.now() }));
        } catch (e) {}
    }
    function isSuperseded() {
        try {
            var o = JSON.parse(localStorage.getItem('sh-active-player') || 'null');
            return o && o.id !== TAB_ID && (Date.now() - o.at) < 30000;
        } catch (e) { return false; }
    }

    // 旧标签自我退出：先试 close()，不行就变成空白页（不再占内存/占用账号并发）
    function retireSelf(why) {
        banner('本标签已完成使命，正在释放…（' + why + '）', 0);
        setTimeout(function () {
            try { window.close(); } catch (e) {}
            // 若浏览器不允许脚本关闭（用户手动打开的标签），退化为空白页
            setTimeout(function () {
                try { location.replace('about:blank'); } catch (e) {}
            }, 600);
        }, 1500);
    }

    // 自动播放兜底：只调用 play()，绝不改 muted/volume（旧版黑屏教训）
    function autoPlayKick() {
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            var v = longestVideo();
            if (v) {
                if (!v.paused) { clearInterval(iv); return; }
                try {
                    var pr = v.play();
                    if (pr && pr.catch) {
                        pr.catch(function () {
                            // 被自动播放策略拒绝：给一个明显的手动按钮（不发声音也不静音）
                            if (document.getElementById('sh-play-btn')) return;
                            var b = document.createElement('div');
                            b.id = 'sh-play-btn';
                            b.textContent = '▶ 点这里开始播放';
                            b.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
                                'z-index:2147483647;cursor:pointer;background:#0969da;color:#fff;' +
                                'padding:14px 28px;border-radius:10px;font:15px -apple-system,"Microsoft YaHei",sans-serif;' +
                                'box-shadow:0 8px 28px rgba(0,0,0,.35)';
                            b.onclick = function () {
                                try { v.play(); } catch (e) {}
                                try { b.parentNode.removeChild(b); } catch (e) {}
                            };
                            document.body.appendChild(b);
                        });
                    }
                } catch (e) {}
            }
            if (tries > 30) clearInterval(iv);
        }, 1000);
    }

    function onPlayer() {
        var myId = cwId(), fired = false, lastDur = 0;

        claimActive();                 // 声明"我才是当前播放标签"
        autoPlayKick();                // 自动播放兜底（只 play，不碰 muted）

        // 面板：进度 + 倍速（只动 playbackRate，安全）
        var pn = document.createElement('div');
        pn.id = 'sh-panel';
        pn.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483646;width:210px;' +
            'background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:9px 11px;' +
            'font:12px/1.7 -apple-system,"Microsoft YaHei",sans-serif;color:#1f2328;' +
            'box-shadow:0 6px 20px rgba(0,0,0,.14)';
        var rb = RATES.map(function (v) {
            return '<button data-r="' + v + '" style="flex:1;font:10.5px inherit;padding:2px 0;cursor:pointer;' +
                'border:1px solid #d0d7de;background:#fff;color:#1f2328;border-radius:4px">' + v + '</button>';
        }).join('');
        pn.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<b style="font-size:12px">课程助手 v' + VER + '</b>' +
              '<span id="sh-px" style="cursor:pointer;color:#8b949e">✕</span>' +
            '</div>' +
            '<div id="sh-line" style="margin:3px 0">读取中…</div>' +
            '<div style="display:flex;gap:3px;margin-top:5px">' + rb + '</div>' +
            '<div id="sh-next" style="margin-top:6px;padding-top:6px;border-top:1px solid #eaeef2;' +
                 'font-size:11px;color:#57606a">下一门：读取中…</div>';
        document.body.appendChild(pn);
        bind('sh-px', function () { pn.style.display = 'none'; });

        var rate = parseFloat(ls(K_RATE, '1')) || 1;
        var btns = pn.querySelectorAll('button');

        function paintRate() {
            for (var i = 0; i < btns.length; i++) {
                var on = Math.abs(parseFloat(btns[i].getAttribute('data-r')) - rate) < 0.01;
                btns[i].style.background = on ? '#1a7f37' : '#fff';
                btns[i].style.color = on ? '#fff' : '#1f2328';
                btns[i].style.borderColor = on ? '#1a7f37' : '#d0d7de';
            }
        }
        for (var i = 0; i < btns.length; i++) {
            btns[i].onclick = function () {
                rate = parseFloat(this.getAttribute('data-r'));
                set(K_RATE, String(rate));
                var v = longestVideo();
                if (v) { try { v.playbackRate = rate; } catch (e) {} }
                paintRate();
            };
        }
        paintRate();

        function done(reason) {
            if (fired) return;
            fired = true;
            add(K_DONE, myId);
            if (!autoOn()) { banner('<b>本课播完了</b>　自动跳课已关闭', 8000); return; }

            var e = entry(myId);
            var p = pending(cache());
            var next = p[0];

            // 平台没认（列表页百分比未满）→ 不跳，避免学时丢失
            if (e && e.pct !== null && e.pct < 100) {
                banner('<b>视频播完了，但列表页只记到 ' + e.pct + '%</b>　' +
                       '让本页继续开着累计学时（列表页每 5 分钟同步一次）　' +
                       '<span id="sh-force" style="text-decoration:underline;cursor:pointer">仍然跳下一门</span>');
                bind('sh-force', function () { fired = false; add(K_DONE, myId); jump(next); });
                return;
            }
            jump(next);
        }

        function jump(next) {
            if (next && next.href) {
                var n = 6;
                var iv = setInterval(function () {
                    if (n <= 0) {
                        clearInterval(iv);
                        var ok = openNew(next.href, next.name);
                        if (ok) retireSelf('已开下一门');   // 新标签开了，自己退出，只留一个播放标签
                        return;
                    }
                    banner('<b>本课完成</b>　' + n + ' 秒后<b>在新标签</b>打开：' + next.name.slice(0, 20) + '　' +
                           '<span id="sh-now" style="text-decoration:underline;cursor:pointer">立即打开</span>');
                    bind('sh-now', function () {
                        clearInterval(iv);
                        var ok2 = openNew(next.href, next.name);
                        if (ok2) retireSelf('已开下一门');
                    });
                    n--;
                }, 1000);
                return;
            }
            set(K_ARRIVE, '1');
            var n2 = 5;
            var iv2 = setInterval(function () {
                if (n2 <= 0) { clearInterval(iv2); location.href = listUrl(); return; }
                banner('<b>本课完成</b>　' + n2 + ' 秒后回列表页刷新清单　' +
                       '<span id="sh-l2" style="text-decoration:underline;cursor:pointer">现在就去</span>');
                bind('sh-l2', function () { clearInterval(iv2); location.href = listUrl(); });
                n2--;
            }, 1000);
        }

        // 平台学时一满就可以走了：不必等视频播到最后（列表页刷新后 pct 会更新）
        setInterval(function () {
            if (fired || !autoOn()) return;
            var e = entry(myId);
            if (!e || e.pct === null || e.pct < 100) return;
            var v0 = longestVideo();
            // 双保险：平台满了，且视频已经播过一半，才认为确实学够了
            if (v0 && v0.duration > 0 && v0.currentTime / v0.duration > 0.5) done('platform-full');
        }, 5000);

        setInterval(function () {
            var v = longestVideo();
            var line = document.getElementById('sh-line');
            if (!v) {
                if (line) line.textContent = '未识别到播放器';
                return;
            }

            // 时长突然缩水一半以上（切到广告/预览）→ 本轮忽略
            var d = v.duration || 0;
            if (lastDur > 60 && d < lastDur * 0.5) return;
            lastDur = d;

            // 倍速守护（只在非 1x 时）
            if (rate && Math.abs((v.playbackRate || 1) - rate) > 0.01) {
                try { v.playbackRate = rate; } catch (e) {}
            }

            var e = entry(myId);
            var plat = (e && e.pct !== null) ? e.pct + '%' : '?';
            // 下一门信息 + 平台满了一键跳
            var box = document.getElementById('sh-next');
            if (box) {
                var nxt = pending(cache())[0];
                var platOk = (e && e.pct !== null && e.pct >= 100);
                if (platOk) {
                    box.innerHTML = '<b style="color:#1a7f37">平台学时已满</b>　' +
                        '<span id="sh-jump" style="text-decoration:underline;cursor:pointer;color:#0969da">跳下一门</span>';
                    bind('sh-jump', function () { if (!fired) done('manual'); });
                } else if (nxt) {
                    box.innerHTML = '下一门：' + nxt.name.slice(0, 16) + '（' + (nxt.pct === null ? '?' : nxt.pct) + '%）';
                } else {
                    box.innerHTML = '<span style="color:#8b949e">没有待学课程</span>';
                }
            }

            if (line) {
                var at = parseInt(ls(K_COURSES + '-at', '0'), 10);
                var ago = at ? Math.max(0, Math.round((Date.now() - at) / 1000)) : 0;
                line.innerHTML = '视频 ' + fmt(v.currentTime) + ' / ' + fmt(d) +
                    '<br><b>平台 ' + plat + '</b>' +
                    (at ? ' <span style="color:#8b949e;font-size:10.5px">(' + ago + 's前)</span>' : ' <span style="color:#cf222e">列表页未开</span>') +
                    '<br><span style="color:#8b949e">剩余 ' + fmt(Math.max(0, d - v.currentTime)) + '</span>';
            }

            if (!fired && d > 0 && (v.ended || v.currentTime / d >= 0.995)) done('ended');

            // 已被更新的播放标签接管 → 主动退出，避免多个标签同时解码
            if (!window.__shSuperseded && isSuperseded()) {
                window.__shSuperseded = true;
                try { if (v && !v.paused) v.pause(); } catch (e) {}
                retireSelf('另一标签已接管');
            }
        }, 2000);
    }

    /* ---------------- 启动 ---------------- */
    if (!document.body) return;
    if (isPlayer()) onPlayer(); else onList();
})();
