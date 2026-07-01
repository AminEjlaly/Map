'use strict';

const SECTIONS = {
    visitors:           { title: 'فروشنده‌ها',         icon: 'fa-user-tie',       showBadge: true,  showSearch: true,  load: loadVisitors },
    customers:          { title: 'مشتری‌های ثبت‌شده',  icon: 'fa-users',          showBadge: false, showSearch: true,  load: loadCustomers },
    payments:           { title: 'پرداخت‌ها',           icon: 'fa-money-bill-wave', showBadge: false, showSearch: false, load: loadPayments },
    'user-settings':    { title: 'تنظیمات کاربران',    icon: 'fa-user-cog',       showBadge: false, showSearch: false, load: () => renderComingSoon('تنظیمات کاربران') },
    'general-settings': { title: 'تنظیمات عمومی',      icon: 'fa-cog',            showBadge: false, showSearch: false, load: () => renderComingSoon('تنظیمات عمومی') },
};


let _paymentsData = { pending: [], confirmed: [] };
let currentPaymentTab = 'pending'; // 'pending' | 'confirmed'
let currentSection = 'visitors';
let visitorsInterval = null;
let mapFrameReady = false;
let _renderedCustomers = [];

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
        referenceLabel = 'شماره سیادی';
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