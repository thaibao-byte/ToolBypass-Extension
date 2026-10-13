(function () {
    'use strict';

    var HOST = location.hostname;
    var isLink4m = /(^|\.)link4m\.(net|org|com)$/i.test(HOST);
    var isGoogle = /(^|\.)google\./i.test(HOST);

    var CFG = { poll: 300, maxLoops: 30000, gk: 'mp_' };

    // ============================================================
    // STORAGE — thay GM_getValue/GM_setValue bằng chrome.storage
    // ============================================================
    var memCache = {};
    var storageReady = false;
    var pendingWrites = {};

    function loadStorage(cb) {
        try {
            chrome.storage.local.get(null, function (items) {
                if (chrome.runtime.lastError) {
                    console.warn('[ToolBypass] storage error:', chrome.runtime.lastError);
                }
                memCache = items || {};
                storageReady = true;
                if (cb) cb();
            });
        } catch (e) {
            storageReady = true;
            if (cb) cb();
        }
    }

    function persist(key, value) {
        pendingWrites[key] = value;
        try {
            var obj = {};
            obj[key] = value;
            chrome.storage.local.set(obj, function () {
                delete pendingWrites[key];
            });
        } catch (e) {}
    }

    var S = {
        get: function (k, d) {
            var fullKey = CFG.gk + k;
            var v = memCache[fullKey];
            return v === undefined ? d : v;
        },
        set: function (k, v) {
            var fullKey = CFG.gk + k;
            memCache[fullKey] = v;
            persist(fullKey, v);
        },
        del: function (k) {
            var fullKey = CFG.gk + k;
            delete memCache[fullKey];
            try { chrome.storage.local.remove(fullKey); } catch (e) {}
        },
        reset: function () {
            var keys = ['state','domain','link4m','code','targetUrl','returned','lastServerSec','lastPhase','lastTotal','lastClickTime','scrollOn','serverTotalSec','serverTotalSec2','waitReloadStart'];
            for (var i = 0; i < keys.length; i++) S.del(keys[i]);
        }
    };

    var DOMAINS = {
        getList: function () {
            try {
                var raw = S.get('savedDomains', '[]');
                return typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
            } catch (e) { return []; }
        },
        save: function (domain) {
            var d = (domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            if (!d) return false;
            var list = DOMAINS.getList();
            for (var i = 0; i < list.length; i++) if (list[i].d === d) return false;
            list.unshift({ d: d, t: Date.now() });
            if (list.length > 30) list.length = 30;
            S.set('savedDomains', JSON.stringify(list));
            return true;
        },
        remove: function (d) {
            var list = DOMAINS.getList();
            var out = [];
            for (var i = 0; i < list.length; i++) if (list[i].d !== d) out.push(list[i]);
            S.set('savedDomains', JSON.stringify(out));
        }
    };

    function log() {
        var args = Array.prototype.slice.call(arguments);
        console.log.apply(console, ['%c🌸 [ToolBypass]', 'color:#ff6b9d;font-weight:700'].concat(args));
    }

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function getState() { return S.get('state', 'idle'); }
    function setState(s) { S.set('state', s); log('→ STATE:', s); refreshStatus(); }

    function isTargetPage() {
        var t = S.get('targetUrl');
        var curDomain = S.get('domain');
        var ch = HOST.replace(/^www\./, '');
        if (curDomain) {
            var cd = curDomain.toLowerCase().replace(/^www\./, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            if (ch.indexOf(cd) !== -1 || cd.indexOf(ch) !== -1) return true;
        }
        if (!t) return false;
        try {
            var th = new URL(t).hostname.replace(/^www\./, '');
            if (ch.indexOf(th) !== -1 || th.indexOf(ch) !== -1) return true;
        } catch (e) {}
        return false;
    }

    function isRealTargetPage() {
        return !isLink4m && !isGoogle && isTargetPage();
    }

    // ============================================================
    // CSS
    // ============================================================
    var C = {
        bg1: '#fff0f5', bg2: '#ffe4ec', card: '#ffffff',
        pink: '#ff6b9d', pinkDark: '#c9184a', pinkLight: '#ffb3c6',
        pinkSoft: '#ffe0eb', text: '#3d2c34', textSoft: '#8a6b77', border: '#ffd6e5'
    };

    var styleEl = document.createElement('style');
    styleEl.textContent =
        '#mp-root{position:fixed;top:10px;right:10px;z-index:2147483647;width:280px;font-family:Segoe UI,sans-serif;font-size:11px;color:' + C.text + ';border-radius:16px;overflow:hidden;background:linear-gradient(160deg,' + C.bg1 + ' 0%,' + C.card + ' 60%,' + C.bg2 + ' 100%);box-shadow:0 8px 30px rgba(255,107,157,.35),0 0 0 1px ' + C.border + ';user-select:none;max-height:92vh;display:flex;flex-direction:column}' +
        '#mp-root *{box-sizing:border-box}' +
        '#mp-root.mp-min{width:54px !important;border-radius:50% !important;max-height:none}' +
        '#mp-root.mp-min .mp-head{padding:12px 0 !important;text-align:center}' +
        '#mp-root.mp-min .mp-brand{justify-content:center;gap:0}' +
        '#mp-root.mp-min .mp-brand-txt,#mp-root.mp-min .mp-body,#mp-root.mp-min .mp-foot,#mp-root.mp-min .mp-head-actions{display:none}' +
        '#mp-root.mp-min .mp-flower{font-size:26px;margin:0}' +
        '.mp-head{position:relative;padding:12px 14px;color:#fff;cursor:move;background:linear-gradient(135deg,' + C.pink + ' 0%,' + C.pinkDark + ' 100%);overflow:hidden;touch-action:none;flex-shrink:0}' +
        '.mp-head:after{content:"";position:absolute;top:-30px;right:-30px;width:100px;height:100px;background:radial-gradient(circle,rgba(255,255,255,.35) 0%,transparent 65%);border-radius:50%;pointer-events:none}' +
        '.mp-brand{display:flex;align-items:center;gap:8px;position:relative;z-index:1}' +
        '.mp-flower{font-size:22px}' +
        '.mp-title-main{font-size:13px;font-weight:800;text-shadow:0 1px 3px rgba(0,0,0,.2)}' +
        '.mp-title-sub{font-size:8px;letter-spacing:2px;opacity:.95;font-weight:600;margin-top:1px}' +
        '.mp-head-actions{position:absolute;top:6px;right:6px;z-index:3;display:flex;gap:4px}' +
        '.mp-icon-btn{width:22px;height:22px;border-radius:50%;border:none;cursor:pointer;background:rgba(255,255,255,.28);color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1;padding:0}' +
        '.mp-body{padding:10px 12px;overflow-y:auto;flex:1}' +
        '.mp-body::-webkit-scrollbar{width:4px}' +
        '.mp-body::-webkit-scrollbar-thumb{background:' + C.pinkLight + ';border-radius:3px}' +
        '.mp-status-card{background:#fff;border-radius:10px;padding:9px 11px;margin-bottom:8px;border-left:3px solid ' + C.pink + ';box-shadow:0 2px 6px rgba(255,107,157,.1)}' +
        '.mp-status-label{font-size:8px;font-weight:800;letter-spacing:2px;color:' + C.textSoft + ';margin-bottom:3px}' +
        '.mp-status-value{font-size:11px;font-weight:700;color:' + C.pinkDark + ';line-height:1.3}' +
        '.mp-timer{display:none;text-align:center;padding:10px 0 8px;background:#fff;border-radius:10px;margin-bottom:8px}' +
        '.mp-timer.show{display:block}' +
        '.mp-timer-wrap{position:relative;width:80px;height:80px;margin:0 auto}' +
        '.mp-timer-wrap svg{width:100%;height:100%;transform:rotate(-90deg)}' +
        '.mp-timer-track{fill:none;stroke:' + C.pinkSoft + ';stroke-width:5}' +
        '.mp-timer-prog{fill:none;stroke:url(#mpGrad);stroke-width:5;stroke-linecap:round;stroke-dasharray:188.5;stroke-dashoffset:0;transition:stroke-dashoffset .3s linear}' +
        '.mp-timer-num{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:' + C.pinkDark + ';font-variant-numeric:tabular-nums}' +
        '.mp-timer-cap{margin-top:5px;font-size:9px;font-weight:800;letter-spacing:2px;color:' + C.textSoft + '}' +
        '.mp-guide{display:none;background:linear-gradient(135deg,#fffacd,#fff5b8);border:2px solid #ffd84d;border-radius:10px;padding:10px;text-align:center;margin-bottom:8px;font-size:10px;color:#8a6b77;line-height:1.5}' +
        '.mp-guide.show{display:block}' +
        '.mp-guide b{color:#c9184a;font-size:12px}' +
        '.mp-code{display:none;background:linear-gradient(135deg,#fff 0%,' + C.bg1 + ' 100%);border:2px dashed ' + C.pink + ';border-radius:10px;padding:10px;text-align:center;margin-bottom:8px}' +
        '.mp-code.show{display:block}' +
        '.mp-code-label{font-size:9px;font-weight:800;letter-spacing:2px;color:' + C.textSoft + ';margin-bottom:5px}' +
        '.mp-code-value{font-family:Courier New,monospace;font-size:18px;font-weight:900;color:' + C.pinkDark + ';letter-spacing:1.5px;padding:8px 5px;background:#fff;border-radius:8px;margin-bottom:7px;word-break:break-all;user-select:text}' +
        '.mp-btn{width:100%;padding:9px;border:none;border-radius:9px;font-weight:800;font-size:11px;cursor:pointer;color:#fff;background:linear-gradient(135deg,' + C.pink + ' 0%,' + C.pinkDark + ' 100%);box-shadow:0 3px 10px rgba(255,107,157,.4);font-family:inherit}' +
        '.mp-btn:active{transform:scale(.96)}' +
        '.mp-btn.gray{background:linear-gradient(135deg,#b8b8b8,#8a8a8a)}' +
        '.mp-btn.blue{background:linear-gradient(135deg,#5aa7e8,#2b7fc4)}' +
        '.mp-btn.green{background:linear-gradient(135deg,#52c41a,#2f9e0a)}' +
        '.mp-btn.orange{background:linear-gradient(135deg,#ffb84d,#e88b00)}' +
        '.mp-btn.red{background:linear-gradient(135deg,#ff5a5a,#c9184a)}' +
        '.mp-btn-row{display:flex;gap:6px;margin-bottom:7px}' +
        '.mp-btn-row .mp-btn{flex:1}' +
        '.mp-log{max-height:90px;overflow-y:auto;padding:7px 9px;font-size:9px;font-family:Courier New,monospace;line-height:1.5;color:' + C.textSoft + ';background:rgba(255,255,255,.55);border-radius:8px;border:1px solid ' + C.pinkSoft + '}' +
        '.mp-log::-webkit-scrollbar{width:4px}' +
        '.mp-log::-webkit-scrollbar-thumb{background:' + C.pinkLight + ';border-radius:3px}' +
        '.mp-log div{padding:1px 0;border-bottom:1px dashed rgba(255,179,198,.35)}' +
        '.mp-foot{display:flex;justify-content:center;align-items:center;gap:6px;padding:7px;color:#fff;font-size:8px;font-weight:800;letter-spacing:1.2px;background:linear-gradient(135deg,' + C.pink + ' 0%,' + C.pinkDark + ' 100%);flex-shrink:0}' +
        '.mp-note{font-size:9px;color:' + C.textSoft + ';text-align:center;padding:5px;font-style:italic;margin-bottom:6px;background:' + C.pinkSoft + ';border-radius:6px}' +
        '#mp-fab{position:fixed;bottom:20px;right:20px;z-index:2147483647;width:46px;height:46px;border-radius:50%;cursor:pointer;background:linear-gradient(135deg,#ff6b9d,#c9184a);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 5px 16px rgba(255,107,157,.55)}' +
        '.mp-section{background:#fff;border-radius:10px;padding:9px;margin-bottom:8px;box-shadow:0 2px 6px rgba(255,107,157,.1)}' +
        '.mp-section-title{font-size:9px;font-weight:800;letter-spacing:1.5px;color:' + C.pinkDark + ';margin-bottom:6px}' +
        '.mp-input{width:100%;padding:7px 9px;border:1.5px solid ' + C.pinkLight + ';border-radius:8px;font-family:inherit;font-size:11px;color:' + C.text + ';background:#fff;outline:none}' +
        '.mp-input:focus{border-color:' + C.pink + ';box-shadow:0 0 0 2px rgba(255,107,157,.15)}' +
        '.mp-input::placeholder{color:#c9a4b3}' +
        '.mp-domain-list{max-height:100px;overflow-y:auto;margin-top:6px;border-radius:6px;background:' + C.bg1 + ';padding:3px}' +
        '.mp-domain-item{display:flex;align-items:center;justify-content:space-between;padding:5px 7px;border-radius:5px;font-size:10px;cursor:pointer}' +
        '.mp-domain-item:hover{background:#fff}' +
        '.mp-domain-item .d-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}' +
        '.mp-domain-item .d-use{padding:2px 6px;border-radius:5px;background:' + C.pink + ';color:#fff;font-size:8px;font-weight:800;border:none;cursor:pointer;margin-left:4px}' +
        '.mp-domain-item .d-del{padding:2px 5px;border-radius:5px;background:#ff5a5a;color:#fff;font-size:9px;font-weight:900;border:none;cursor:pointer;margin-left:3px}' +
        '.mp-empty{text-align:center;color:' + C.textSoft + ';font-size:9px;padding:10px;font-style:italic}';
    document.head.appendChild(styleEl);

    var UI = {};
    var loopRunning = false;
    var cachedBtn = null;
    var cachedBtnTime = 0;

    // ============================================================
    // LƯỚT MƯỢT — SIN WAVE + RAF
    // ============================================================
    var scrollAnim = {
        active: false,
        rafId: null,
        originY: 0,
        amplitude: 45,
        period: 6000,
        startTime: 0
    };

    function buildPanel() {
        var old = document.getElementById('mp-root');
        if (old) old.remove();
        var root = document.createElement('div');
        root.id = 'mp-root';
        root.innerHTML =
            '<div class="mp-head" id="mp-head">' +
                '<div class="mp-head-actions">' +
                    '<button class="mp-icon-btn" id="mp-min">−</button>' +
                    '<button class="mp-icon-btn" id="mp-close">×</button>' +
                '</div>' +
                '<div class="mp-brand">' +
                    '<div class="mp-flower">🌸</div>' +
                    '<div class="mp-brand-txt">' +
                        '<div class="mp-title-main">t.me/toolbypass</div>' +
                        '<div class="mp-title-sub">AUTO LINK4M v28</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="mp-body">' +
                '<div class="mp-note" id="mp-note">💡 Sẵn sàng</div>' +
                '<div class="mp-status-card">' +
                    '<div class="mp-status-label">TRẠNG THÁI</div>' +
                    '<div class="mp-status-value" id="mp-status">Sẵn sàng</div>' +
                '</div>' +
                '<div class="mp-section">' +
                    '<div class="mp-section-title">🌸 DOMAIN ĐÍCH</div>' +
                    '<input class="mp-input" id="mp-domain-input" type="text" placeholder="vd: anoor.co" />' +
                    '<div class="mp-btn-row" style="margin-top:6px;margin-bottom:0">' +
                        '<button class="mp-btn blue" id="mp-save-domain">💾 LƯU</button>' +
                        '<button class="mp-btn green" id="mp-start">🌸 BẮT ĐẦU</button>' +
                    '</div>' +
                    '<div class="mp-domain-list" id="mp-domain-list"></div>' +
                '</div>' +
                '<div class="mp-btn-row">' +
                    '<button class="mp-btn orange" id="mp-scroll-toggle" style="font-size:10px">🔄 BẬT LƯỚT NHẸ</button>' +
                '</div>' +
                '<div class="mp-timer" id="mp-timer">' +
                    '<div class="mp-timer-wrap">' +
                        '<svg viewBox="0 0 60 60"><defs><linearGradient id="mpGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff6b9d"/><stop offset="100%" stop-color="#c9184a"/></linearGradient></defs><circle class="mp-timer-track" cx="30" cy="30" r="26"/><circle class="mp-timer-prog" id="mp-timer-prog" cx="30" cy="30" r="26"/></svg>' +
                        '<div class="mp-timer-num" id="mp-timer-num">0</div>' +
                    '</div>' +
                    '<div class="mp-timer-cap" id="mp-timer-cap">ĐANG CHỜ MÃ</div>' +
                '</div>' +
                '<div class="mp-guide" id="mp-guide"></div>' +
                '<div class="mp-code" id="mp-code">' +
                    '<div class="mp-code-label">🌸 MÃ XÁC NHẬN 🌸</div>' +
                    '<div class="mp-code-value" id="mp-code-value">----</div>' +
                    '<button class="mp-btn" id="mp-copy">📋 SAO CHÉP MÃ</button>' +
                '</div>' +
                '<div id="mp-actions"></div>' +
                '<div class="mp-log" id="mp-log"></div>' +
            '</div>' +
            '<div class="mp-foot"><span>🌸</span><span>© t.me/toolbypass</span><span>🌸</span></div>';
        document.body.appendChild(root);

        UI = {
            root: root, head: root.querySelector('#mp-head'),
            note: root.querySelector('#mp-note'), status: root.querySelector('#mp-status'),
            timer: root.querySelector('#mp-timer'), timerNum: root.querySelector('#mp-timer-num'),
            timerProg: root.querySelector('#mp-timer-prog'), timerCap: root.querySelector('#mp-timer-cap'),
            guide: root.querySelector('#mp-guide'), code: root.querySelector('#mp-code'),
            codeVal: root.querySelector('#mp-code-value'), copy: root.querySelector('#mp-copy'),
            actions: root.querySelector('#mp-actions'), log: root.querySelector('#mp-log'),
            minBtn: root.querySelector('#mp-min'), closeBtn: root.querySelector('#mp-close'),
            domainInput: root.querySelector('#mp-domain-input'),
            saveBtn: root.querySelector('#mp-save-domain'),
            startBtn: root.querySelector('#mp-start'), domainList: root.querySelector('#mp-domain-list'),
            scrollToggleBtn: root.querySelector('#mp-scroll-toggle')
        };

        UI.scrollToggleBtn.onclick = function () {
            if (S.get('scrollOn', '0') === '1') stopAutoScroll(); else startAutoScroll();
        };

        UI.copy.onclick = function () {
            var c = UI.codeVal.textContent;
            if (!c || c === '----') return;
            navigator.clipboard.writeText(c).then(function () {
                UI.copy.textContent = '✅ ĐÃ SAO CHÉP!';
                setTimeout(function () { UI.copy.textContent = '📋 SAO CHÉP MÃ'; }, 1500);
            });
        };

        UI.saveBtn.onclick = function () {
            var v = UI.domainInput.value.trim();
            if (!v) { UI.domainInput.focus(); return; }
            var ok = DOMAINS.save(v);
            UI.saveBtn.textContent = ok ? '✅ ĐÃ LƯU' : '⚠️ ĐÃ CÓ';
            setTimeout(function () { UI.saveBtn.textContent = '💾 LƯU'; }, 1200);
            renderDomainList();
        };

        UI.startBtn.onclick = function () {
            var v = UI.domainInput.value.trim();
            if (!v) { UI.status.textContent = '⚠️ Nhập domain đích trước!'; UI.domainInput.focus(); return; }
            var domain = v.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
            var googleUrl = 'https://www.google.com/search?q=' + encodeURIComponent(domain);
            log('🌐 Mở Google:', googleUrl);
            var newTab = window.open(googleUrl, '_blank');

            S.set('domain', domain);
            S.set('link4m', location.href);
            S.del('returned'); S.del('code'); S.del('targetUrl');
            S.del('lastServerSec'); S.del('lastPhase'); S.del('lastTotal'); S.del('lastClickTime');
            S.del('serverTotalSec'); S.del('serverTotalSec2'); S.del('waitReloadStart');
            S.set('state', 'click-google');
            refreshStatus();

            var cont = findContinueBtn();
            if (cont) cont.click();

            DOMAINS.save(domain);
            renderDomainList();

            UI.status.textContent = newTab ? '🔍 Đã mở tab Google' : '⚠️ Cho phép popup!';
        };

        UI.domainInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') UI.startBtn.click();
        });

        var orig = console.log;
        console.log = function () {
            orig.apply(console, arguments);
            if (!UI.log) return;
            var a = Array.prototype.slice.call(arguments);
            var line = a.map(function (x) { return typeof x === 'object' ? JSON.stringify(x) : String(x); }).join(' ');
            var d = document.createElement('div');
            d.textContent = '› ' + line;
            UI.log.appendChild(d);
            UI.log.scrollTop = UI.log.scrollHeight;
            while (UI.log.children.length > 60) UI.log.removeChild(UI.log.firstChild);
        };

        UI.minBtn.onclick = function (e) { e.stopPropagation(); toggleMin(); };
        UI.closeBtn.onclick = function (e) {
            e.stopPropagation();
            UI.root.style.display = 'none';
            var fab = document.getElementById('mp-fab');
            if (!fab) {
                fab = document.createElement('div');
                fab.id = 'mp-fab'; fab.innerHTML = '🌸';
                fab.onclick = function () { UI.root.style.display = ''; fab.remove(); };
                document.body.appendChild(fab);
            }
        };

        if (S.get('min') === '1') { UI.root.classList.add('mp-min'); UI.minBtn.textContent = '+'; }
        var pos = S.get('pos');
        if (pos && typeof pos === 'object') {
            UI.root.style.left = pos.x + 'px'; UI.root.style.top = pos.y + 'px'; UI.root.style.right = 'auto';
        }
        enableDrag();

        var cur = S.get('domain');
        if (cur) UI.domainInput.value = cur;

        if (S.get('scrollOn', '0') === '1') setTimeout(function () { startAutoScroll(); }, 500);
        renderDomainList();
    }

    function findL4MFast() {
        if (cachedBtn && Date.now() - cachedBtnTime < 1500) {
            if (document.contains(cachedBtn) && cachedBtn.offsetParent !== null) return cachedBtn;
        }
        var imgs = document.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            if (img.closest('#mp-root') || img.closest('#mp-fab')) continue;
            var src = (img.src || '').toLowerCase();
            var alt = (img.alt || '').toLowerCase();
            if (src.indexOf('l4m') === -1 && src.indexOf('layma') === -1 && src.indexOf('lay-ma') === -1 &&
                alt.indexOf('l4m') === -1 && alt.indexOf('lấy') === -1) continue;
            var p = img.parentElement; var depth = 0; var best = null;
            while (p && depth < 6) {
                if (p.closest('#mp-root') || p.closest('#mp-fab')) { p = null; break; }
                if (p.offsetParent !== null) {
                    var pt = (p.textContent || '').replace(/\s+/g, ' ').trim();
                    if (pt.length >= 3 && pt.length <= 100 && /lấy\s*mã|lay\s*ma/i.test(pt)) best = p;
                }
                p = p.parentElement; depth++;
            }
            if (best) { cachedBtn = best; cachedBtnTime = Date.now(); return best; }
            if (img.parentElement && img.parentElement.offsetParent !== null) {
                cachedBtn = img.parentElement; cachedBtnTime = Date.now(); return img.parentElement;
            }
        }
        var q = document.querySelectorAll('a, button, [role="button"], [onclick], [onmousedown], [onmouseup], [ontouchstart]');
        for (var j = 0; j < q.length; j++) {
            var el = q[j];
            if (el.closest('#mp-root') || el.closest('#mp-fab')) continue;
            if (el.offsetParent === null) continue;
            var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (t.length < 3 || t.length > 100) continue;
            if (/test|debug|kiểm tra|reset|sao chép|bật lướt|tắt lướt|quét/i.test(t)) continue;
            if (!/lấy\s*mã|lay\s*ma|get\s*code/i.test(t)) continue;
            var inner = (el.innerHTML || '').toLowerCase();
            if (/l4m|lay-?ma/i.test(inner) || el.querySelector('img')) {
                cachedBtn = el; cachedBtnTime = Date.now(); return el;
            }
        }
        var all = document.querySelectorAll('div, span');
        for (var k = 0; k < all.length; k++) {
            var e2 = all[k];
            if (e2.closest('#mp-root') || e2.closest('#mp-fab')) continue;
            if (e2.offsetParent === null) continue;
            var t2 = (e2.textContent || '').replace(/\s+/g, ' ').trim();
            if (t2.length > 100 || t2.length < 3) continue;
            if (/test|debug|kiểm tra|reset|sao chép|bật lướt|tắt lướt|quét/i.test(t2)) continue;
            if (!/lấy\s*mã|lay\s*ma/i.test(t2)) continue;
            var inner2 = (e2.innerHTML || '').toLowerCase();
            var hasL4M = /l4m|lay-?ma/i.test(inner2);
            var hasImg = e2.querySelector('img') !== null;
            try {
                var st = window.getComputedStyle(e2);
                var bg = st.backgroundColor || '';
                var bgImg = st.backgroundImage || '';
                var m = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                var isRed = false;
                if (m) {
                    var R = parseInt(m[1], 10), G = parseInt(m[2], 10), B = parseInt(m[3], 10);
                    if (R > 180 && G < 100 && B < 100) isRed = true;
                }
                if (/gradient/i.test(bgImg) && /rgb\((2[0-5]\d|1[89]\d)/i.test(bgImg)) isRed = true;
                if (isRed && (hasL4M || hasImg)) { cachedBtn = e2; cachedBtnTime = Date.now(); return e2; }
                if (hasL4M && hasImg) { cachedBtn = e2; cachedBtnTime = Date.now(); return e2; }
            } catch (e) {}
        }
        cachedBtn = null;
        return null;
    }

    function findL4MInIframe() {
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
            var ifr = iframes[i];
            var src = (ifr.src || '').toLowerCase();
            if (src.indexOf('website-analytics') === -1 && src.indexOf('get_quest') === -1 && src.indexOf('l4m') === -1 && src.indexOf('link4m') === -1) continue;
            try {
                var cdoc = ifr.contentDocument || ifr.contentWindow.document;
                if (cdoc) {
                    var inner = cdoc.querySelectorAll('a, button, div, span');
                    for (var j = 0; j < inner.length; j++) {
                        var el = inner[j];
                        var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
                        if (/lấy\s*mã/i.test(t) && t.length < 80) return { el: el, type: 'iframe-inner' };
                    }
                }
            } catch (e) { return { el: ifr, type: 'iframe-outer' }; }
        }
        return null;
    }

    function findL4MByPoint() {
        var w = window.innerWidth, h = window.innerHeight;
        var step = 60;
        for (var y = 40; y < h - 40; y += step) {
            for (var x = 20; x < w - 20; x += step) {
                try {
                    var els = document.elementsFromPoint(x, y);
                    for (var i = 0; i < els.length; i++) {
                        var el = els[i];
                        if (el.closest('#mp-root') || el.closest('#mp-fab')) continue;
                        var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
                        if (t.length < 3 || t.length > 100) continue;
                        if (!/lấy\s*mã|lay\s*ma/i.test(t)) continue;
                        if (/test|debug|kiểm tra|reset|sao chép|bật lướt|tắt lướt|quét/i.test(t)) continue;
                        return el;
                    }
                } catch (e) {}
            }
        }
        return null;
    }

    function clickL4M(el, type) {
        try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch (e) {}
        setTimeout(function () {
            var r;
            try { r = el.getBoundingClientRect(); } catch (e) { r = null; }
            var cx = r ? r.left + r.width / 2 : 0;
            var cy = r ? r.top + r.height / 2 : 0;
            try { el.click(); } catch (e) {}
            try { el.dispatchEvent(new Event('click', { bubbles: true, cancelable: true })); } catch (e) {}
            try { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy })); } catch (e) {}
            try {
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
            } catch (e) {}
            try {
                el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
                el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
            } catch (e) {}
            try {
                el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true }));
                el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }));
            } catch (e) {}
            try {
                var child = el.querySelector('span, img, a, button, b, strong, i, em, div');
                if (child && child !== el) { child.click(); child.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
            } catch (e) {}
            try { if (el.parentElement && el.parentElement !== document.body) el.parentElement.click(); } catch (e) {}
            try {
                if (cx > 0 && cy > 0) {
                    var topEl = document.elementFromPoint(cx, cy);
                    if (topEl && !topEl.closest('#mp-root')) {
                        topEl.click();
                        topEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
                    }
                    var stack = document.elementsFromPoint(cx, cy);
                    for (var s = 0; s < stack.length && s < 5; s++) {
                        var se = stack[s];
                        if (se.closest('#mp-root') || se.closest('#mp-fab')) continue;
                        try { se.click(); } catch (e) {}
                    }
                }
            } catch (e) {}
            try { el.focus(); el.click(); } catch (e) {}
            if (type === 'iframe-outer') {
                try { el.click(); el.focus(); } catch (e) {}
                if (cx > 0 && cy > 0) {
                    try {
                        var topEl2 = document.elementFromPoint(cx, cy);
                        if (topEl2) {
                            topEl2.click();
                            topEl2.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
                        }
                    } catch (e) {}
                }
            }
            log('✓ Đã click nút L4M (' + (type || 'normal') + ')');
        }, 250);
    }

    // ============================================================
    // LƯỚT MƯỢT NHƯ NGƯỜI THẬT
    // ============================================================
    function startAutoScroll() {
        if (scrollAnim.active) return;
        S.set('scrollOn', '1');
        if (UI.scrollToggleBtn) { UI.scrollToggleBtn.textContent = '🛑 TẮT LƯỚT'; UI.scrollToggleBtn.className = 'mp-btn red'; }

        scrollAnim.active = true;
        scrollAnim.originY = window.pageYOffset || document.documentElement.scrollTop || 0;
        scrollAnim.startTime = performance.now();

        log('🔄 BẬT LƯỚT MƯỢT (sin wave, chu kỳ 6s) TẠI Y=' + Math.round(scrollAnim.originY));

        var animate = function (now) {
            if (!scrollAnim.active) return;
            try {
                var elapsed = now - scrollAnim.startTime;
                var phase = (elapsed / scrollAnim.period) * 2 * Math.PI;
                var offset = Math.sin(phase) * scrollAnim.amplitude;
                var targetY = scrollAnim.originY + offset;
                window.scrollTo(0, targetY);
            } catch (e) {}
            scrollAnim.rafId = requestAnimationFrame(animate);
        };
        scrollAnim.rafId = requestAnimationFrame(animate);
    }

    function stopAutoScroll() {
        scrollAnim.active = false;
        if (scrollAnim.rafId) {
            cancelAnimationFrame(scrollAnim.rafId);
            scrollAnim.rafId = null;
        }
        S.set('scrollOn', '0');
        if (UI.scrollToggleBtn) { UI.scrollToggleBtn.textContent = '🔄 BẬT LƯỚT NHẸ'; UI.scrollToggleBtn.className = 'mp-btn orange'; }
        log('🛑 TẮT LƯỚT');
    }

    function renderDomainList() {
        if (!UI.domainList) return;
        var list = DOMAINS.getList();
        UI.domainList.innerHTML = '';
        if (!list.length) { UI.domainList.innerHTML = '<div class="mp-empty">Chưa có domain nào</div>'; return; }
        for (var i = 0; i < list.length; i++) {
            (function (item) {
                var row = document.createElement('div');
                row.className = 'mp-domain-item';
                var name = document.createElement('div');
                name.className = 'd-name'; name.textContent = item.d;
                var useBtn = document.createElement('button');
                useBtn.className = 'd-use'; useBtn.textContent = 'DÙNG';
                useBtn.onclick = function (e) { e.stopPropagation(); UI.domainInput.value = item.d; };
                var delBtn = document.createElement('button');
                delBtn.className = 'd-del'; delBtn.textContent = '×';
                delBtn.onclick = function (e) { e.stopPropagation(); DOMAINS.remove(item.d); renderDomainList(); };
                row.appendChild(name); row.appendChild(useBtn); row.appendChild(delBtn);
                row.onclick = function () { UI.domainInput.value = item.d; };
                UI.domainList.appendChild(row);
            })(list[i]);
        }
    }

    function toggleMin() {
        if (!UI.root) return;
        var m = UI.root.classList.toggle('mp-min');
        UI.minBtn.textContent = m ? '+' : '−';
        S.set('min', m ? '1' : '0');
    }

    function enableDrag() {
        var h = UI.head; if (!h) return;
        var dg = false, sx = 0, sy = 0, ox = 0, oy = 0;
        var dn = function (e) {
            if (e.target.closest('.mp-icon-btn')) return;
            if (UI.root.classList.contains('mp-min')) { toggleMin(); return; }
            dg = true;
            var p = e.touches ? e.touches[0] : e;
            sx = p.clientX; sy = p.clientY;
            var r = UI.root.getBoundingClientRect();
            ox = r.left; oy = r.top;
            UI.root.style.left = ox + 'px'; UI.root.style.top = oy + 'px'; UI.root.style.right = 'auto';
            document.addEventListener('mousemove', mv, { passive: false });
            document.addEventListener('mouseup', up);
            document.addEventListener('touchmove', mv, { passive: false });
            document.addEventListener('touchend', up);
            e.preventDefault();
        };
        var mv = function (e) {
            if (!dg) return;
            var p = e.touches ? e.touches[0] : e;
            var nx = ox + (p.clientX - sx), ny = oy + (p.clientY - sy);
            nx = Math.max(0, Math.min(nx, window.innerWidth - UI.root.offsetWidth));
            ny = Math.max(0, Math.min(ny, window.innerHeight - UI.root.offsetHeight));
            UI.root.style.left = nx + 'px'; UI.root.style.top = ny + 'px';
            if (e.cancelable) e.preventDefault();
        };
        var up = function () {
            if (!dg) return;
            dg = false;
            var r = UI.root.getBoundingClientRect();
            S.set('pos', { x: r.left, y: r.top });
            document.removeEventListener('mousemove', mv);
            document.removeEventListener('mouseup', up);
            document.removeEventListener('touchmove', mv);
            document.removeEventListener('touchend', up);
        };
        h.addEventListener('mousedown', dn);
        h.addEventListener('touchstart', dn, { passive: false });
    }

    function refreshStatus() {
        if (!UI.status) return;
        var map = {
            'idle': 'Sẵn sàng — nhập domain + BẮT ĐẦU',
            'click-google': '🖱️ Đang tìm + click kết quả Google...',
            'scan-click1': '🔎 Đang săn + click nút L4M...',
            'counting1': '⏳ Đang đếm phase 1...',
            'wait-reload-text': '👀 Chờ text reload...',
            'reloading': '🔄 Đang reload...',
            'scan-click2': '🎯 Đang săn + click nút L4M lần 2...',
            'counting2': '⏳ Đang đếm phase 2...',
            'got-code': '✅ Đã có mã',
            'back-link4m': '🏠 Đang về link4m...',
            'done': '🎉 HOÀN TẤT!'
        };
        UI.status.textContent = map[getState()] || getState();
    }

    function showTimer(sec, max, label) {
        if (!UI.timer) return;
        UI.timer.classList.add('show');
        UI.timerNum.textContent = sec;
        UI.timerCap.textContent = label || 'ĐANG CHỜ MÃ';
        if (max > 0) {
            var C_ = 2 * Math.PI * 26;
            UI.timerProg.style.strokeDashoffset = C_ * (1 - (sec / max));
        }
    }
    function hideTimer() { if (UI.timer) UI.timer.classList.remove('show'); }
    function showGuide(html) { if (UI.guide) { UI.guide.innerHTML = html; UI.guide.classList.add('show'); } }
    function showCode(code) {
        if (!UI.code) return;
        UI.code.classList.add('show');
        UI.codeVal.textContent = code;
        try { navigator.clipboard.writeText(code); log('📋 Đã copy code:', code); } catch (e) {}
    }

    var CD_PATTERNS = [
        /vui lòng chờ\s*(\d+)\s*s?\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/i,
        /vui lòng chờ\s*(\d+)\s*giây\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/i,
        /chờ\s*(\d+)\s*s\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/i,
        /chờ\s*(\d+)\s*giây\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/i,
        /(\d+)\s*s\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/i,
        /vui lòng chờ\s*(\d+)\s*s\b/i,
        /vui lòng chờ\s*(\d+)\s*giây/i,
        /chờ\s*(\d+)\s*s\b/i,
        /chờ\s*(\d+)\s*giây/i,
        /còn[:\s]*(\d+)\s*giây/i,
        /còn[:\s]*(\d+)\s*s\b/i,
        /còn[:\s]*(\d+)/i
    ];

    function parseCountdownText(text) {
        if (!text) return null;
        for (var p = 0; p < CD_PATTERNS.length; p++) {
            var m = text.match(CD_PATTERNS[p]);
            if (m) {
                var sec = parseInt(m[1], 10);
                var phase = m[2] ? parseInt(m[2], 10) : 1;
                var total = m[3] ? parseInt(m[3], 10) : 2;
                if (!isNaN(sec) && sec >= 0 && sec <= 999) return { sec: sec, phase: phase, total: total, raw: m[0] };
            }
        }
        return null;
    }

    function readCountdownInDoc(doc) {
        if (!doc) return null;
        try { var bt = (doc.body && doc.body.innerText) || ''; var r1 = parseCountdownText(bt); if (r1) return r1; } catch (e) {}
        try { var bc = (doc.body && doc.body.textContent) || ''; var r2 = parseCountdownText(bc); if (r2) return r2; } catch (e) {}
        try {
            var sels = ['#timer','#countdown','#clock','.timer','.countdown','.clock','[id*="timer" i]','[id*="count" i]','[id*="clock" i]','[id*="wait" i]','[class*="timer" i]','[class*="count" i]','[class*="clock" i]','[class*="wait" i]'];
            for (var s = 0; s < sels.length; s++) {
                var els = doc.querySelectorAll(sels[s]);
                for (var e = 0; e < els.length; e++) {
                    var el = els[e];
                    if (el.closest && el.closest('#mp-root')) continue;
                    var t = (el.textContent || '').trim();
                    var r3 = parseCountdownText(t);
                    if (r3) return r3;
                    var num = t.match(/^(\d+)$/);
                    if (num) { var n = parseInt(num[1], 10); if (n >= 0 && n <= 999) return { sec: n, phase: 1, total: 2, raw: t }; }
                }
            }
        } catch (e) {}
        try {
            var walker = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_TEXT, null, false);
            var node; var count = 0;
            while ((node = walker.nextNode()) && count < 5000) {
                count++;
                var text = (node.textContent || '').trim();
                if (!text || text.length < 3) continue;
                if (text.indexOf('chờ') === -1 && text.indexOf('còn') === -1 && text.indexOf('giây') === -1 && text.indexOf('s (') === -1 && text.indexOf('/') === -1) continue;
                var r4 = parseCountdownText(text);
                if (r4) return r4;
            }
        } catch (e) {}
        try {
            var iframes = doc.querySelectorAll('iframe');
            for (var f = 0; f < iframes.length; f++) {
                try { var cdoc = iframes[f].contentDocument || iframes[f].contentWindow.document; if (cdoc) { var r5 = readCountdownInDoc(cdoc); if (r5) return r5; } } catch (e) {}
            }
        } catch (e) {}
        try {
            var allEls = doc.querySelectorAll('*');
            for (var k = 0; k < allEls.length && k < 2000; k++) {
                var sr = allEls[k].shadowRoot;
                if (sr) { try { var r6 = readCountdownInDoc(sr); if (r6) return r6; } catch (e) {} }
            }
        } catch (e) {}
        return null;
    }

    function readServerCountdown() { return readCountdownInDoc(document); }

    function getFullTextAllDocs() {
        var all = '';
        try { all += (document.body.innerText || '') + ' '; } catch (e) {}
        try { all += (document.body.textContent || '') + ' '; } catch (e) {}
        try {
            var iframes = document.querySelectorAll('iframe');
            for (var i = 0; i < iframes.length; i++) {
                try {
                    var cdoc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                    if (cdoc) {
                        all += (cdoc.body ? cdoc.body.innerText : '') + ' ';
                        all += (cdoc.body ? cdoc.body.textContent : '') + ' ';
                    }
                } catch (e) {}
            }
        } catch (e) {}
        return all;
    }

    function isAskClickLink() {
        var all = getFullTextAllDocs();
        var n = all.toLowerCase()
            .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
            .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
            .replace(/[ìíịỉĩ]/g, 'i')
            .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
            .replace(/[ùúụủũưừứựửữ]/g, 'u')
            .replace(/[ỳýỵỷỹ]/g, 'y')
            .replace(/[đ]/g, 'd')
            .replace(/\s+/g, ' ');

        if (/(nhan|click|bam).{0,30}(link|duong dan).{0,30}(bat ki|bat ky|bat cu)/i.test(n)) return true;
        if (/(vui long|hay).{0,30}(nhan|click|bam).{0,30}(link|duong dan)/i.test(n)) return true;
        if (/nhan vao link bat ki/i.test(n)) return true;
        if (/click vao link bat ki/i.test(n)) return true;
        if (/vui long nhan vao link/i.test(n)) return true;
        if (/vui long click vao link/i.test(n)) return true;
        if (/luot xuong vi tri nay/i.test(n)) return true;
        if (/vi tri nay de lay ma/i.test(n)) return true;
        if (/de lay ma/i.test(n) && /(nhan|click|luot)/i.test(n)) return true;
        return false;
    }

    function extractCode() {
        var all = getFullTextAllDocs();
        var patterns = [
            /mã\s*km[:\s]+([A-Za-z0-9_\-]{4,32})/i,
            /mã\s*code[:\s]+([A-Za-z0-9_\-]{4,32})/i,
            /mã\s*xác\s*nhận[:\s]+([A-Za-z0-9_\-]{4,32})/i,
            /mã\s*thưởng[:\s]+([A-Za-z0-9_\-]{4,32})/i
        ];
        for (var p = 0; p < patterns.length; p++) {
            var m = all.match(patterns[p]);
            if (m) {
                var c = m[1].trim();
                if (/^https?:\/\//i.test(c)) continue;
                if (/\.(com|net|org|me|vn|io|info)/i.test(c)) continue;
                if (c.length < 4 || c.length > 32) continue;
                return c;
            }
        }
        return null;
    }

    function findGoogleResult(domain) {
        var kw = domain.toLowerCase().replace(/^www\./, '');
        var links = Array.prototype.slice.call(document.querySelectorAll('a[href^="http"]'));
        for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var h = a.href.toLowerCase();
            if (/google\.|gstatic\.|googleusercontent\.|youtube\.|wikipedia\.|facebook\.|accounts\./i.test(h)) continue;
            if (h.indexOf(kw) !== -1) return a;
        }
        var s = document.querySelector('#search a[href^="http"]');
        if (s) { var hs = s.href.toLowerCase(); if (!/google\.|gstatic\./i.test(hs)) return s; }
        var r = document.querySelector('#rso a[href^="http"]');
        if (r) { var hr = r.href.toLowerCase(); if (!/google\.|gstatic\./i.test(hr)) return r; }
        var g = document.querySelector('.g a[href^="http"]');
        if (g) { var hg = g.href.toLowerCase(); if (!/google\.|gstatic\./i.test(hg)) return g; }
        return null;
    }

    function findContinueBtn() {
        var els = Array.prototype.slice.call(document.querySelectorAll('a, button'));
        for (var i = 0; i < els.length; i++) {
            var e = els[i];
            if (e.offsetParent === null || e.closest('#mp-root')) continue;
            if (/click vào đây|tiếp tục|continue/i.test((e.textContent || '').trim())) return e;
        }
        return null;
    }

    function handleGoogle() {
        var st = getState();
        if (st !== 'click-google') return Promise.resolve();
        var domain = S.get('domain');
        if (!domain) return Promise.resolve();
        log('🖱️ Tìm + click kết quả Google cho:', domain);
        return sleep(1500).then(function () {
            var i = 0;
            var check = function () {
                if (i >= 40) {
                    log('⚠️ Không tìm thấy link Google → mở trực tiếp domain');
                    S.set('targetUrl', 'https://' + domain);
                    setState('scan-click1');
                    window.open('https://' + domain, '_blank');
                    return Promise.resolve();
                }
                var link = findGoogleResult(domain);
                if (link) {
                    log('✓ ĐÃ TÌM THẤY KẾT QUẢ! Tự click:', link.href);
                    S.set('targetUrl', link.href);
                    try { link.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch (e) {}
                    setTimeout(function () {
                        try { link.click(); } catch (e) {}
                        try { link.dispatchEvent(new Event('click', { bubbles: true, cancelable: true })); } catch (e) {}
                        try { link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch (e) {}
                        try { var child = link.querySelector('*'); if (child) child.click(); } catch (e) {}
                        setTimeout(function () {
                            log('→ Chuyển state sang scan-click1');
                            setState('scan-click1');
                        }, 1500);
                    }, 300);
                    return Promise.resolve();
                }
                i++;
                return sleep(300).then(check);
            };
            return check();
        });
    }

    function handleLink4m() {
        var st = getState();
        var code = S.get('code');
        if (code && (st === 'back-link4m' || st === 'filling')) {
            setState('done');
            showCode(code);
            showGuide('<b>🌸 ĐÃ CÓ MÃ — TỰ DÁN VÀO Ô 🌸</b><br>Mã: <b>' + code + '</b><br>1. Dán mã vào ô nhập mã<br>2. Giải captcha<br>3. Nhấn xác nhận để tới link đích');
            return Promise.resolve();
        }
        if (st === 'idle') {
            UI.status.textContent = 'Sẵn sàng — nhập domain + BẮT ĐẦU';
            return Promise.resolve();
        }
        return Promise.resolve();
    }

    function handleTarget() {
        var st = getState();

        if (isRealTargetPage() && st === 'click-google') {
            log('→ Đang ở trang đích, state click-google → chuyển scan-click1');
            setState('scan-click1');
            return Promise.resolve();
        }

        if (st === 'scan-click1' || st === 'scan-click2') {
            var btnEl = findL4MFast();
            var btnType = 'normal';
            if (!btnEl) {
                var iframeResult = findL4MInIframe();
                if (iframeResult) { btnEl = iframeResult.el; btnType = iframeResult.type; }
            }
            if (!btnEl) {
                btnEl = findL4MByPoint();
                if (btnEl) btnType = 'point';
            }
            if (btnEl) {
                var lastClick = parseInt(S.get('lastClickTime', '0'), 10);
                if (Date.now() - lastClick < 2500) return Promise.resolve();
                log('✓✓✓ TÌM THẤY NÚT L4M (' + btnType + ')! TỰ CLICK.');
                UI.status.textContent = '✓ Đã thấy nút — đang click...';
                S.set('lastClickTime', Date.now().toString());
                clickL4M(btnEl, btnType);
                return sleep(2500).then(function () {
                    var sc = readServerCountdown();
                    if (sc) { S.set('lastServerSec', sc.sec.toString()); setState(st === 'scan-click1' ? 'counting1' : 'counting2'); }
                    else setState(st === 'scan-click1' ? 'counting1' : 'counting2');
                });
            }
            var sc0 = readServerCountdown();
            if (sc0) setState(st === 'scan-click1' ? 'counting1' : 'counting2');
            return Promise.resolve();
        }

        if (st === 'counting1') {
            var liveCode = extractCode();
            if (liveCode) { S.set('code', liveCode); showCode(liveCode); setState('got-code'); return Promise.resolve(); }
            var sc = readServerCountdown();
            if (!sc) {
                if (isAskClickLink()) {
                    log('✓ Thấy text yêu cầu click → chuyển sang chờ reload');
                    hideTimer();
                    S.set('waitReloadStart', Date.now().toString());
                    setState('wait-reload-text');
                    return Promise.resolve();
                }
                var btn2 = findL4MFast() || (findL4MInIframe() ? findL4MInIframe().el : null) || findL4MByPoint();
                if (btn2) {
                    var lc = parseInt(S.get('lastClickTime', '0'), 10);
                    if (Date.now() - lc > 2500) {
                        S.set('lastClickTime', Date.now().toString());
                        clickL4M(btn2, 'normal');
                    }
                }
                return Promise.resolve();
            }

            var totalSec = parseInt(S.get('serverTotalSec', '0'), 10);
            if (sc.sec > totalSec) {
                totalSec = sc.sec;
                S.set('serverTotalSec', totalSec.toString());
                log('📊 Mốc gốc phase 1 = ' + totalSec + 's');
            }
            if (totalSec === 0) {
                totalSec = sc.sec;
                S.set('serverTotalSec', totalSec.toString());
                log('📊 Mốc gốc phase 1 = ' + totalSec + 's');
            }

            var phaseLabel = sc.phase + '/' + sc.total;
            showTimer(sc.sec, totalSec, 'CHỜ ' + sc.sec + ' GIÂY (' + phaseLabel + ')');
            S.set('lastServerSec', sc.sec.toString());
            S.set('lastPhase', sc.phase.toString());
            S.set('lastTotal', sc.total.toString());

            if (sc.sec === 0) {
                log('→ Server về 0. Chuyển sang wait-reload-text');
                S.del('serverTotalSec');
                S.set('waitReloadStart', Date.now().toString());
                setState('wait-reload-text');
            }
            return Promise.resolve();
        }

        if (st === 'wait-reload-text') {
            var liveCode2 = extractCode();
            if (liveCode2) { S.set('code', liveCode2); showCode(liveCode2); setState('got-code'); return Promise.resolve(); }

            var waitStart = parseInt(S.get('waitReloadStart', '0'), 10);
            var elapsed = waitStart > 0 ? Date.now() - waitStart : 0;

            var askClick = isAskClickLink();
            var timeout = elapsed > 3000;

            var sc2 = readServerCountdown();
            if (sc2 && sc2.sec > 0 && !askClick && !timeout) {
                log('→ Server đếm lại → quay về counting1');
                S.del('waitReloadStart');
                setState('counting1');
                return Promise.resolve();
            }

            if (askClick || timeout) {
                if (askClick) log('✓ THẤY TEXT "nhấn vào link bất kì" → RELOAD');
                if (timeout) log('⏰ Đã đợi 3s → RELOAD BẤT CHẤP');
                showGuide('<b>🔄 ĐANG RELOAD...</b>');
                S.del('waitReloadStart');
                return sleep(1000).then(function () { hideTimer(); setState('reloading'); location.reload(); });
            }
            return Promise.resolve();
        }

        if (st === 'reloading') { setState('scan-click2'); return sleep(1500); }

        if (st === 'counting2') {
            var liveCode3 = extractCode();
            if (liveCode3) { S.set('code', liveCode3); showCode(liveCode3); setState('got-code'); return Promise.resolve(); }
            var sc4 = readServerCountdown();
            if (!sc4) {
                var btn3 = findL4MFast() || (findL4MInIframe() ? findL4MInIframe().el : null) || findL4MByPoint();
                if (btn3) {
                    var lc3 = parseInt(S.get('lastClickTime', '0'), 10);
                    if (Date.now() - lc3 > 2500) {
                        S.set('lastClickTime', Date.now().toString());
                        clickL4M(btn3, 'normal');
                        return Promise.resolve();
                    }
                }
                return Promise.resolve();
            }

            var totalSec2 = parseInt(S.get('serverTotalSec2', '0'), 10);
            if (sc4.sec > totalSec2) {
                totalSec2 = sc4.sec;
                S.set('serverTotalSec2', totalSec2.toString());
                log('📊 Mốc gốc phase 2 = ' + totalSec2 + 's');
            }
            if (totalSec2 === 0) {
                totalSec2 = sc4.sec;
                S.set('serverTotalSec2', totalSec2.toString());
                log('📊 Mốc gốc phase 2 = ' + totalSec2 + 's');
            }

            var phaseLabel2 = sc4.phase + '/' + sc4.total;
            showTimer(sc4.sec, totalSec2, 'CHỜ ' + sc4.sec + ' GIÂY (' + phaseLabel2 + ')');
            S.set('lastServerSec', sc4.sec.toString());

            if (sc4.sec === 0) {
                log('→ Phase 2 server về 0, thử lấy code');
                S.del('serverTotalSec2');
                var btn4 = findL4MFast() || (findL4MInIframe() ? findL4MInIframe().el : null) || findL4MByPoint();
                if (btn4) {
                    S.set('lastClickTime', Date.now().toString());
                    clickL4M(btn4, 'normal');
                }
            }
            return Promise.resolve();
        }

        if (st === 'got-code' || st === 'back-link4m') {
            setState('back-link4m');
            showGuide('<b>🏠 ĐANG QUAY VỀ LINK4M...</b>');
            var l4 = S.get('link4m');
            if (l4) return sleep(2500).then(function () { location.href = l4; });
            return Promise.resolve();
        }
        return Promise.resolve();
    }

    function loop() {
        if (loopRunning) return;
        loopRunning = true;
        log('▶ Vòng lặp (poll=' + CFG.poll + 'ms)');
        var i = 0;
        var tick = function () {
            if (i >= CFG.maxLoops) { loopRunning = false; return; }
            i++;
            var p;
            if (isGoogle) p = handleGoogle();
            else if (isRealTargetPage()) p = handleTarget();
            else if (isLink4m) p = handleLink4m();
            else p = Promise.resolve();
            p.catch(function (e) { log('Lỗi:', e.message); }).then(function () {
                if (getState() === 'done') { loopRunning = false; return; }
                setTimeout(tick, CFG.poll);
            });
        };
        tick();
    }

    function addResetButton() {
        if (!UI.actions) return;
        if (UI.actions.querySelector('.mp-reset-wrap')) return;
        var wrap = document.createElement('div');
        wrap.className = 'mp-btn-row mp-reset-wrap';
        var b = document.createElement('button');
        b.className = 'mp-btn gray';
        b.textContent = '🔄 RESET TOOL';
        b.onclick = function () {
            if (!confirm('Reset toàn bộ?')) return;
            stopAutoScroll();
            S.reset();
            location.reload();
        };
        wrap.appendChild(b);
        UI.actions.appendChild(wrap);
    }

    function boot() {
        // Chỉ chạy trên link4m, google, hoặc trang đích
        if (!isLink4m && !isGoogle && !isTargetPage()) return;

        buildPanel();
        var st = getState();
        log('Khởi động | Host:', HOST, '| State:', st, '| isTarget:', isTargetPage(), '| isRealTarget:', isRealTargetPage());
        refreshStatus();
        addResetButton();

        if (S.get('code')) showCode(S.get('code'));

        if (isRealTargetPage() && st === 'click-google') {
            log('→ Phát hiện đang ở trang đích, state click-google → chuyển scan-click1');
            setState('scan-click1');
        }

        if (st && st !== 'idle' && st !== 'done') {
            log('▶ Tự chạy loop');
            loop();
        }

        if (UI.note) {
            if (isLink4m) UI.note.textContent = '💡 LINK4M — nhập domain + BẮT ĐẦU';
            else if (isGoogle) UI.note.textContent = '💡 GOOGLE — tool tự click kết quả';
            else if (isRealTargetPage()) UI.note.textContent = '💡 TRANG ĐÍCH — tool tự săn + click nút L4M';
        }
    }

    // Khởi động sau khi load storage
    loadStorage(function () {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
        else boot();
    });
})();
