'use strict';

const SECTIONS = {
    visitors:           { title: 'فروشنده‌ها',         icon: 'fa-user-tie',       showBadge: true,  showSearch: true,  load: loadVisitors },
    customers:          { title: 'مشتری‌های ثبت‌شده',  icon: 'fa-users',          showBadge: false, showSearch: true,  load: loadCustomers },
    payments:           { title: 'پرداخت‌ها',           icon: 'fa-money-bill-wave', showBadge: false, showSearch: false, load: () => renderComingSoon('پرداخت‌ها') },
    'user-settings':    { title: 'تنظیمات کاربران',    icon: 'fa-user-cog',       showBadge: false, showSearch: false, load: () => renderComingSoon('تنظیمات کاربران') },
    'general-settings': { title: 'تنظیمات عمومی',      icon: 'fa-cog',            showBadge: false, showSearch: false, load: () => renderComingSoon('تنظیمات عمومی') },
};

let currentSection   = 'visitors';
let visitorsInterval = null;
let mapFrameReady    = false;  // iframe لود شده یا نه

let _renderedCustomers = [];   // آخرین آرایه‌ی رندر شده - برای مچ کردن ایندکس کلیک

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

    const searchWrap  = document.getElementById('panelSearchWrap');
    const searchInput = document.getElementById('panelSearchInput');
    const searchClear = document.getElementById('panelSearchClear');
    searchWrap.style.display  = cfg.showSearch ? 'flex' : 'none';
    searchInput.value          = '';
    searchClear.style.display  = 'none';

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
            window._visitorsData = [];
            listEl.innerHTML = '<p class="empty">فروشنده‌ای یافت نشد</p>';
            document.getElementById('onlineCount').textContent = '۰';
            return;
        }

        window._visitorsData = data.visitors;
        const onlineCount = data.visitors.filter(v => v.isOnline).length;
        document.getElementById('onlineCount').textContent = toFa(onlineCount);

        renderVisitorsList(applyCurrentSearch(data.visitors, 'visitors'));

    } catch (e) {
        listEl.innerHTML = '<p class="error">خطا در بارگذاری</p>';
        console.error(e);
    }
}

function renderVisitorsList(visitors) {
    const listEl = document.getElementById('visitorList');

    if (!visitors.length) {
        listEl.innerHTML = '<p class="empty">نتیجه‌ای یافت نشد</p>';
        return;
    }

    listEl.innerHTML = visitors.map(v => {
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
}

/* ── لود مشتری‌های ثبت‌شده ─────────────────────────────── */
async function loadCustomers() {
    const listEl = document.getElementById('visitorList');
    listEl.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const data = await fetch('/api/new-customers').then(r => r.json());

        if (!data.success || !data.customers?.length) {
            window._customersData = [];
            listEl.innerHTML = '<p class="empty">مشتری‌ای یافت نشد</p>';
            return;
        }

        window._customersData = data.customers;
        renderCustomersList(applyCurrentSearch(data.customers, 'customers'));

    } catch (e) {
        listEl.innerHTML = '<p class="error">خطا در بارگذاری</p>';
        console.error(e);
    }
}

function renderCustomersList(customers) {
    const listEl = document.getElementById('visitorList');
    _renderedCustomers = customers;

    if (!customers.length) {
        listEl.innerHTML = '<p class="empty">نتیجه‌ای یافت نشد</p>';
        return;
    }

    listEl.innerHTML = customers.map((c, i) => {
        const firstPhoto  = c.photos?.[0]?.url || '';
        const photoCount  = c.photos?.length || 0;
        return `
        <div class="customer-card" data-i="${i}">
            <img class="customer-photo" src="${firstPhoto}" alt="${c.name}"
                 onerror="this.classList.add('no-photo')">
            ${photoCount > 1 ? `<span class="customer-photo-count">${toFa(photoCount)}</span>` : ''}
            <div class="customer-info">
                <div class="customer-name">${c.name || 'بدون نام'}</div>
                <div class="customer-code">کد: ${c.code}</div>
                <div class="customer-address">${c.address || 'آدرس ثبت نشده'}</div>
            </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.customer-card').forEach(el => {
        el.addEventListener('click', () => openPhotoModal(_renderedCustomers[+el.dataset.i]));
    });
}

/* ── مودال گالری عکس مشتری ────────────────────────────── */
function openPhotoModal(customer) {
    document.getElementById('photoModalName').textContent    = customer.name || 'بدون نام';
    document.getElementById('photoModalAddress').textContent = customer.address || 'آدرس ثبت نشده';

    const grid = document.getElementById('photoModalGrid');
    grid.innerHTML = (customer.photos?.length)
        ? customer.photos.map(p => `
            <div class="photo-modal-item">
                <img src="${p.url}" alt="" onerror="this.parentElement.classList.add('no-photo')">
                <span class="photo-modal-date">${p.uploadedAt}</span>
                ${p.uploadedBy ? `<span class="photo-modal-by">ثبت توسط: ${p.uploadedBy}</span>` : ''}
            </div>`).join('')
        : '<p class="empty">عکسی یافت نشد</p>';

    document.getElementById('photoModal').classList.add('open');
}

function closePhotoModal() {
    document.getElementById('photoModal').classList.remove('open');
}

/* ── سرچ داخل پنل (فروشنده‌ها / مشتری‌ها) ─────────────── */
function applyCurrentSearch(data, section) {
    const input = document.getElementById('panelSearchInput');
    const q = input ? input.value.trim() : '';
    if (!q) return data;

    if (section === 'visitors') {
        return data.filter(v =>
            (v.name && v.name.includes(q)) ||
            String(v.code).includes(q)
        );
    }
    if (section === 'customers') {
        return data.filter(c =>
            (c.name && c.name.includes(q)) ||
            (c.address && c.address.includes(q)) ||
            String(c.code).includes(q)
        );
    }
    return data;
}

function initPanelSearch() {
    const input    = document.getElementById('panelSearchInput');
    const clearBtn = document.getElementById('panelSearchClear');
    let   timer    = null;

    function runFilter() {
        const q = input.value.trim();
        clearBtn.style.display = q ? 'flex' : 'none';

        if (currentSection === 'visitors') {
            renderVisitorsList(applyCurrentSearch(window._visitorsData || [], 'visitors'));
        } else if (currentSection === 'customers') {
            renderCustomersList(applyCurrentSearch(window._customersData || [], 'customers'));
        }
    }

    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(runFilter, 150);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        runFilter();
        input.focus();
    });
}

/* ── سرچ مشتری روی نقشه ────────────────────────────────── */
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
    initPanelSearch();

    const photoModalClose    = document.getElementById('photoModalClose');
    const photoModalBackdrop = document.getElementById('photoModalBackdrop');
    if (photoModalClose)    photoModalClose.addEventListener('click', closePhotoModal);
    if (photoModalBackdrop) photoModalBackdrop.addEventListener('click', closePhotoModal);
});