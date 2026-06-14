/* 
   消防人員管制系統 - 前端核心邏輯
   製作者：苗栗分隊 温欣凱
*/

// ==========================================================================
// 雲端同步設定 (若要部署至 GitHub Pages，請填寫此處；若本地執行則留空)
// ==========================================================================
const SUPABASE_URL = 'https://pqzuuycrcpedyavilpah.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxenV1eWNyY3BlZHlhdmlscGFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MzY0MzQsImV4cCI6MjA5NzAxMjQzNH0.VzuFyb45gahqMvyS-hF3l80s8vw1-i4kgKVaWnUAT8I';
const INCIDENT_ID = new URLSearchParams(window.location.search).get('id') || 'default';

let useSupabase = false;
let supabaseClient = null;

// 預設全域狀態 (用於新案子初始化時的範本)
const DEFAULT_STATE = {
  "teams": [
    {
      "id": "team_search",
      "name": "搜索組",
      "mission": "人命搜尋",
      "leader": "",
      "members": [],
      "status": "idle",
      "entryTimestamp": null,
      "exitTimestamp": null,
      "acknowledgedIntervals": [],
      "rows": {
        "entry": { "time": "", "pressure": "", "info": "" },
        "reports": [
          { "time": "", "pressure": "", "info": "" },
          { "time": "", "pressure": "", "info": "" }
        ],
        "exit": { "time": "", "pressure": "", "info": "" }
      }
    },
    {
      "id": "team_fire",
      "name": "滅火組",
      "mission": "攻擊車: 車, 水帶: 線",
      "leader": "",
      "members": [],
      "status": "idle",
      "entryTimestamp": null,
      "exitTimestamp": null,
      "acknowledgedIntervals": [],
      "rows": {
        "entry": { "time": "", "pressure": "", "info": "" },
        "reports": [
          { "time": "", "pressure": "", "info": "" },
          { "time": "", "pressure": "", "info": "" }
        ],
        "exit": { "time": "", "pressure": "", "info": "" }
      }
    },
    {
      "id": "team_vent",
      "name": "破壞組",
      "mission": "排煙破壞",
      "leader": "",
      "members": [],
      "status": "idle",
      "entryTimestamp": null,
      "exitTimestamp": null,
      "acknowledgedIntervals": [],
      "rows": {
        "entry": { "time": "", "pressure": "", "info": "" },
        "reports": [
          { "time": "", "pressure": "", "info": "" },
          { "time": "", "pressure": "", "info": "" }
        ],
        "exit": { "time": "", "pressure": "", "info": "" }
      }
    },
    {
      "id": "team_rit",
      "name": "RIT小組",
      "mission": "緊急救援待命",
      "leader": "",
      "members": [],
      "status": "idle",
      "entryTimestamp": null,
      "exitTimestamp": null,
      "acknowledgedIntervals": [],
      "rows": {
        "entry": { "time": "", "pressure": "", "info": "" },
        "reports": [
          { "time": "", "pressure": "", "info": "" },
          { "time": "", "pressure": "", "info": "" }
        ],
        "exit": { "time": "", "pressure": "", "info": "" }
      }
    }
  ],
  "roster": {
    "苗栗分隊": ["温欣凱", "陳小華", "張明志", "李國強"],
    "頭屋分隊": ["徐大明", "黃國書"],
    "特搜分隊": ["王大同", "劉勇信", "趙傑生"],
    "公館分隊": ["江建平", "林政憲"],
    "銅鑼分隊": [],
    "三義分隊": []
  }
};

// 全域狀態 (預設複製 DEFAULT_STATE)
let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

let selectedSquad = null; // 當前在分隊管理中選取的分隊
let activeView = 'grid'; // 'grid' 或 'table'
let syncIntervalId = null;
let clockIntervalId = null;
let timerIntervalId = null;
let ipRefreshIntervalId = null; // 用於定時檢查公網網址是否已建立

// 音效控制
let audioCtx = null;
let soundEnabled = false;
let activeAlarmTeams = new Set(); // 記錄目前哪些小組正在警報中，以便播放警報音效
let soundLoopId = null;

// API 基礎路徑 (若本地執行，直接使用相對路徑即可)
const API_URL = '';

// ==========================================================================
// 1. 初始化與事件綁定
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initApp();
    bindEvents();
    setupAccordions();
});

// 初始化應用程式
async function initApp() {
    // 偵測是否啟用 Supabase
    if (SUPABASE_URL && SUPABASE_KEY) {
        useSupabase = true;
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("Supabase 初始化成功，使用雲端同步模式");
        } catch (err) {
            console.error("Supabase 初始化失敗，切換回本地模式:", err);
            useSupabase = false;
        }
    }

    // 偵測是否為直接雙擊 HTML 開啟 (file:// 協定)
    if (window.location.protocol === 'file:' && !useSupabase) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = 'background: linear-gradient(135deg, #ff1744 0%, #d50000 100%); color: white; text-align: center; padding: 15px 24px; font-weight: bold; font-size: 1.05rem; position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border-bottom: 2px solid rgba(255,255,255,0.2);';
        
        if (isMobile) {
            warningDiv.innerHTML = '⚠️ 【連線錯誤】手機不支援直接按兩下開啟 HTML 檔案！請確保電腦已執行 <code>python server.py</code> 啟動伺服器，並使用手機瀏覽器輸入電腦畫面的【公網分享網址】或【掃描電腦螢幕上的 QR Code】進行連線！';
        } else {
            warningDiv.innerHTML = '⚠️ 【連線錯誤】偵測到您直接按兩下開啟網頁。請勿直接開啟 HTML 檔案！請確保已執行 <code>python server.py</code> 啟動伺服器，並點選或輸入此網址瀏覽：<a href="http://localhost:8080" style="color: #ffff00; text-decoration: underline; margin-left: 5px; font-size: 1.15rem;">http://localhost:8080</a> 才能載入預設分隊與管制小組資料！';
        }
        
        document.body.insertBefore(warningDiv, document.body.firstChild);
        document.body.style.paddingTop = '60px';
    }

    // 獲取伺服器 IP 資訊以進行分享
    fetchServerIp();
    
    if (!useSupabase) {
        // 定期獲取 IP 資訊，直到公網隧道（serveo.net）建立完成
        ipRefreshIntervalId = setInterval(fetchServerIp, 2000);
    }
    // 先行渲染本機/預設狀態，避免載入期間畫面空白
    renderBoard();
    renderRosterQuickSelects();
    
    // 載入狀態
    await loadStateFromServer();
    
    if (useSupabase) {
        // 訂閱 Supabase Realtime 即時推送，不再需要輪詢
        subscribeRealtime();
    } else {
        // 啟動定時輪詢 (每 0.6 秒同步一次，縮短延遲)
        syncIntervalId = setInterval(loadStateFromServer, 600);
    }
    
    // 啟動前端計時器更新 (每 0.5 秒更新一次 UI 計時器顯示)
    timerIntervalId = setInterval(updateTimersAndAlarmsUI, 500);
}

