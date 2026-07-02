'use strict';

const SECTIONS = {
    visitors:           { title: 'فروشنده‌ها',         icon: 'fa-user-tie',       showBadge: true,  showSearch: true,  load: loadVisitors },
    customers:          { title: 'مشتری‌های ثبت‌شده',  icon: 'fa-users',          showBadge: false, showSearch: true,  load: loadCustomers },
    payments:           { title: 'پرداخت‌ها',           icon: 'fa-money-bill-wave', showBadge: false, showSearch: false, load: loadPayments },
    'user-settings':    { title: 'تنظیمات کاربران',    icon: 'fa-user-cog',       showBadge: false, showSearch: true,  load: loadUserSettings },
    'general-settings': { title: 'تنظیمات عمومی',      icon: 'fa-cog',            showBadge: false, showSearch: false, load: () => renderComingSoon('تنظیمات عمومی') },
};


let _paymentsData = { pending: [], confirmed: [] };
let currentPaymentTab = 'pending'; // 'pending' | 'confirmed'
let currentSection = 'visitors';
let visitorsInterval = null;
let mapFrameReady = false;
let _renderedCustomers = [];
let _usersData = [];
let _userTypes = [];
let currentUserFilter = 'all'; // 'all' | 'visitor' | 'staff' | 'buyer'





/* ── شهرها ────────────────────────────────────────────── */
let _citiesData = [];
let _selectedCityCode = null;

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

// static/js/script.js - به‌روزرسانی تابع switchSection

function switchSection(key) {
    currentSection = key;
    const cfg = SECTIONS[key];

    document.querySelectorAll('.section-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.section === key));

    document.getElementById('sectionTitle').textContent    = cfg.title;
    document.getElementById('sectionIcon').className       = `fas ${cfg.icon}`;
    document.getElementById('onlineBadge').style.display   = cfg.showBadge ? 'flex' : 'none';
    document.getElementById('reportRouteBtn').style.display = (key === 'visitors') ? 'flex' : 'none';

    const searchWrap  = document.getElementById('panelSearchWrap');
    const searchInput = document.getElementById('panelSearchInput');
    const searchClear = document.getElementById('panelSearchClear');
    
    // برای تنظیمات کاربران هم جستجو فعال باشد
    searchWrap.style.display  = cfg.showSearch ? 'flex' : 'none';
    searchInput.value          = '';
    searchClear.style.display  = 'none';

    clearInterval(visitorsInterval);
    visitorsInterval = null;
    
    // ریست کردن فیلتر کاربران
    if (key === 'user-settings') {
        currentUserFilter = 'all';
    }
    
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

// static/js/script.js - به‌روزرسانی تابع initPanelSearch

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
        } else if (currentSection === 'user-settings') {
            // برای تنظیمات کاربران، فیلتر مجدد اعمال شود
            renderUserSettings(_usersData);
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

/* ── انتخاب شهر روی نقشه ───────────────────────────────── */
function renderCityList(list) {
    const listEl = document.getElementById('citySelectList');

    if (!list.length) {
        listEl.innerHTML = '<div class="city-select-empty">شهری یافت نشد</div>';
        return;
    }

    const allItem = `
        <div class="city-select-item ${!_selectedCityCode ? 'active' : ''}" data-code="">
            <i class="fas fa-globe"></i>
            <span>همه شهرها</span>
        </div>`;

    const items = list.map(c => `
        <div class="city-select-item ${String(_selectedCityCode) === String(c.code) ? 'active' : ''}" data-code="${c.code}">
            <i class="fas fa-map-marker-alt"></i>
            <span>${c.name}</span>
        </div>`).join('');

    listEl.innerHTML = allItem + items;

    listEl.querySelectorAll('.city-select-item').forEach(el => {
        el.addEventListener('click', () => {
            const code = el.dataset.code || null;
            const name = el.querySelector('span').textContent;
            selectCity(code, name);
        });
    });
}

function selectCity(code, name) {
    _selectedCityCode = code || null;
    document.getElementById('citySelectLabel').textContent = name;

    // بستن دراپ‌داون
    document.getElementById('citySelectBox').classList.remove('open');
    document.getElementById('citySelectDropdown').classList.remove('open');

    // رفرش لیست (برای هایلایت آیتم فعال، اگه دوباره باز شد)
    renderCityList(_citiesData);

    // ری‌لود iframe نقشه با فیلتر شهر
    const frame = getMapFrame();
    if (frame) {
        mapFrameReady = false;
        frame.src = _selectedCityCode
            ? `/map-frame?city=${encodeURIComponent(_selectedCityCode)}`
            : '/map-frame';
    }
}

async function loadCities() {
    const listEl = document.getElementById('citySelectList');
    listEl.innerHTML = '<div class="city-select-empty">در حال بارگذاری...</div>';

    try {
        const data = await fetch('/api/cities').then(r => r.json());
        _citiesData = (data.success && data.cities) ? data.cities : [];
        renderCityList(_citiesData);
    } catch (e) {
        listEl.innerHTML = '<div class="city-select-empty">خطا در بارگذاری شهرها</div>';
        console.error(e);
    }
}

function initCitySelect() {
    const box       = document.getElementById('citySelectBox');
    const dropdown  = document.getElementById('citySelectDropdown');
    const searchIn  = document.getElementById('citySelectSearchInput');

    if (!box || !dropdown) return;

    box.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        if (isOpen) {
            box.classList.remove('open');
            dropdown.classList.remove('open');
        } else {
            box.classList.add('open');
            dropdown.classList.add('open');
            if (!_citiesData.length) loadCities();
            if (searchIn) { searchIn.value = ''; }
        }
    });

    dropdown.addEventListener('click', (e) => e.stopPropagation());

    if (searchIn) {
        let timer = null;
        searchIn.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const q = searchIn.value.trim();
                const filtered = q
                    ? _citiesData.filter(c => c.name && c.name.includes(q))
                    : _citiesData;
                renderCityList(filtered);
            }, 120);
        });
    }

    document.addEventListener('click', () => {
        box.classList.remove('open');
        dropdown.classList.remove('open');
    });

    // لود اولیه شهرها (برای پر بودن لیست وقتی برای اولین بار باز میشه)
    loadCities();
}

