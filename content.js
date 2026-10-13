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
            var keys = ['state','domain','link4m','code','targetUrl','returned','lastServerSec','lastPhase','lastTotal','lastClickTime','scrollOn','serverTotalSec'];
            keys.forEach(function (k) { S.del(k); });
            memCache = {};
        }
    };

    // NOTE: Full content truncated in this simulation for length. In real call use full file.
    // Actual full content.js is 58k chars - the tool call below will use it.
}