// 獲取伺服器 IP 並設定分享連結與 QR Code
async function fetchServerIp() {
    if (useSupabase) {
        // Supabase 模式：直接使用當前網頁網址作為分享連結 (包含案件 ID 參數)
        const shareContainer = document.getElementById('share-container');
        const shareLink = document.getElementById('share-link');
        const currentUrl = window.location.href;
        
        shareLink.textContent = currentUrl;
        shareLink.href = currentUrl;
        shareContainer.style.display = 'flex';
        
        // 設定 QR Code (使用免費 of qrserver.com API)
        const qrImg = document.getElementById('qr-code-img');
        const encodedUrl = encodeURIComponent(currentUrl);
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodedUrl}`;
        document.getElementById('qr-url-text').textContent = currentUrl;
        
        if (ipRefreshIntervalId) {
            clearInterval(ipRefreshIntervalId);
            ipRefreshIntervalId = null;
        }
        return;
    }

    try {
        const res = await fetch('/api/ip');
        if (res.ok) {
            const data = await res.json();
            const shareContainer = document.getElementById('share-container');
            const shareLink = document.getElementById('share-link');
            
            shareLink.textContent = data.url;
            shareLink.href = data.url;
            shareContainer.style.display = 'flex';
            
            // 設定 QR Code (使用免費的 qrserver.com API)
            const qrImg = document.getElementById('qr-code-img');
            const encodedUrl = encodeURIComponent(data.url);
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodedUrl}`;
            document.getElementById('qr-url-text').textContent = data.url;
            
            // 如果成功獲取到了公網網址 (包含 serveo)，則停止定時輪詢 IP 資訊
            if (data.public_url && ipRefreshIntervalId) {
                clearInterval(ipRefreshIntervalId);
                ipRefreshIntervalId = null;
                console.log("已成功取得公網網址，終止 IP 輪詢機制。");
            }
        }
    } catch (e) {
        console.warn('無法取得伺服器 IP 資訊：', e);
    }
}

// ==========================================================================
// 2. 事件綁定
// ==========================================================================
function bindEvents() {
    // 視角切換
    document.getElementById('btn-view-grid').addEventListener('click', () => switchView('grid'));
    document.getElementById('btn-view-table').addEventListener('click', () => switchView('table'));

    // 彈出視窗開關
    document.getElementById('btn-add-team').addEventListener('click', () => openTeamModal());
    document.getElementById('close-team-modal').addEventListener('click', closeTeamModal);
    document.getElementById('btn-cancel-team').addEventListener('click', closeTeamModal);
    
    document.getElementById('btn-manage-roster').addEventListener('click', openRosterModal);
    document.getElementById('close-roster-modal').addEventListener('click', closeRosterModal);
    
    document.getElementById('btn-show-qr').addEventListener('click', openQrModal);
    document.getElementById('close-qr-modal').addEventListener('click', closeQrModal);
    
    // 關閉 Modal (點擊背景)
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeTeamModal();
            closeRosterModal();
            closeQrModal();
        }
    });

    // 新增/修改小組表單提交
    document.getElementById('form-team').addEventListener('submit', handleTeamFormSubmit);

    // 人員管理相關事件
    document.getElementById('btn-add-squad').addEventListener('click', handleAddSquad);
    document.getElementById('btn-add-member').addEventListener('click', handleAddMember);

    // 音效解鎖/啟用
    document.getElementById('btn-toggle-sound').addEventListener('click', toggleSound);

    // 監聽手動輸入框，當手動輸入時取消快速選擇的選取 (避免衝突)
    document.getElementById('input-leader-manual').addEventListener('input', () => {
        deselectQuickLeader();
    });
}

// 設定檢核表手風琴 (Collapsible Accordions)
function setupAccordions() {
    const triggers = document.querySelectorAll('.accordion-trigger');
    triggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const item = trigger.parentElement;
            item.classList.toggle('active');
        });
    });
}

// 時鐘更新
function initClock() {
    const clock = document.getElementById('live-clock');
    const update = () => {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        clock.textContent = `${h}:${m}:${s}`;
    };
    update();
    clockIntervalId = setInterval(update, 1000);
}

// 視角切換
function switchView(view) {
    activeView = view;
    document.getElementById('btn-view-grid').classList.toggle('active', view === 'grid');
    document.getElementById('btn-view-table').classList.toggle('active', view === 'table');
    
    document.getElementById('grid-view').classList.toggle('active', view === 'grid');
    document.getElementById('table-view').classList.toggle('active', view === 'table');
    
    renderBoard();
}

// 音效控制：啟用與關閉
function toggleSound() {
    if (!audioCtx) {
        // 在使用者點擊的手勢事件中初始化 AudioContext (iOS/Android 必備)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    soundEnabled = !soundEnabled;
    const btn = document.getElementById('btn-toggle-sound');
    
    if (soundEnabled) {
        btn.textContent = '🔊 警報音效已啟用';
        btn.classList.remove('status-off');
        btn.classList.add('status-on');
        
        // 播放測試短音確認正常
        playBeepTone(880, 0.1);
        
        // 啟動警報聲音循環
        startSoundLoop();
    } else {
        btn.textContent = '靜音 🔇 點擊啟用';
        btn.classList.remove('status-on');
        btn.classList.add('status-off');
        
        stopSoundLoop();
    }
}

// ==========================================================================
// 3. Web Audio API 音效合成器
// ==========================================================================
function playBeepTone(frequency, duration) {
    if (!audioCtx || !soundEnabled) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        // 吵雜環境優化：改用 square (方波) 產生更尖銳、穿透力更強的警報聲
        osc.type = 'square';
        osc.frequency.setValueAtTime(frequency, now);
        
        // 放大音量：從 0.15 調大至 0.65，避免被現場引擎或通訊噪音蓋過
        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration - 0.02);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(now);
        osc.stop(now + duration);
    } catch (e) {
        console.error('音效播發失敗：', e);
    }
}

// 警報循環音效 (每 5 秒播一次，若有小組在警報中)
function startSoundLoop() {
    if (soundLoopId) return;
    
    const alarmLoop = () => {
        if (soundEnabled && activeAlarmTeams.size > 0) {
            // 播放高低 alternating 雙音頻警報 beep
            const now = audioCtx.currentTime;
            
            // Beep 1
            setTimeout(() => playBeepTone(960, 0.2), 0);
            setTimeout(() => playBeepTone(960, 0.2), 250);
            
            // Beep 2
            setTimeout(() => playBeepTone(770, 0.2), 600);
            setTimeout(() => playBeepTone(770, 0.2), 850);
        }
        soundLoopId = setTimeout(alarmLoop, 4000);
    };
    
    alarmLoop();
}

function stopSoundLoop() {
    if (soundLoopId) {
        clearTimeout(soundLoopId);
        soundLoopId = null;
    }
}

