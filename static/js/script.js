'use strict';

const SECTIONS = {
    visitors:           { title: 'فروشنده‌ها',         icon: 'fa-user-tie',       showBadge: true,  load: loadVisitors },
    customers:          { title: 'مشتری‌های ثبت‌شده',  icon: 'fa-users',          showBadge: false, load: () => renderComingSoon('مشتری‌های ثبت‌شده') },
    payments:           { title: 'پرداخت‌ها',           icon: 'fa-money-bill-wave', showBadge: false, load: () => renderComingSoon('پرداخت‌ها') },
    'user-settings':    { title: 'تنظیمات کاربران',    icon: 'fa-user-cog',       showBadge: false, load: () => renderComingSoon('تنظیمات کاربران') },
    'general-settings': { title: 'تنظیمات عمومی',      icon: 'fa-cog',            showBadge: false, load: () => renderComingSoon('تنظیمات عمومی') },
};

let currentSection   = 'visitors';
let visitorsInterval = null;
let mapFrameReady    = false;  // iframe لود شده یا نه

/* ── دسترسی به iframe نقشه ────────────────────────────── */
function getMapFrame() {
    return document.getElementById('mapFrame');
}

function getMapWin() {
    const f = getMapFrame();
    return (f && f.contentWindow) ? f.contentWindow : null;
}

function getMarkers() {
    const w = getMapWin();
    return (w && w.customerMarkers) ? w.customerMarkers : [];
}

function getMap() {
    const w = getMapWin();
    return (w && w.neshanMap) ? w.neshanMap : null;
}

/* ── بخش‌ها ───────────────────────────────────────────── */
function renderComingSoon(label) {
    document.getElementById('visitorList').innerHTML = `
        <div class="coming-soon">
            <i class="fas fa-hammer"></i>
            بخش «${label}» به‌زودی فعال می‌شود
        </div>`;
}

function switchSection(key) {
    currentSection = key;
    const cfg = SECTIONS[key];

    document.querySelectorAll('.section-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.section === key));

    document.getElementById('sectionTitle').textContent    = cfg.title;
    document.getElementById('sectionIcon').className       = `fas ${cfg.icon}`;
    document.getElementById('onlineBadge').style.display   = cfg.showBadge ? 'flex' : 'none';

    clearInterval(visitorsInterval);
    visitorsInterval = null;
    cfg.load();
    if (key === 'visitors') visitorsInterval = setInterval(loadVisitors, 15000);
}

/* ── لود ویزیتورها ────────────────────────────────────── */
async function loadVisitors() {
    const listEl = document.getElementById('visitorList');
    try {
        const data = await fetch('/api/visitors-status').then(r => r.json());

        if (!data.success || !data.visitors?.length) {
            listEl.innerHTML = '<p class="empty">فروشنده‌ای یافت نشد</p>';
            document.getElementById('onlineCount').textContent = '۰';
            return;
        }

        const onlineCount = data.visitors.filter(v => v.isOnline).length;
        document.getElementById('onlineCount').textContent = toFa(onlineCount);

        listEl.innerHTML = data.visitors.map(v => {
            const cls     = v.isOnline ? 'online' : 'offline';
            const initial = v.name ? v.name.charAt(0) : '؟';
            return `
            <div class="visitor-card ${cls}">
                <div class="visitor-avatar">${initial}<span class="status-dot ${cls}"></span></div>
                <div class="visitor-info">
                    <div class="visitor-name">${v.name}</div>
                    <div class="visitor-meta ${cls}">
                        ${v.isOnline ? 'آنلاین' : 'آخرین بازدید: ' + v.lastSeen}
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        listEl.innerHTML = '<p class="error">خطا در بارگذاری</p>';
        console.error(e);
    }
}

/* ── سرچ مشتری ────────────────────────────────────────── */
function initMapSearch() {
    const input    = document.getElementById('mapSearchInput');
    const results  = document.getElementById('mapSearchResults');
    const clearBtn = document.getElementById('mapSearchClear');
    let   timer    = null;

    function renderResults(matched) {
        if (!matched.length) {
            results.innerHTML = '<div class="search-no-result">نتیجه‌ای یافت نشد</div>';
            results.style.display = 'block';
            return;
        }

        results.innerHTML = matched.slice(0, 8).map((item, i) => `
            <div class="search-result-item" data-i="${i}">
                <div class="search-result-avatar">${item.name.charAt(0) || '؟'}</div>
                <div>
                    <div class="search-result-name">${item.name}</div>
                    <div class="search-result-code">کد: ${item.code}</div>
                </div>
            </div>`).join('');
        results.style.display = 'block';

        results.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', () => {
                const item      = matched[+el.dataset.i];
                const neshanMap = getMap();

                if (neshanMap && item.marker) {
                    const ll = item.marker.getLatLng();
                    // setView روی نقشه‌ای که داخل iframe هست
                    neshanMap.setView(ll, 16, { animate: true });
                    setTimeout(() => item.marker.openPopup(), 450);
                }

                input.value           = item.name;
                clearBtn.style.display = 'flex';
                results.style.display  = 'none';
            });
        });
    }

    function doSearch(q) {
        if (!q) { results.style.display = 'none'; return; }

        if (!mapFrameReady) {
            results.innerHTML     = '<div class="search-no-result">در حال بارگذاری نقشه...</div>';
            results.style.display = 'block';
            return;
        }

        const all     = getMarkers();
        const matched = all.filter(m => m.name.includes(q) || String(m.code).includes(q));
        renderResults(matched);
    }

    input.addEventListener('input', () => {
        const q = input.value.trim();
        clearBtn.style.display = q ? 'flex' : 'none';
        clearTimeout(timer);
        timer = setTimeout(() => doSearch(q), 180);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        results.style.display  = 'none';
        input.focus();
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.map-search-wrap')) results.style.display = 'none';
    });

    // وقتی iframe لود کامل شد
    const frame = getMapFrame();
    if (frame) {
        frame.addEventListener('load', () => {
            mapFrameReady = true;
        });
    }
}

/* ── utils ─────────────────────────────────────────────── */
function toFa(n) {
    return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

/* ── init ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.section-btn')
        .forEach(btn => btn.addEventListener('click', () => switchSection(btn.dataset.section)));

    switchSection('visitors');
    initMapSearch();
});