async function loadPayments() {
    const listEl = document.getElementById('visitorList');
    listEl.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const response = await fetch('/api/payments');
        const data = await response.json();
        
        if (!data.success) {
            listEl.innerHTML = `<p class="error">❌ ${data.error || 'مشکل در دریافت اطلاعات'}</p>`;
            return;
        }
        
        _paymentsData = data;
        renderPaymentsTabs(data);
        
    } catch (e) {
        listEl.innerHTML = '<p class="error">❌ خطا در بارگذاری پرداخت‌ها</p>';
        console.error(e);
    }
}

function renderPaymentsTabs(data) {
    const listEl = document.getElementById('visitorList');
    
    // اگر هیچ پرداختی وجود نداشت
    if (!data.pending?.length && !data.confirmed?.length) {
        listEl.innerHTML = '<p class="empty">هیچ پرداختی یافت نشد</p>';
        return;
    }
    
    // تعداد هر دسته
    const pendingCount = data.pending?.length || 0;
    const confirmedCount = data.confirmed?.length || 0;
    
    let html = `
        <div class="payment-tabs">
            <button class="payment-tab ${currentPaymentTab === 'pending' ? 'active' : ''}" data-tab="pending">
                ⏳ در انتظار تایید
                <span class="payment-tab-badge">${toFa(pendingCount)}</span>
            </button>
            <button class="payment-tab ${currentPaymentTab === 'confirmed' ? 'active' : ''}" data-tab="confirmed">
                ✅ تایید شده
                <span class="payment-tab-badge">${toFa(confirmedCount)}</span>
            </button>
        </div>
        <div class="payment-list-container">
    `;
    
    // نمایش لیست بر اساس تب فعال
    const currentData = currentPaymentTab === 'pending' ? data.pending : data.confirmed;
    
    if (currentData?.length) {
        html += currentData.map((p, index) => 
            renderPaymentCard(p, currentPaymentTab, index)
        ).join('');
    } else {
        html += `<p class="empty">هیچ پرداختی در این دسته وجود ندارد</p>`;
    }
    
    html += `</div>`;
    listEl.innerHTML = html;
    
    // رویدادهای کلیک تب‌ها
    document.querySelectorAll('.payment-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentPaymentTab = tab.dataset.tab;
            renderPaymentsTabs(_paymentsData);
        });
    });
    
    // رویدادهای کلیک کارت‌ها
    document.querySelectorAll('.payment-card').forEach(el => {
        el.addEventListener('click', () => {
            const paymentId = parseInt(el.dataset.paymentId);
            const status = el.dataset.status;
            const payment = status === 'pending' 
                ? _paymentsData.pending.find(p => p.PaymentID === paymentId)
                : _paymentsData.confirmed.find(p => p.PaymentID === paymentId);
            
            if (payment) openPaymentModal(payment);
        });
    });
}