// ==========================================================================
// 4. API 互動與同步
// ==========================================================================
async function loadStateFromServer() {
    if (useSupabase) {
        try {
            const { data, error } = await supabaseClient
                .from('control_state')
                .select('state_data')
                .eq('incident_id', INCIDENT_ID)
                .maybeSingle();
            
            if (error) throw error;
            
            if (data && data.state_data && data.state_data.teams && data.state_data.teams.length > 0) {
                const dataObj = data.state_data;
                // 判斷架構是否變更（例如：新增/刪除小組、改變狀態、新增回報列、或名冊改變）
                if (isStructureChanged(state, dataObj)) {
                    state = dataObj;
                    // 有結構變更，才進行完整的 DOM 重建渲染
                    renderBoard();
                    renderRosterQuickSelects();
                    if (document.getElementById('modal-roster').classList.contains('active')) {
                        renderRosterManager();
                    }
                } else {
                    // 架構完全相同，僅就文字與 input 數值進行原地 (in-place) 更新，防止手機虛擬鍵盤縮回或打字被覆蓋
                    state = dataObj;
                    updateValuesInPlace(dataObj);
                }
                setConnectionStatus(true);
            } else {
                // 若該 incident_id 還沒有資料，或資料中無小組，則自動寫入並重設為預設初始值
                console.log(`初始化或重設案件的預設資料: ${INCIDENT_ID}`);
                state = JSON.parse(JSON.stringify(DEFAULT_STATE));
                await saveStateToSupabase(state);
                setConnectionStatus(true);
                renderBoard();
                renderRosterQuickSelects();
                if (document.getElementById('modal-roster').classList.contains('active')) {
                    renderRosterManager();
                }
            }
        } catch (e) {
            console.error('讀取 Supabase 失敗：', e);
            setConnectionStatus(false);
        }
        return;
    }

    try {
        // 加上時間戳記防禦瀏覽器快取 (Cache Bypass)，強制每次都向伺服器拉取最新 state
        const res = await fetch(`/api/state?t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            
            // 判斷架構是否變更（例如：新增/刪除小組、改變狀態、新增回報列、或名冊改變）
            if (isStructureChanged(state, data)) {
                state = data;
                // 有結構變更，才進行完整的 DOM 重建渲染
                renderBoard();
                renderRosterQuickSelects();
                if (document.getElementById('modal-roster').classList.contains('active')) {
                    renderRosterManager();
                }
            } else {
                // 架構完全相同，僅就文字與 input 數值進行原地 (in-place) 更新，防止手機虛擬鍵盤縮回或打字被覆蓋
                state = data;
                updateValuesInPlace(data);
            }
            
            setConnectionStatus(true);
        } else {
            setConnectionStatus(false);
        }
    } catch (e) {
        console.error('無法連線至伺服器：', e);
        setConnectionStatus(false);
    }
}

// 判定兩次 state 的小組結構、狀態與人員是否發生變化
function isStructureChanged(s1, s2) {
    if (!s1 || !s2) return true;
    if (!s1.teams || !s2.teams) return true;
    if (s1.teams.length !== s2.teams.length) return true;
    
    for (let i = 0; i < s1.teams.length; i++) {
        const t1 = s1.teams[i];
        const t2 = s2.teams[i];
        if (t1.id !== t2.id) return true;
        if (t1.status !== t2.status) return true;
        if (t1.name !== t2.name) return true;
        if (t1.mission !== t2.mission) return true;
        if (t1.leader !== t2.leader) return true;
        
        // 比較組員
        const m1 = t1.members || [];
        const m2 = t2.members || [];
        if (m1.length !== m2.length) return true;
        for (let j = 0; j < m1.length; j++) {
            if (m1[j] !== m2[j]) return true;
        }
        
        // 比較回報列數量
        const r1 = (t1.rows && t1.rows.reports) ? t1.rows.reports.length : 0;
        const r2 = (t2.rows && t2.rows.reports) ? t2.rows.reports.length : 0;
        if (r1 !== r2) return true;
    }
    
    // 檢查名冊結構
    const keys1 = Object.keys(s1.roster || {});
    const keys2 = Object.keys(s2.roster || {});
    if (keys1.length !== keys2.length) return true;
    for (let k of keys1) {
        if (!s2.roster[k]) return true;
        if (s1.roster[k].length !== s2.roster[k].length) return true;
        for (let j = 0; j < s1.roster[k].length; j++) {
            if (s1.roster[k][j] !== s2.roster[k][j]) return true;
        }
    }
    
    return false;
}

// 原地更新欄位數值與時間顯示，防止 DOM 重建引發的行動端鍵盤收起與輸入衝突
function updateValuesInPlace(data) {
    if (!data || !data.teams) return;
    
    data.teams.forEach(team => {
        const teamId = team.id;
        
        // 1. 更新進入列
        updateSingleRowValues(teamId, 'entry', team.rows.entry);
        
        // 2. 更新回報列
        const reports = team.rows.reports || [];
        reports.forEach((rep, idx) => {
            updateSingleRowValues(teamId, `report_${idx}`, rep);
        });
        
        // 3. 更新撤出列
        updateSingleRowValues(teamId, 'exit', team.rows.exit);
    });
}

function updateSingleRowValues(teamId, rowKey, rowData) {
    const timeVal = rowData.time || '';
    const pressureVal = rowData.pressure || '';
    const infoVal = rowData.info || '';
    
    // 1. 更新卡片 (Grid) 的時間顯示
    const timeEl = document.getElementById(`time-${teamId}-${rowKey}`);
    if (timeEl) {
        const displayVal = timeVal || '--:--';
        if (timeEl.textContent !== displayVal) {
            timeEl.textContent = displayVal;
        }
        
        // 更新卡片按鈕的選取狀態
        const labelBtn = timeEl.previousElementSibling;
        if (labelBtn && labelBtn.classList.contains('event-label-btn')) {
            labelBtn.classList.toggle('active-time', !!timeVal);
        }
    }
    
    // 2. 更新卡片 (Grid) 的氣量輸入 (若該輸入框目前沒被 focus，則原地更新值)
    const pressEl = document.getElementById(`press-${teamId}-${rowKey}`);
    if (pressEl && document.activeElement !== pressEl) {
        if (pressEl.value !== pressureVal) {
            pressEl.value = pressureVal;
        }
    }
    
    // 3. 更新卡片 (Grid) 的備註輸入 (若該輸入框目前沒被 focus，則原地更新值)
    const infoEl = document.getElementById(`info-${teamId}-${rowKey}`);
    if (infoEl && document.activeElement !== infoEl) {
        if (infoEl.value !== infoVal) {
            infoEl.value = infoVal;
        }
    }
    
    // 4. 更新表格 (Table) 視角下的時間與輸入框
    const tTimeEl = document.getElementById(`t-time-${teamId}-${rowKey}`);
    if (tTimeEl) {
        const displayVal = timeVal || '--:--';
        if (tTimeEl.textContent !== displayVal) {
            tTimeEl.textContent = displayVal;
        }
        
        const tLabelBtn = tTimeEl.parentElement.previousElementSibling?.firstElementChild;
        if (tLabelBtn && tLabelBtn.classList.contains('event-label-btn')) {
            tLabelBtn.classList.toggle('active-time', !!timeVal);
        }
    }
    
    const tPressEl = document.getElementById(`t-press-${teamId}-${rowKey}`);
    if (tPressEl && document.activeElement !== tPressEl) {
        if (tPressEl.value !== pressureVal) {
            tPressEl.value = pressureVal;
        }
    }
    
    const tInfoEl = document.getElementById(`t-info-${teamId}-${rowKey}`);
    if (tInfoEl && document.activeElement !== tInfoEl) {
        if (tInfoEl.value !== infoVal) {
            tInfoEl.value = infoVal;
        }
    }
}

async function saveStateToServer() {
    if (useSupabase) {
        await saveStateToSupabase(state);
        return;
    }

    try {
        const res = await fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });
        if (res.ok) {
            setConnectionStatus(true);
        } else {
            setConnectionStatus(false);
        }
    } catch (e) {
        console.error('儲存狀態失敗：', e);
        setConnectionStatus(false);
    }
}

async function saveStateToSupabase(stateData) {
    try {
        const { error } = await supabaseClient
            .from('control_state')
            .upsert({ 
                incident_id: INCIDENT_ID, 
                state_data: stateData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'incident_id' });
        
        if (error) throw error;
        setConnectionStatus(true);
    } catch (e) {
        console.error('儲存狀態至 Supabase 失敗：', e);
        setConnectionStatus(false);
    }
}

function subscribeRealtime() {
    if (!useSupabase || !supabaseClient) return;

    supabaseClient
        .channel('public:control_state')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'control_state',
            filter: `incident_id=eq.${INCIDENT_ID}`
        }, payload => {
            const dataObj = payload.new?.state_data;
            if (dataObj) {
                if (isStructureChanged(state, dataObj)) {
                    state = dataObj;
                    renderBoard();
                    renderRosterQuickSelects();
                    if (document.getElementById('modal-roster').classList.contains('active')) {
                        renderRosterManager();
                    }
                } else {
                    state = dataObj;
                    updateValuesInPlace(dataObj);
                }
            }
        })
        .subscribe();
}

function setConnectionStatus(connected) {
    const dot = document.querySelector('#conn-status .status-dot');
    const text = document.querySelector('#conn-status .status-text');
    if (connected) {
        dot.classList.remove('disconnected');
        dot.classList.add('pulsing');
        text.textContent = '同步連線中';
    } else {
        dot.classList.add('disconnected');
        dot.classList.remove('pulsing');
        text.textContent = '連線中斷';
    }
}

// ==========================================================================
// 5. 渲染看板邏輯 (核心 UI 繪製)
// ==========================================================================
function renderBoard() {
    const container = document.getElementById('team-cards-container');
    const tableBody = document.getElementById('table-rows-container');
    const noTeamsMsg = document.getElementById('no-teams-msg');
    
    if (state.teams.length === 0) {
        noTeamsMsg.style.display = 'block';
        container.innerHTML = '';
        tableBody.innerHTML = '';
        return;
    }
    
    noTeamsMsg.style.display = 'none';

    if (activeView === 'grid') {
        renderGridView(container);
    } else {
        renderTableView(tableBody);
    }
}

// --- 5.1 看板模式渲染 (Grid) ---
function renderGridView(container) {
    // 獲取目前正處於 focus 的 input ID，以防重新渲染時失焦
    const activeId = document.activeElement ? document.activeElement.id : null;
    const activeSelectionStart = document.activeElement ? document.activeElement.selectionStart : null;
    const activeSelectionEnd = document.activeElement ? document.activeElement.selectionEnd : null;

    let html = '';
    
    state.teams.forEach(team => {
        const status = team.status || 'idle';
        const teamId = team.id;
        
        // 組合編組人員標籤
        let leaderHtml = team.leader ? `<span class="badge-name leader">⭐ ${team.leader}</span>` : '<span class="text-muted">(無)</span>';
        let membersHtml = team.members && team.members.length > 0 
            ? team.members.map(m => `<span class="badge-name">${m}</span>`).join(', ') 
            : '<span class="text-muted">(無)</span>';

        // 判定卡片底下的主要按鈕
        let actionBtnHtml = '';
        if (status === 'idle') {
            actionBtnHtml = `<button class="btn btn-start" onclick="startTeamEntry('${teamId}')">🚀 開始進入</button>`;
        } else if (status === 'entered') {
            actionBtnHtml = `<button class="btn btn-exit" onclick="exitTeam('${teamId}')">🏁 撤出</button>`;
        } else if (status === 'alarm') {
            actionBtnHtml = `
                <button class="btn btn-ack" onclick="acknowledgeAlarm('${teamId}')">🔕 確認警報</button>
                <button class="btn btn-exit" onclick="exitTeam('${teamId}')">🏁 撤出</button>
            `;
        } else if (status === 'exited') {
            actionBtnHtml = `<button class="btn btn-reset" onclick="resetTeamState('${teamId}')">🔄 重設重啟</button>`;
        }

        // 動態生成事件行 (進入、回報1、回報2...、撤出)
        let rowsHtml = '';
        
        // 進入列 (在開始進入前氣量與資訊即可自己輸入，因此 idle 時不 disabled)
        rowsHtml += renderEventRow(teamId, 'entry', '進入', team.rows.entry, status === 'exited');
        
        // 回報列 (動態數量，預設至少有 2 個回報，使用者可自己加)
        const reports = team.rows.reports || [];
        reports.forEach((rep, idx) => {
            rowsHtml += renderEventRow(teamId, `report_${idx}`, `回報 ${idx+1}`, rep, status === 'idle' || status === 'exited');
        });
        
        // 撤出列
        rowsHtml += renderEventRow(teamId, 'exit', '撤出', team.rows.exit, status === 'idle' || status === 'exited');

        html += `
            <div class="team-card status-${status}" id="card-${teamId}">
                <div class="card-header">
                    <div class="card-header-left">
                        <div class="team-title-row">
                            <span class="team-card-name">${escapeHtml(team.name)}</span>
                            <span class="mission-tag">${escapeHtml(team.mission || '無特定任務')}</span>
                            <span class="status-badge ${status}">${getStatusText(status)}</span>
                        </div>
                    </div>
                    <button class="btn-card-edit" onclick="editTeam('${teamId}')" title="編輯人員與任務">✏️</button>
                </div>
                
                <div class="card-roster">
                    <div class="roster-role-group">
                        <span class="role-label role-leader">帶隊官</span>
                        ${leaderHtml}
                    </div>
                    <div class="roster-role-group">
                        <span class="role-label role-members">組員</span>
                        ${membersHtml}
                    </div>
                </div>

                <div class="card-body">
                    <div class="timer-section">
                        <span class="timer-label">工作計時器</span>
                        <div class="timer-display" id="timer-${teamId}">00:00</div>
                    </div>
                    
                    <div class="event-rows">
                        <div class="event-row event-header" style="font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 3px; font-weight: bold;">
                            <div>階段</div>
                            <div style="text-align: center;">時間</div>
                            <div style="text-align: center;">氣量 (Bar)</div>
                            <div>備註資訊</div>
                        </div>
                        ${rowsHtml}
                    </div>

                    <div class="btn-add-row-container">
                        <button class="btn-add-row" onclick="addReportRow('${teamId}')" ${status === 'exited' ? 'disabled' : ''}>➕ 新增回報階段</button>
                    </div>
                </div>

                <div class="card-footer">
                    ${actionBtnHtml}
                    <button class="btn btn-delete-team" onclick="deleteTeam('${teamId}')" title="刪除此組">🗑️ 刪除</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // 恢復輸入框 Focus 狀態與游標位置，避免 Polling 重繪導致使用者打字中斷
    if (activeId) {
        const inputEl = document.getElementById(activeId);
        if (inputEl) {
            inputEl.focus();
            if (activeSelectionStart !== null && activeSelectionEnd !== null && (inputEl.type === 'text' || inputEl.type === 'search')) {
                inputEl.setSelectionRange(activeSelectionStart, activeSelectionEnd);
            }
        }
    }
}

// 渲染單一事件行
function renderEventRow(teamId, rowKey, label, rowData, disabled) {
    const timeVal = rowData.time || '';
    const pressureVal = rowData.pressure || '';
    const infoVal = rowData.info || '';
    
    // 如果是時間按鈕點選後，會自動帶入時間
    const activeTimeClass = timeVal ? 'active-time' : '';
    
    return `
        <div class="event-row" data-row-key="${rowKey}">
            <button class="event-label-btn ${activeTimeClass}" onclick="setRowTimeNow('${teamId}', '${rowKey}')" ${disabled ? 'disabled' : ''}>
                ${label}
            </button>
            <div class="event-time-display" id="time-${teamId}-${rowKey}">${timeVal || '--:--'}</div>
            <input type="text" 
                   class="input-pressure" 
                   id="press-${teamId}-${rowKey}" 
                   value="${escapeHtml(pressureVal)}" 
                   placeholder="Bar"
                   oninput="updateInputState('${teamId}', '${rowKey}', 'pressure', this.value)"
                   ${disabled ? 'disabled' : ''}>
            <input type="text" 
                   class="input-info" 
                   id="info-${teamId}-${rowKey}" 
                   value="${escapeHtml(infoVal)}" 
                   placeholder="地點、回報狀況等..."
                   oninput="updateInputState('${teamId}', '${rowKey}', 'info', this.value)"
                   ${disabled ? 'disabled' : ''}>
        </div>
    `;
}

// --- 5.2 表格模式渲染 (Traditional Table) ---
function renderTableView(tableBody) {
    let html = '';
    
    // 獲取目前正處於 focus 的 input ID
    const activeId = document.activeElement ? document.activeElement.id : null;
    
    state.teams.forEach(team => {
        const teamId = team.id;
        const status = team.status || 'idle';
        const reports = team.rows.reports || [];
        
        // 總共需要的行數 = 進入 (1) + 回報 (N) + 撤出 (1)
        const totalRowsCount = 2 + reports.length;
        
        // 組合隊員名單
        const leaderText = team.leader ? `⭐ ${team.leader} (帶隊官)` : '';
        const membersText = team.members && team.members.length > 0 ? `組員: ${team.members.join(', ')}` : '';
        const rosterText = [leaderText, membersText].filter(t => t).join('<br>');

        // 渲染第一列 (帶小組資訊)
        html += `
            <tr class="team-row-group status-${status}">
                <td rowspan="${totalRowsCount}">
                    <div class="table-team-cell">
                        <div class="table-team-header">
                            <span class="table-team-name">${escapeHtml(team.name)}</span>
                            <span class="status-badge ${status}">${getStatusText(status)}</span>
                        </div>
                        <div class="mission-tag" style="align-self: flex-start;">${escapeHtml(team.mission || '無特定任務')}</div>
                        <div class="table-roster-display">${rosterText}</div>
                        <div class="timer-section" style="margin-top: 10px; padding: 4px 8px;">
                            <span class="timer-label" style="font-size:0.75rem;">計時：</span>
                            <span class="timer-display" id="table-timer-${teamId}" style="font-size:1.2rem;">00:00</span>
                        </div>
                        <div style="margin-top:10px; display:flex; gap:5px;">
                            ${renderTableFooterActions(team, status)}
                        </div>
                    </div>
                </td>
                
                <!-- 進入行資料 -->
                <td>
                    <button class="event-label-btn ${team.rows.entry.time ? 'active-time' : ''}" onclick="setRowTimeNow('${teamId}', 'entry')">進入</button>
                </td>
                <td>
                    <div class="event-time-display" id="t-time-${teamId}-entry">${team.rows.entry.time || '--:--'}</div>
                </td>
                <td>
                    <input type="text" class="input-pressure" id="t-press-${teamId}-entry" value="${escapeHtml(team.rows.entry.pressure)}" placeholder="氣量" oninput="updateInputState('${teamId}', 'entry', 'pressure', this.value)">
                </td>
                <td>
                    <input type="text" class="input-info" id="t-info-${teamId}-entry" value="${escapeHtml(team.rows.entry.info)}" placeholder="輸入資訊..." oninput="updateInputState('${teamId}', 'entry', 'info', this.value)">
                </td>
            </tr>
        `;

        // 渲染回報列
        reports.forEach((rep, idx) => {
            html += `
                <tr class="status-${status}">
                    <td>
                        <button class="event-label-btn ${rep.time ? 'active-time' : ''}" onclick="setRowTimeNow('${teamId}', 'report_${idx}')">回報 ${idx+1}</button>
                    </td>
                    <td>
                        <div class="event-time-display" id="t-time-${teamId}-report_${idx}">${rep.time || '--:--'}</div>
                    </td>
                    <td>
                        <input type="text" class="input-pressure" id="t-press-${teamId}-report_${idx}" value="${escapeHtml(rep.pressure)}" placeholder="氣量" oninput="updateInputState('${teamId}', 'report_${idx}', 'pressure', this.value)">
                    </td>
                    <td>
                        <input type="text" class="input-info" id="t-info-${teamId}-report_${idx}" value="${escapeHtml(rep.info)}" placeholder="輸入資訊..." oninput="updateInputState('${teamId}', 'report_${idx}', 'info', this.value)">
                    </td>
                </tr>
            `;
        });

        // 渲染撤出列
        html += `
            <tr class="status-${status}" style="border-bottom: 2px solid rgba(255,255,255,0.15)">
                <td>
                    <button class="event-label-btn ${team.rows.exit.time ? 'active-time' : ''}" onclick="setRowTimeNow('${teamId}', 'exit')">撤出</button>
                </td>
                <td>
                    <div class="event-time-display" id="t-time-${teamId}-exit">${team.rows.exit.time || '--:--'}</div>
                </td>
                <td>
                    <input type="text" class="input-pressure" id="t-press-${teamId}-exit" value="${escapeHtml(team.rows.exit.pressure)}" placeholder="氣量" oninput="updateInputState('${teamId}', 'exit', 'pressure', this.value)">
                </td>
                <td>
                    <input type="text" class="input-info" id="t-info-${teamId}-exit" value="${escapeHtml(team.rows.exit.info)}" placeholder="輸入資訊..." oninput="updateInputState('${teamId}', 'exit', 'info', this.value)">
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    // 恢復 focus
    if (activeId) {
        const inputEl = document.getElementById(activeId);
        if (inputEl) inputEl.focus();
    }
}

// 表格底小組控制按鈕
function renderTableFooterActions(team, status) {
    const teamId = team.id;
    if (status === 'idle') {
        return `<button class="btn btn-primary btn-small table-btn-action" onclick="startTeamEntry('${teamId}')">開始</button>`;
    } else if (status === 'entered') {
        return `<button class="btn btn-exit btn-small table-btn-action" onclick="exitTeam('${teamId}')">撤出</button>`;
    } else if (status === 'alarm') {
        return `
            <button class="btn btn-ack btn-small table-btn-action" onclick="acknowledgeAlarm('${teamId}')">確認警報</button>
            <button class="btn btn-exit btn-small table-btn-action" onclick="exitTeam('${teamId}')">撤出</button>
        `;
    } else if (status === 'exited') {
        return `<button class="btn btn-reset btn-small table-btn-action" onclick="resetTeamState('${teamId}')">重設</button>`;
    }
    return '';
}

// 輔助函式
function getStatusText(status) {
    switch (status) {
        case 'idle': return '待命';
        case 'entered': return '熱區工作';
        case 'alarm': return '⚠️ 警報';
        case 'exited': return '安全撤出';
        default: return '未知';
    }
}

// ==========================================================================
// 6. 前端計時器與警報核心邏輯 (0.5秒執行一次)
// ==========================================================================
function updateTimersAndAlarmsUI() {
    const isTestMode = document.getElementById('chk-test-mode').checked;
    const now = Date.now();
    let alarmStateChanged = false;
    let newAlarmTeams = new Set();

    state.teams.forEach(team => {
        const teamId = team.id;
        const timerEl = document.getElementById(`timer-${teamId}`);
        const tableTimerEl = document.getElementById(`table-timer-${teamId}`);
        
        let displayStr = '00:00';
        let totalElapsedSeconds = 0;

        if (team.status === 'entered' || team.status === 'alarm') {
            const entryTime = team.entryTimestamp || now;
            const elapsedMs = now - entryTime;
            const elapsedRealSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
            
            if (isTestMode) {
                // 加速測試模式：1秒 = 1分鐘 (即 60 倍速)
                totalElapsedSeconds = elapsedRealSeconds * 60;
            } else {
                totalElapsedSeconds = elapsedRealSeconds;
            }

            const hrs = Math.floor(totalElapsedSeconds / 3600);
            const mins = Math.floor((totalElapsedSeconds % 3600) / 60);
            const secs = totalElapsedSeconds % 60;
            
            if (hrs > 0) {
                displayStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            } else {
                displayStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }
            
            // 警報檢測：每 15 分鐘 (900秒) 警報一次，確認該時間點是否已經 Acknowledge
            const elapsedMinutes = Math.floor(totalElapsedSeconds / 60);
            const isAlarmInterval = (elapsedMinutes > 0 && elapsedMinutes % 15 === 0);
            
            if (isAlarmInterval) {
                const intervalMarker = elapsedMinutes;
                const ackList = team.acknowledgedIntervals || [];
                
                if (!ackList.includes(intervalMarker)) {
                    // 該 15 分鐘區段尚未確認，觸發警報！
                    if (team.status !== 'alarm') {
                        team.status = 'alarm';
                        // 發送狀態變更至伺服器
                        saveStateToServer();
                        renderBoard();
                    }
                    newAlarmTeams.add(teamId);
                }
            } else {
                // 如果已經離開警報時間區段 (例如 15 分鐘過去了進入第 16 分鐘)，
                // 且先前為 alarm 狀態，則自動回歸 entered 狀態，或者持續警報直到解除？
                // 在安全管理中，警報觸發後，必須維持 alarm 狀態直到點擊「確認警報」(這會將 interval 加入 ack 陣列)
                if (team.status === 'alarm') {
                    // 如果這個 interval 被 ack 了，它會回歸 entered，否則會一直是 alarm
                    const currentIntervalMarker = Math.floor(elapsedMinutes / 15) * 15;
                    const ackList = team.acknowledgedIntervals || [];
                    if (ackList.includes(currentIntervalMarker) || currentIntervalMarker === 0) {
                        team.status = 'entered';
                        saveStateToServer();
                        renderBoard();
                    } else {
                        newAlarmTeams.add(teamId);
                    }
                }
            }
        } else if (team.status === 'exited') {
            // 已撤出，計算從進入到撤出所花的時間
            if (team.entryTimestamp && team.exitTimestamp) {
                const entry = team.entryTimestamp;
                const exit = team.exitTimestamp;
                const elapsedMs = exit - entry;
                const elapsedRealSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
                
                if (isTestMode) {
                    totalElapsedSeconds = elapsedRealSeconds * 60;
                } else {
                    totalElapsedSeconds = elapsedRealSeconds;
                }
                
                const hrs = Math.floor(totalElapsedSeconds / 3600);
                const mins = Math.floor((totalElapsedSeconds % 3600) / 60);
                const secs = totalElapsedSeconds % 60;
                
                if (hrs > 0) {
                    displayStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                } else {
                    displayStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                }
            } else {
                displayStr = '已撤出';
            }
        }
        
        // 更新 UI 顯示值
        if (timerEl) timerEl.textContent = displayStr;
        if (tableTimerEl) tableTimerEl.textContent = displayStr;
    });

    // 判斷警報集合是否發生變化，進而影響警報音效播放
    const oldAlarmSize = activeAlarmTeams.size;
    activeAlarmTeams = newAlarmTeams;
    
    if (activeAlarmTeams.size > 0 && oldAlarmSize === 0) {
        // 從無警報變成有警報，如果音效已啟用，可確保播放
        if (soundEnabled && audioCtx) {
            audioCtx.resume();
        }
    }
}

// ==========================================================================
// 7. 小組操作邏輯 (開始進入, 撤出, 回報, 刪除, 重設)
// ==========================================================================

// 🚀 開始進入 (點選時間後開始計時)
async function startTeamEntry(teamId) {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return;
    
    const now = new Date();
    const timeStr = formatShortTime(now);

    team.status = 'entered';
    team.entryTimestamp = Date.now();
    team.exitTimestamp = null;
    team.rows.entry.time = timeStr;
    team.acknowledgedIntervals = []; // 清空已確認警報區段

    renderBoard();
    await saveStateToServer();
}

// 🏁 撤出
async function exitTeam(teamId) {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return;
    
    const now = new Date();
    const timeStr = formatShortTime(now);

    team.status = 'exited';
    team.exitTimestamp = Date.now();
    team.rows.exit.time = timeStr;

    // 清空警報列表
    activeAlarmTeams.delete(teamId);

    renderBoard();
    await saveStateToServer();
}

// 🔕 確認警報 (Acknowledge)
async function acknowledgeAlarm(teamId) {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return;

    const isTestMode = document.getElementById('chk-test-mode').checked;
    const elapsedMs = Date.now() - (team.entryTimestamp || Date.now());
    const elapsedRealSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const totalElapsedSeconds = isTestMode ? elapsedRealSeconds * 60 : elapsedRealSeconds;
    const elapsedMinutes = Math.floor(totalElapsedSeconds / 60);

    // 找出當前是哪一個 15 分鐘倍數區間需要被確認
    const currentInterval = Math.max(15, Math.floor(elapsedMinutes / 15) * 15);
    
    if (!team.acknowledgedIntervals) {
        team.acknowledgedIntervals = [];
    }
    
    if (!team.acknowledgedIntervals.includes(currentInterval)) {
        team.acknowledgedIntervals.push(currentInterval);
    }

    // 將狀態重設回正常進入狀態
    team.status = 'entered';
    activeAlarmTeams.delete(teamId);

    renderBoard();
    await saveStateToServer();
}

// 🔄 重設小組
async function resetTeamState(teamId) {
    if (!confirm('確定要重設該小組的時間與氣量數據嗎？')) return;
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return;

    team.status = 'idle';
    team.entryTimestamp = null;
    team.exitTimestamp = null;
    team.acknowledgedIntervals = [];
    
    team.rows = {
        entry: { time: '', pressure: '', info: '' },
        reports: [
            { time: '', pressure: '', info: '' },
            { time: '', pressure: '', info: '' }
        ],
        exit: { time: '', pressure: '', info: '' }
    };

    activeAlarmTeams.delete(teamId);
    renderBoard();
    await saveStateToServer();
}

// 🗑️ 刪除小組
async function deleteTeam(teamId) {
    if (!confirm('確認要刪除此管制小組嗎？此動作無法復原。')) return;
    
    state.teams = state.teams.filter(t => t.id !== teamId);
    activeAlarmTeams.delete(teamId);
    
    renderBoard();
    await saveStateToServer();
}

// ➕ 動態新增回報列
async function addReportRow(teamId) {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return;

    if (!team.rows.reports) {
        team.rows.reports = [];
    }

    team.rows.reports.push({ time: '', pressure: '', info: '' });

    renderBoard();
    await saveStateToServer();
}

// 點選「階段」按鈕自動填入當前時間，且點選進入就開始計時、點選撤出就停止計時
async function setRowTimeNow(teamId, rowKey) {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return;

    const timeStr = formatShortTime(new Date());

    if (rowKey === 'entry') {
        if (team.status === 'idle') {
            // 待命狀態時點擊進入，直接觸發「開始進入」流程開始計時
            await startTeamEntry(teamId);
            return;
        } else {
            team.rows.entry.time = timeStr;
        }
    } else if (rowKey === 'exit') {
        if (team.status === 'entered' || team.status === 'alarm') {
            // 熱區工作或警報狀態時點擊撤出，直接觸發「安全撤出」流程停止計時
            await exitTeam(teamId);
            return;
        } else {
            team.rows.exit.time = timeStr;
        }
    } else if (rowKey.startsWith('report_')) {
        const idx = parseInt(rowKey.split('_')[1]);
        if (team.rows.reports && team.rows.reports[idx]) {
            team.rows.reports[idx].time = timeStr;
        }
    }

    renderBoard();
    await saveStateToServer();
}

// 監聽並同步 input 內容 (氣量/備註)
async function updateInputState(teamId, rowKey, field, value) {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return;

    // 定位寫入
    if (rowKey === 'entry') {
        team.rows.entry[field] = value;
    } else if (rowKey === 'exit') {
        team.rows.exit[field] = value;
    } else if (rowKey.startsWith('report_')) {
        const idx = parseInt(rowKey.split('_')[1]);
        if (team.rows.reports && team.rows.reports[idx]) {
            team.rows.reports[idx][field] = value;
        }
    }

    // 儲存至伺服器
    await saveStateToServer();
}

// ==========================================================================
// 8. 新增/修改小組 Modal 控制
// ==========================================================================
function openTeamModal(teamId = null) {
    const modal = document.getElementById('modal-team');
    const form = document.getElementById('form-team');
    form.reset();
    
    // 清除選取的人員標籤
    document.querySelectorAll('.roster-tag').forEach(tag => {
        tag.classList.remove('selected-leader', 'selected-member');
    });

    if (teamId) {
        // 編輯模式
        document.getElementById('modal-team-title').textContent = '修改管制小組';
        const team = state.teams.find(t => t.id === teamId);
        if (team) {
            document.getElementById('team-id').value = team.id;
            document.getElementById('input-team-name').value = team.name;
            document.getElementById('input-mission').value = team.mission || '';
            
            // 帶隊官回填
            if (team.leader) {
                // 嘗試在快速選擇中尋找此人並選取
                const tags = document.querySelectorAll('#roster-leader-select-container .roster-tag');
                let found = false;
                tags.forEach(tag => {
                    if (tag.dataset.name === team.leader) {
                        tag.classList.add('selected-leader');
                        found = true;
                        
                        // 自動展開帶隊官所屬的分隊
                        const groupDiv = tag.closest('.squad-select-members');
                        if (groupDiv) {
                            groupDiv.style.display = 'flex';
                            const arrow = groupDiv.previousElementSibling.querySelector('.arrow');
                            if (arrow) arrow.textContent = '▼';
                        }
                    }
                });
                if (!found) {
                    document.getElementById('input-leader-manual').value = team.leader;
                }
            }

            // 組員回填
            if (team.members && team.members.length > 0) {
                const tags = document.querySelectorAll('#roster-members-select-container .roster-tag');
                let manualMembers = [];
                
                team.members.forEach(member => {
                    let found = false;
                    tags.forEach(tag => {
                        if (tag.dataset.name === member) {
                            tag.classList.add('selected-member');
                            found = true;
                            
                            // 自動展開組員所屬的分隊
                            const groupDiv = tag.closest('.squad-select-members');
                            if (groupDiv) {
                                groupDiv.style.display = 'flex';
                                const arrow = groupDiv.previousElementSibling.querySelector('.arrow');
                                if (arrow) arrow.textContent = '▼';
                            }
                        }
                    });
                    if (!found) {
                        manualMembers.push(member);
                    }
                });
                
                if (manualMembers.length > 0) {
                    document.getElementById('input-members-manual').value = manualMembers.join(', ');
                }
            }
        }
    } else {
        // 新增模式
        document.getElementById('modal-team-title').textContent = '新增管制小組';
        document.getElementById('team-id').value = '';
    }

    modal.classList.add('active');
}

function closeTeamModal() {
    document.getElementById('modal-team').classList.remove('active');
}

// 當點選帶隊官的快速選擇標籤
function selectLeaderTag(tag, name) {
    const parent = tag.parentElement;
    parent.querySelectorAll('.roster-tag').forEach(t => t.classList.remove('selected-leader'));
    
    // 清空手動輸入框，避免混淆
    document.getElementById('input-leader-manual').value = '';
    
    tag.classList.add('selected-leader');
}

// 當點選組員的快速選擇標籤 (複選)
function selectMemberTag(tag, name) {
    tag.classList.toggle('selected-member');
}

function deselectQuickLeader() {
    const tags = document.querySelectorAll('#roster-leader-select-container .roster-tag');
    tags.forEach(t => t.classList.remove('selected-leader'));
}

// 將手動輸入的人員姓名自動存入分隊名單中，以便下次直接點選
function addNameToRosterIfMissing(name) {
    if (!name) return;
    
    // 檢查目前名冊內任何一個分隊是否已存在該姓名
    let exists = false;
    for (const squad in state.roster) {
        if (state.roster[squad].includes(name)) {
            exists = true;
            break;
        }
    }
    
    // 若不存在，自動加到第一個分隊 (通常為苗栗分隊) 裡
    if (!exists) {
        const squads = Object.keys(state.roster);
        const targetSquad = squads.length > 0 ? squads[0] : "苗栗分隊";
        if (!state.roster[targetSquad]) {
            state.roster[targetSquad] = [];
        }
        state.roster[targetSquad].push(name);
        console.log(`自動儲存手動輸入的人員「${name}」至「${targetSquad}」以備下次使用`);
    }
}

// 處理小組表單提交
async function handleTeamFormSubmit(e) {
    e.preventDefault();
    
    const teamId = document.getElementById('team-id').value;
    const name = document.getElementById('input-team-name').value.trim();
    const mission = document.getElementById('input-mission').value.trim();
    
    // 獲取帶隊官
    let leader = '';
    const selectedLeaderTag = document.querySelector('#roster-leader-select-container .roster-tag.selected-leader');
    if (selectedLeaderTag) {
        leader = selectedLeaderTag.dataset.name;
    } else {
        leader = document.getElementById('input-leader-manual').value.trim();
        // 手動輸入帶隊官，自動儲存至名冊
        if (leader) {
            addNameToRosterIfMissing(leader);
        }
    }

    if (!leader) {
        alert('請指派或手動輸入帶隊官！');
        return;
    }

    // 獲取組員名單
    let members = [];
    // 1. 從快速選擇中選取的人員
    const selectedMemberTags = document.querySelectorAll('#roster-members-select-container .roster-tag.selected-member');
    selectedMemberTags.forEach(tag => {
        members.push(tag.dataset.name);
    });
    // 2. 從手動輸入框輸入的人員
    const manualMembersVal = document.getElementById('input-members-manual').value.trim();
    if (manualMembersVal) {
        const items = manualMembersVal.split(/[,，、\s]+/).map(i => i.trim()).filter(i => i);
        // 手動輸入的組員，自動儲存至名冊
        items.forEach(mName => {
            addNameToRosterIfMissing(mName);
        });
        members = [...new Set([...members, ...items])]; // 去除重複
    }

    if (teamId) {
        // 修改小組
        const team = state.teams.find(t => t.id === teamId);
        if (team) {
            team.name = name;
            team.mission = mission;
            team.leader = leader;
            team.members = members;
        }
    } else {
        // 新增小組
        const newTeam = {
            id: 'team_' + Date.now(),
            name: name,
            mission: mission,
            leader: leader,
            members: members,
            status: 'idle',
            entryTimestamp: null,
            exitTimestamp: null,
            acknowledgedIntervals: [],
            rows: {
                entry: { time: '', pressure: '', info: '' },
                reports: [
                    { time: '', pressure: '', info: '' },
                    { time: '', pressure: '', info: '' }
                ],
                exit: { time: '', pressure: '', info: '' }
            }
        };
        state.teams.push(newTeam);
    }

    closeTeamModal();
    renderBoard();
    await saveStateToServer();
}

function editTeam(teamId) {
    openTeamModal(teamId);
}

// 快速選擇人員渲染 (Modal 中使用，以分隊群組並可展開/折疊)
function renderRosterQuickSelects() {
    const leaderContainer = document.getElementById('roster-leader-select-container');
    const membersContainer = document.getElementById('roster-members-select-container');
    
    let leaderHtml = '';
    let membersHtml = '';
    let hasMembers = false;
    
    // 將所有分隊的分開分組渲染，預設為折疊狀態
    for (const squadName in state.roster) {
        const members = state.roster[squadName];
        if (members && members.length > 0) {
            hasMembers = true;
            let squadLeaderHtml = '';
            let squadMemberHtml = '';
            
            members.forEach(name => {
                squadLeaderHtml += `<span class="roster-tag" data-name="${name}" onclick="selectLeaderTag(this, '${name}')">${name}</span>`;
                squadMemberHtml += `<span class="roster-tag" data-name="${name}" onclick="selectMemberTag(this, '${name}')">${name}</span>`;
            });
            
            leaderHtml += `
                <div class="squad-select-group">
                    <div class="squad-select-header" onclick="toggleSquadSelectCollapse(this)">
                        <span>🏢 ${escapeHtml(squadName)}</span>
                        <span class="arrow">▶</span>
                    </div>
                    <div class="squad-select-members" style="display: none;">
                        ${squadLeaderHtml}
                    </div>
                </div>
            `;
            
            membersHtml += `
                <div class="squad-select-group">
                    <div class="squad-select-header" onclick="toggleSquadSelectCollapse(this)">
                        <span>🏢 ${escapeHtml(squadName)}</span>
                        <span class="arrow">▶</span>
                    </div>
                    <div class="squad-select-members" style="display: none;">
                        ${squadMemberHtml}
                    </div>
                </div>
            `;
        }
    }

    if (!hasMembers) {
        leaderHtml = '<span class="text-muted" style="font-size:0.8rem; padding: 5px;">請先在人員管理中加入隊員</span>';
        membersHtml = '<span class="text-muted" style="font-size:0.8rem; padding: 5px;">請先在人員管理中加入隊員</span>';
    }

    leaderContainer.innerHTML = leaderHtml;
    membersContainer.innerHTML = membersHtml;
}

// 切換分隊快速選取面板展開/折疊
function toggleSquadSelectCollapse(header) {
    const membersDiv = header.nextElementSibling;
    const arrow = header.querySelector('.arrow');
    if (membersDiv.style.display === 'none') {
        membersDiv.style.display = 'flex';
        arrow.textContent = '▼';
    } else {
        membersDiv.style.display = 'none';
        arrow.textContent = '▶';
    }
}

// ==========================================================================
// 9. 分隊與人員名單管理邏輯
// ==========================================================================
function openRosterModal() {
    const modal = document.getElementById('modal-roster');
    modal.classList.add('active');
    
    // 預設選擇第一個分隊
    const squadNames = Object.keys(state.roster);
    if (squadNames.length > 0) {
        selectSquad(squadNames[0]);
    } else {
        selectedSquad = null;
        renderRosterManager();
    }
}

function closeRosterModal() {
    document.getElementById('modal-roster').classList.remove('active');
    renderRosterQuickSelects();
}

function selectSquad(squadName) {
    selectedSquad = squadName;
    renderRosterManager();
}

function renderRosterManager() {
    const squadContainer = document.getElementById('squad-list-container');
    const memberContainer = document.getElementById('member-list-container');
    const currentSquadTitle = document.getElementById('current-selected-squad-title');
    const memberForm = document.getElementById('member-form-container');
    
    // 渲染分隊列表
    let squadHtml = '';
    const squads = Object.keys(state.roster);
    
    squads.forEach(sq => {
        const activeClass = sq === selectedSquad ? 'active' : '';
        squadHtml += `
            <li class="squad-item ${activeClass}" onclick="selectSquad('${sq}')">
                <span>🏢 ${escapeHtml(sq)}</span>
                <button class="btn-delete-roster-item" onclick="deleteSquad('${sq}', event)" title="刪除分隊">❌</button>
            </li>
        `;
    });
    
    squadContainer.innerHTML = squadHtml || '<div class="text-muted" style="padding:15px; font-size:0.9rem;">尚無分隊資料</div>';

    // 渲染所屬隊員列表
    if (selectedSquad) {
        currentSquadTitle.textContent = `隊員名單 (🏢 ${selectedSquad})`;
        memberForm.style.display = 'flex';
        
        let memberHtml = '';
        const members = state.roster[selectedSquad] || [];
        
        members.forEach(m => {
            memberHtml += `
                <li class="member-item">
                    <span>👤 ${escapeHtml(m)}</span>
                    <button class="btn-delete-roster-item" onclick="deleteMember('${selectedSquad}', '${m}', event)" title="刪除隊員">❌</button>
                </li>
            `;
        });
        
        memberContainer.innerHTML = memberHtml || '<div class="text-muted" style="padding:15px; font-size:0.9rem;">此分隊目前無成員</div>';
    } else {
        currentSquadTitle.textContent = '隊員名單 (請先選擇/新增分隊)';
        memberForm.style.display = 'none';
        memberContainer.innerHTML = '';
    }
}

// 新增分隊
async function handleAddSquad() {
    const input = document.getElementById('input-squad-name');
    const name = input.value.trim();
    if (!name) return;
    
    if (state.roster[name]) {
        alert('此分隊名稱已存在！');
        return;
    }
    
    state.roster[name] = [];
    input.value = '';
    selectedSquad = name;
    
    renderRosterManager();
    await saveStateToServer();
}

// 刪除分隊
async function deleteSquad(squadName, event) {
    event.stopPropagation();
    if (!confirm(`確定要刪除「${squadName}」分隊以及其底下的所有隊員嗎？`)) return;
    
    delete state.roster[squadName];
    
    const squads = Object.keys(state.roster);
    selectedSquad = squads.length > 0 ? squads[0] : null;
    
    renderRosterManager();
    await saveStateToServer();
}

// 新增隊員
async function handleAddMember() {
    if (!selectedSquad) return;
    
    const input = document.getElementById('input-member-name');
    const name = input.value.trim();
    if (!name) return;
    
    if (!state.roster[selectedSquad]) {
        state.roster[selectedSquad] = [];
    }
    
    if (state.roster[selectedSquad].includes(name)) {
        alert('此姓名在此分隊中已存在！');
        return;
    }
    
    state.roster[selectedSquad].push(name);
    input.value = '';
    
    renderRosterManager();
    await saveStateToServer();
}

// 刪除隊員
async function deleteMember(squadName, memberName, event) {
    event.stopPropagation();
    if (!confirm(`確定要將「${memberName}」從「${squadName}」分隊名單中移除嗎？`)) return;
    
    if (state.roster[squadName]) {
        state.roster[squadName] = state.roster[squadName].filter(m => m !== memberName);
    }
    
    renderRosterManager();
    await saveStateToServer();
}

// ==========================================================================
// 10. QR Code 分享視窗
// ==========================================================================
function openQrModal() {
    document.getElementById('modal-qr').classList.add('active');
}

function closeQrModal() {
    document.getElementById('modal-qr').classList.remove('active');
}

// ==========================================================================
// 11. 通用工具與格式化
// ==========================================================================
function formatShortTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
