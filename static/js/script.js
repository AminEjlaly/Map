'use strict';

async function loadVisitors() {
    const listEl = document.getElementById('visitorList');
    try {
        const res = await fetch('/api/visitors-status');
        const data = await res.json();

        if (!data.success || !data.visitors?.length) {
            listEl.innerHTML = '<p class="empty">فروشنده‌ای یافت نشد</p>';
            document.getElementById('onlineCount').textContent = '۰';
            return;
        }

        const visitors = data.visitors;
        const onlineCount = visitors.filter(v => v.isOnline).length;
        document.getElementById('onlineCount').textContent = toFa(onlineCount);

        listEl.innerHTML = visitors.map(v => {
            const cls = v.isOnline ? 'online' : 'offline';
            const initial = v.name ? v.name.charAt(0) : '؟';
            return `
            <div class="visitor-card ${cls}">
                <div class="visitor-avatar">
                    ${initial}
                    <span class="status-dot ${cls}"></span>
                </div>
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

function toFa(n) {
    return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

document.addEventListener('DOMContentLoaded', () => {
    loadVisitors();
    setInterval(loadVisitors, 15000);
});