// static/js/script.js - اصلاح تابع renderPaymentCard

function renderPaymentCard(payment, status, index) {
    const isPending = status === 'pending';
    const statusBadge = isPending 
        ? '<span class="payment-status-badge pending">⏳ در انتظار تایید</span>'
        : '<span class="payment-status-badge confirmed">✅ تایید شده</span>';
    
    // تبدیل نوع پرداخت به فارسی با آیکون مناسب
    const paymentTypeMap = {
        'pos': { label: 'پوز', icon: 'fa-credit-card' },
        'transfer': { label: 'حواله', icon: 'fa-exchange-alt' },
        'check': { label: 'چک', icon: 'fa-file-invoice' },
        'cash': { label: 'نقدی', icon: 'fa-money-bill-wave' }
    };
    
    const paymentTypeLower = payment.PaymentType?.toLowerCase() || 'cash';
    const typeInfo = paymentTypeMap[paymentTypeLower] || paymentTypeMap['cash'];
    const paymentTypeLabel = typeInfo.label;
    const paymentTypeIcon = typeInfo.icon;
    
    // فرمت مبلغ با کاما
    const amountFormatted = payment.Amount.toLocaleString('fa-IR');
    
    // نمایش شماره مربوطه بر اساس نوع پرداخت
    let referenceNumber = '';
    let referenceLabel = '';
    
    if (paymentTypeLower === 'check') {
        referenceLabel = 'شماره صیادی';
        referenceNumber = payment.SayyadiNumber || 'ثبت نشده';
    } else if (paymentTypeLower === 'transfer') {
        referenceLabel = 'شماره حواله';
        referenceNumber = payment.SerialNumber || 'ثبت نشده';
    } else if (paymentTypeLower === 'pos') {
        referenceLabel = 'شماره پیگیری';
        referenceNumber = payment.SerialNumber || 'ثبت نشده';
    }
    
    // توضیحات - از ستون Description
    const description = payment.Description || 'توضیحی ثبت نشده';
    
    // تاریخ سررسید چک
    let checkDueDateHtml = '';
    if (paymentTypeLower === 'check' && payment.CheckDueDate) {
        checkDueDateHtml = `
            <div class="payment-check-due">
                <i class="far fa-calendar-alt"></i>
                <span>سررسید: ${payment.CheckDueDate}</span>
            </div>
        `;
    }
    
    return `
        <div class="payment-card ${status}" data-payment-id="${payment.PaymentID}" data-status="${status}">
            <div class="payment-card-header">
                <div class="payment-customer">
                    <span class="payment-customer-name">${payment.CustomerName}</span>
                    <span class="payment-customer-code">کد: ${payment.CustomerCode}</span>
                </div>
                ${statusBadge}
            </div>
            <div class="payment-card-body">
                <div class="payment-amount">
                    <i class="fas fa-toman"></i>
                    <span>${amountFormatted}</span>
                </div>
                <div class="payment-type">
                    <i class="fas ${paymentTypeIcon}"></i>
                    <span>${paymentTypeLabel}</span>
                </div>
                ${referenceNumber ? `
                <div class="payment-reference">
                    <i class="fas fa-hashtag"></i>
                    <span>${referenceLabel}: ${referenceNumber}</span>
                </div>` : ''}
                ${checkDueDateHtml}
            </div>
            <div class="payment-card-footer">
                <div class="payment-footer-left">
                    <span class="payment-delivery">ثبت: ${payment.DeliveryName}</span>
                    <span class="payment-description">${description}</span>
                </div>
                ${isPending ? `<button class="payment-confirm-btn" onclick="event.stopPropagation(); quickConfirmPayment(${payment.PaymentID})">
                    <i class="fas fa-check"></i> تایید
                </button>` : ''}
            </div>
        </div>
    `;
}
function createPaymentModal() {
    const modalHTML = `
        <div class="payment-modal" id="paymentModal">
            <div class="payment-modal-backdrop" onclick="closePaymentModal()"></div>
            <div class="payment-modal-content">

                <div class="payment-modal-hero" id="paymentModalHero">
                    <span class="payment-modal-status-pill" id="paymentModalStatusPill"></span>
                    <div class="payment-modal-hero-top">
                        <div>
                            <div class="payment-modal-customer-name" id="paymentModalCustomer">نام مشتری</div>
                            <div class="payment-modal-customer-code" id="paymentModalCode">کد: -</div>
                        </div>
                        <button class="payment-modal-close" onclick="closePaymentModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="payment-modal-amount-row">
                        <span class="payment-modal-amount-value" id="paymentModalAmount">-</span>
                        <span class="payment-modal-amount-unit"></span>
                    </div>
                </div>

                <div class="payment-modal-body">
                    <div class="payment-modal-info-grid">
                        <div class="payment-modal-info-card">
                            <div class="payment-modal-info-label"><i class="fas fa-wallet"></i> نوع پرداخت</div>
                            <div class="payment-modal-info-value" id="paymentModalType">-</div>
                        </div>
                        <div class="payment-modal-info-card">
                            <div class="payment-modal-info-label"><i class="fas fa-user"></i> ثبت کننده</div>
                            <div class="payment-modal-info-value" id="paymentModalDelivery">-</div>
                        </div>
                        <div class="payment-modal-info-card full">
                            <div class="payment-modal-info-label"><i class="far fa-calendar-alt"></i> تاریخ ثبت</div>
                            <div class="payment-modal-info-value" id="paymentModalDate">-</div>
                        </div>
                        <div id="paymentModalReference" class="payment-modal-info-card full" style="display:none"></div>
                    </div>

                    <div class="payment-modal-desc-box">
                        <div class="payment-modal-info-label"><i class="fas fa-align-right"></i> توضیحات</div>
                        <p class="payment-modal-desc-text" id="paymentModalDesc"></p>
                    </div>

                    <div class="payment-modal-info-label" style="margin-bottom:8px">
                        <i class="fas fa-image"></i> تصویر رسید
                    </div>
                    <div class="payment-modal-image-box" id="paymentModalImage"></div>

                    <div id="paymentModalConfirmedInfo"></div>
                </div>

                <div class="payment-modal-footer">
                    <button class="payment-modal-btn confirm-btn" id="paymentModalConfirmBtn">
                        <i class="fas fa-check"></i> تایید پرداخت
                    </button>
                    <button class="payment-modal-btn close-btn" onclick="closePaymentModal()">بستن</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function openPaymentModal(payment) {
    let modal = document.getElementById('paymentModal');
    if (!modal) {
        createPaymentModal();
        modal = document.getElementById('paymentModal');
    }

    const paymentTypeMap = {
        'pos':      { label: 'پوز',   icon: 'fa-credit-card' },
        'transfer': { label: 'حواله', icon: 'fa-exchange-alt' },
        'check':    { label: 'چک',    icon: 'fa-file-invoice' },
        'cash':     { label: 'نقدی',  icon: 'fa-money-bill-wave' }
    };
    const paymentTypeLower = payment.PaymentType?.toLowerCase() || 'cash';
    const typeInfo = paymentTypeMap[paymentTypeLower] || paymentTypeMap['cash'];

    // هیرو + وضعیت
    const hero = document.getElementById('paymentModalHero');
    const pill = document.getElementById('paymentModalStatusPill');
    hero.classList.toggle('confirmed', payment.IsConfirmed === true);
    if (payment.IsConfirmed === true) {
        pill.className = 'payment-modal-status-pill confirmed';
        pill.innerHTML = '<i class="fas fa-check-circle"></i> تایید شده';
    } else {
        pill.className = 'payment-modal-status-pill pending';
        pill.innerHTML = '<i class="fas fa-clock"></i> در انتظار تایید';
    }

    document.getElementById('paymentModalCustomer').textContent = payment.CustomerName;
    document.getElementById('paymentModalCode').textContent     = `کد مشتری: ${payment.CustomerCode}`;
    document.getElementById('paymentModalAmount').textContent   = payment.Amount.toLocaleString('fa-IR');
    document.getElementById('paymentModalType').innerHTML       = `<i class="fas ${typeInfo.icon}"></i> ${typeInfo.label}`;
    document.getElementById('paymentModalDelivery').textContent = payment.DeliveryName || 'نامشخص';
    document.getElementById('paymentModalDate').textContent     = payment.RegisterDateSh || 'تاریخ نامشخص';
    document.getElementById('paymentModalDesc').textContent     = payment.Description || 'توضیحاتی ثبت نشده';

    // شماره مرجع
    let referenceHtml = '';
    if (paymentTypeLower === 'check') {
        referenceHtml = `<div class="payment-modal-info-label"><i class="fas fa-hashtag"></i> شماره سیادی</div>
            <div class="payment-modal-info-value">${payment.SayyadiNumber || 'ثبت نشده'}</div>`;
        if (payment.CheckDueDate) {
            referenceHtml += `<div class="payment-modal-info-label" style="margin-top:10px"><i class="far fa-calendar-check"></i> تاریخ سررسید چک</div>
                <div class="payment-modal-info-value">${payment.CheckDueDate}</div>`;
        }
    } else if (paymentTypeLower === 'transfer') {
        referenceHtml = `<div class="payment-modal-info-label"><i class="fas fa-hashtag"></i> شماره حواله</div>
            <div class="payment-modal-info-value">${payment.SerialNumber || 'ثبت نشده'}</div>`;
    } else if (paymentTypeLower === 'pos') {
        referenceHtml = `<div class="payment-modal-info-label"><i class="fas fa-hashtag"></i> شماره پیگیری</div>
            <div class="payment-modal-info-value">${payment.SerialNumber || 'ثبت نشده'}</div>`;
    }
    const refContainer = document.getElementById('paymentModalReference');
    if (referenceHtml) {
        refContainer.innerHTML = referenceHtml;
        refContainer.style.display = 'block';
    } else {
        refContainer.style.display = 'none';
    }

    // اطلاعات تاییدکننده
    const confirmedInfo = document.getElementById('paymentModalConfirmedInfo');
    if (payment.IsConfirmed === true) {
        confirmedInfo.innerHTML = `
            <div class="payment-modal-confirmed-info">
                <i class="fas fa-user-check"></i>
                تایید توسط ${payment.ConfirmedBy || 'نامشخص'} — ${payment.ConfirmedAt || ''}
            </div>`;
    } else {
        confirmedInfo.innerHTML = '';
    }

    // تصویر
    const imgContainer = document.getElementById('paymentModalImage');
    if (payment.ImagePath) {
        imgContainer.innerHTML = `
            <img src="${payment.ImagePath}" alt="تصویر رسید"
                 onerror="this.parentElement.innerHTML='<p style=\\'color:#999;text-align:center;padding:20px;font-size:12px\\'>❌ تصویر بارگذاری نشد</p>'">`;
    } else {
        imgContainer.innerHTML = '<p style="color:rgba(255,255,255,.3);text-align:center;padding:20px;font-size:12px">📷 تصویری برای این پرداخت ثبت نشده است</p>';
    }

    // دکمه تایید
    const confirmBtn = document.getElementById('paymentModalConfirmBtn');
    if (payment.IsConfirmed === true) {
        confirmBtn.style.display = 'none';
    } else {
        confirmBtn.style.display = 'flex';
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> تایید پرداخت';
        confirmBtn.onclick = () => confirmPaymentFromModal(payment.PaymentID);
    }

    modal.classList.add('open');
}

function closePaymentModal() {
    document.getElementById('paymentModal')?.classList.remove('open');
}

async function confirmPaymentFromModal(paymentId) {
    const confirmBtn = document.getElementById('paymentModalConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال تایید...';
    
    try {
        const response = await fetch('/api/confirm-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                payment_id: paymentId,
                confirmed_by: 'مدیر سیستم'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ پرداخت با موفقیت تایید شد');
            closePaymentModal();
            loadPayments();
        } else {
            alert(`❌ خطا: ${data.message}`);
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-check"></i> تایید پرداخت';
        }
    } catch (e) {
        alert('❌ خطا در ارتباط با سرور');
        console.error(e);
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> تایید پرداخت';
    }
}

async function quickConfirmPayment(paymentId) {
    if (!confirm('آیا از تایید این پرداخت اطمینان دارید؟')) return;
    
    try {
        const response = await fetch('/api/confirm-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                payment_id: paymentId,
                confirmed_by: 'مدیر سیستم'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ پرداخت تایید شد');
            loadPayments();
        } else {
            alert(`❌ خطا: ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطا در ارتباط با سرور');
        console.error(e);
    }
}
/* ── تنظیمات کاربران ────────────────────────────────────── */
async function loadUserSettings() {
    const listEl = document.getElementById('visitorList');
    listEl.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        // دریافت انواع کاربران
        const typesResponse = await fetch('/api/user-types');
        const typesData = await typesResponse.json();
        if (typesData.success) {
            _userTypes = typesData.types;
        }
        
        // دریافت لیست کاربران
        const response = await fetch('/api/users-settings');
        const data = await response.json();
        
        if (!data.success) {
            listEl.innerHTML = `<p class="error">❌ ${data.error || 'مشکل در دریافت اطلاعات'}</p>`;
            return;
        }
        
        _usersData = data.users;
        renderUserSettings(data.users);
        
    } catch (e) {
        listEl.innerHTML = '<p class="error">❌ خطا در بارگذاری کاربران</p>';
        console.error(e);
    }
}

function renderUserSettings(users) {
    const listEl = document.getElementById('visitorList');

    if (!users?.length) {
        listEl.innerHTML = '<p class="empty">هیچ کاربری یافت نشد</p>';
        return;
    }

    let filteredUsers = users;
    if (currentUserFilter !== 'all') {
        filteredUsers = users.filter(u => u.user_type === currentUserFilter);
    }

    const searchQuery = document.getElementById('panelSearchInput')?.value?.trim() || '';
    if (searchQuery) {
        filteredUsers = filteredUsers.filter(u =>
            u.name.includes(searchQuery) ||
            u.user_code.includes(searchQuery)
        );
    }

    let html = `
        <div class="user-filter-bar">
            <button class="user-filter-btn ${currentUserFilter === 'all' ? 'active' : ''}" data-filter="all">
                همه <span class="filter-count">${toFa(users.length)}</span>
            </button>
    `;

    _userTypes.forEach(type => {
        const count = users.filter(u => u.user_type === type.value).length;
        html += `
            <button class="user-filter-btn ${currentUserFilter === type.value ? 'active' : ''}" data-filter="${type.value}">
                <i class="fas ${type.icon}"></i>
                ${type.label} <span class="filter-count">${toFa(count)}</span>
            </button>
        `;
    });

    html += `</div>`;

    if (!filteredUsers.length) {
        html += '<p class="empty">نتیجه‌ای یافت نشد</p>';
        listEl.innerHTML = html;
        document.querySelectorAll('.user-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentUserFilter = btn.dataset.filter;
                renderUserSettings(_usersData);
            });
        });
        return;
    }

    html += `<div class="user-list">`;
    filteredUsers.forEach((user, index) => {
        html += renderUserCard(user, index);
    });
    html += `</div>`;

    listEl.innerHTML = html;

    // ── فیلتر بالای لیست ──────────────────────────────
    document.querySelectorAll('.user-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentUserFilter = btn.dataset.filter;
            renderUserSettings(_usersData);
        });
    });

    // ── تغییر سوییچ‌ها (فقط یک‌بار ثبت می‌شه) ──────────
    document.querySelectorAll('.user-setting-toggle').forEach(toggle => {
        toggle.addEventListener('change', function () {
            const userCode   = this.dataset.userCode;
            const settingKey = this.dataset.setting;
            const value      = this.checked;

            if (settingKey === 'proximity_check_enabled') {
                const card = this.closest('.user-card');
                const proximityBox = card ? card.querySelector('.user-proximity-control') : null;
                if (proximityBox) {
                    proximityBox.classList.toggle('hidden', !value);
                }
            }

            updateUserSetting(userCode, settingKey, value);
        });
    });

    // ── تغییر ورودی حداکثر فاصله ──────────────────────
    document.querySelectorAll('.user-distance-input').forEach(input => {
        input.addEventListener('change', function () {
            const userCode = this.dataset.userCode;
            const value = parseInt(this.value) || 0;
            updateUserSetting(userCode, 'maxDistance', value);
        });
    });
}

function renderUserCard(user, index) {
    const typeMap = {
        'visitor': { label: 'ویزیتور', icon: 'fa-user-tie', color: '#c9a84c' },
        'staff':   { label: 'پرسنل',   icon: 'fa-user-cog', color: '#3b82f6' },
        'buyer':   { label: 'مشتری',   icon: 'fa-user',     color: '#22c55e' }
    };
    const typeInfo = typeMap[user.user_type] || typeMap['visitor'];

    const statusHtml = user.isOnline
        ? '<span class="user-status online"><span class="pulse-dot"></span>آنلاین</span>'
        : `<span class="user-status offline">${user.lastSeen ? 'بازدید: ' + user.lastSeen : 'آفلاین'}</span>`;

    const proximityHtml = `
        <div class="user-proximity-control ${user.proximity_check_enabled ? '' : 'hidden'}">
            <span><i class="fas fa-ruler"></i> حداکثر فاصله (متر)</span>
            <input type="number" class="user-distance-input"
                   data-user-code="${user.user_code}"
                   value="${user.maxDistance || 0}"
                   min="0" max="99999">
        </div>
    `;

    const toggles = [
        { key: 'status',                    label: 'ورود',   icon: 'fa-door-open',      checked: user.status },
        { key: 'statussell',                label: 'فاکتور', icon: 'fa-file-invoice',   checked: user.statussell },
        { key: 'manfi',                     label: 'منفی',   icon: 'fa-minus-circle',   checked: user.manfi },
        { key: 'proximity_check_enabled',   label: 'محدوده', icon: 'fa-map-marker-alt', checked: user.proximity_check_enabled },
        { key: 'location_tracking_enabled', label: 'ردیابی', icon: 'fa-satellite-dish', checked: user.location_tracking_enabled },
    ];

    const togglesHtml = toggles.map(t => `
        <label class="toggle-row">
            <span class="toggle-icon"><i class="fas ${t.icon}"></i></span>
            <span class="toggle-label">${t.label}</span>
            <span class="toggle-switch">
                <input type="checkbox" class="user-setting-toggle"
                       data-user-code="${user.user_code}"
                       data-setting="${t.key}"
                       ${t.checked ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </span>
        </label>
    `).join('');

    return `
        <div class="user-card" data-user-code="${user.user_code}">
            <div class="user-card-top">
                <div class="user-avatar-sm" style="background:${typeInfo.color}22;border-color:${typeInfo.color}44;">
                    <i class="fas ${typeInfo.icon}" style="color:${typeInfo.color}"></i>
                </div>
                <div class="user-main-info">
                    <div class="user-name-row">
                        <span class="user-name" title="${user.name}">${user.name}</span>
                        <span class="user-type-chip" style="background:${typeInfo.color}1f;color:${typeInfo.color}">${typeInfo.label}</span>
                    </div>
                    <div class="user-sub-row">
                        <span>کد: ${user.user_code}</span>
                        ${statusHtml}
                    </div>
                </div>
            </div>

            <div class="user-toggles">${togglesHtml}</div>
            ${proximityHtml}
        </div>
    `;
}

/* ── به‌روزرسانی تنظیمات کاربر ──────────────────────────── */
let _updateTimer = null;

// static/js/script.js - اصلاح تابع updateUserSetting

async function updateUserSetting(userCode, settingKey, value) {
    const user = _usersData.find(u => u.user_code === userCode);
    if (!user) {
        console.error(`❌ کاربر با کد ${userCode} یافت نشد`);
        showToast('❌ کاربر یافت نشد', 'error');
        return;
    }

    const updateData = {
        user_code: userCode,
        user_type: user.user_type,
        status: user.status,
        statussell: user.statussell,
        manfi: user.manfi,
        proximity_check_enabled: user.proximity_check_enabled,
        maxDistance: user.maxDistance || 0,
        location_tracking_enabled: user.location_tracking_enabled
    };
    updateData[settingKey] = value;

    const toggle = document.querySelector(
        `.user-setting-toggle[data-user-code="${userCode}"][data-setting="${settingKey}"]`
    );
    if (toggle) toggle.disabled = true;

    clearTimeout(_updateTimer);
    _updateTimer = setTimeout(async () => {
        try {
            const response = await fetch('/api/update-user-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            const data = await response.json();

            if (data.success) {
                const userIndex = _usersData.findIndex(u => u.user_code === userCode);
                if (userIndex !== -1) {
                    _usersData[userIndex][settingKey] = value;
                }
                showToast('✅ تنظیمات با موفقیت ذخیره شد', 'success');
            } else {
                showToast(`❌ ${data.message}`, 'error');
                if (toggle) toggle.checked = !value;
            }
        } catch (e) {
            console.error('❌ Error:', e);
            showToast('❌ خطا در ارتباط با سرور', 'error');
            if (toggle) toggle.checked = !value;
        } finally {
            if (toggle) toggle.disabled = false;
        }
    }, 500);
}

/* ── Toast Notification ──────────────────────────────────── */
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // نمایش با انیمیشن
    setTimeout(() => toast.classList.add('show'), 10);
    
    // حذف خودکار بعد از 3 ثانیه
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ── utils ─────────────────────────────────────────────── */
function toFa(n) {
    return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

/* ── مودال گزارش حرکت فروشنده ──────────────────────────── */
let _routeVisitorsLoaded = false;

function openRouteModal() {
    document.getElementById('routeModal').classList.add('open');
    if (!_routeVisitorsLoaded) loadRouteVisitorsSelect();
}
function closeRouteModal() {
    document.getElementById('routeModal').classList.remove('open');
}

async function loadRouteVisitorsSelect() {
    const select = document.getElementById('routeVisitorSelect');
    try {
        const data = await fetch('/api/visitors-status').then(r => r.json());
        const visitors = (data.success && data.visitors) ? data.visitors : [];
        if (!visitors.length) {
            select.innerHTML = '<option value="">فروشنده‌ای یافت نشد</option>';
            return;
        }
        select.innerHTML = visitors
            .map(v => `<option value="${v.code}" data-name="${v.name}">${v.name}</option>`)
            .join('');
        _routeVisitorsLoaded = true;
    } catch (e) {
        select.innerHTML = '<option value="">خطا در بارگذاری</option>';
        console.error(e);
    }
}

async function fillTodayDate() {
    try {
        const data = await fetch('/api/today-date').then(r => r.json());
        if (data.success) document.getElementById('routeDateInput').value = data.date;
    } catch (e) { console.error(e); }
}

function faToEnLocal(str) {
    if (!str) return '';
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

function submitRouteReport() {
    const select = document.getElementById('routeVisitorSelect');
    const dateInput = document.getElementById('routeDateInput');
    const code = select.value;
    const name = select.selectedOptions[0]?.dataset.name || '';
    const date = faToEnLocal(dateInput.value.trim());

    if (!code) { showToast('❌ یک فروشنده انتخاب کن', 'error'); return; }

    const frame = getMapFrame();
    if (!frame) return;

    mapFrameReady = false;
    const params = new URLSearchParams({ visitor: code, name });
    if (date) params.set('date', date);
    frame.src = `/visitor-route-frame?${params.toString()}`;

    document.getElementById('routeActiveText').textContent =
        `مسیر ${name}${date ? ' — ' + date : ' — کل تاریخچه'}`;
    document.getElementById('routeActiveBar').style.display = 'flex';

    closeRouteModal();
}

function closeRouteView() {
    document.getElementById('routeActiveBar').style.display = 'none';
    const frame = getMapFrame();
    if (!frame) return;
    mapFrameReady = false;
    frame.src = _selectedCityCode
        ? `/map-frame?city=${encodeURIComponent(_selectedCityCode)}`
        : '/map-frame';
}

function initRouteModal() {
    document.getElementById('reportRouteBtn')?.addEventListener('click', openRouteModal);
    document.getElementById('routeModalClose')?.addEventListener('click', closeRouteModal);
    document.getElementById('routeModalBackdrop')?.addEventListener('click', closeRouteModal);
    document.getElementById('routeTodayBtn')?.addEventListener('click', fillTodayDate);
    document.getElementById('routeSubmitBtn')?.addEventListener('click', submitRouteReport);
    document.getElementById('routeActiveClose')?.addEventListener('click', closeRouteView);
}

/* ── init ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.section-btn')
        .forEach(btn => btn.addEventListener('click', () => switchSection(btn.dataset.section)));

    switchSection('visitors');
    initMapSearch();
    initPanelSearch();
    initCitySelect();

const photoModalClose    = document.getElementById('photoModalClose');
    const photoModalBackdrop = document.getElementById('photoModalBackdrop');
    if (photoModalClose)    photoModalClose.addEventListener('click', closePhotoModal);
    if (photoModalBackdrop) photoModalBackdrop.addEventListener('click', closePhotoModal);

    initExitButton();
    initRouteModal();
});


/* ── خروج از برنامه ───────────────────────────────────── */
function initExitButton() {
    const btn = document.getElementById('exitAppBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        if (!confirm('آیا مطمئنی می‌خوای از برنامه خارج بشی؟ برنامه کامل بسته می‌شه.')) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>در حال خروج...</span>';

        try {
            await fetch('/api/shutdown', { method: 'POST' });
        } catch (e) {
            // اتصال قطع می‌شه چون سرور بسته میشه، این خطا طبیعیه
        }

        setTimeout(() => {
            document.body.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;
                            height:100vh;background:#0d1526;color:#c9a84c;
                            font-family:Tahoma,sans-serif;font-size:15px;">
                    برنامه با موفقیت بسته شد. این پنجره رو می‌تونید ببندید.
                </div>`;
            try { window.close(); } catch (e) {}
        }, 900);
    });
}