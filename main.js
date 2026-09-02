/* ==========================================================================
   1. グローバル状態管理
   ========================================================================== */
const state = {
    orbitMode: 'moonMoves',
    moonAge: 14.8,
    timeHour: 0.0,
    isPlaying: false,
    isPlayingEarth: false,
    speed: 1.0,
    showRays: true,
    currentTab: 'observe',
    viewMode: 'space',
    groundMode: 'overview'
};

/* ==========================================================================
   2. 2D 満ち欠け描画 Engine (Canvas)
   ========================================================================== */
const MoonCanvas = {
    draw: function() {
        const canvas = document.getElementById('moonPhaseCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width; const h = canvas.height;
        const cx = w / 2; const cy = h / 2; const r = 80;

        ctx.clearRect(0, 0, w, h);

        const phaseAngle = (state.moonAge / 29.5) * Math.PI * 2;
        const cosP = Math.cos(phaseAngle);
        const bulgeWidth = Math.abs(cosP) * r;
        const darkColor = '#1e293b';

        const phaseDistance = Math.min(phaseAngle, Math.PI * 2 - phaseAngle);
        const isNewMoon = phaseDistance < 0.000001;

        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = darkColor; ctx.fill();
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.stroke();

        const litGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
        litGrad.addColorStop(0, '#fef08a'); litGrad.addColorStop(1, '#fde047');

        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();

        if (isNewMoon) {
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = darkColor; ctx.fill();
        } else if (state.moonAge > 0 && state.moonAge <= 7.375) {
            ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false); ctx.fillStyle = litGrad; ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx, cy, bulgeWidth, r, 0, -Math.PI / 2, Math.PI / 2, false); ctx.fillStyle = darkColor; ctx.fill();
        } else if (state.moonAge > 7.375 && state.moonAge <= 14.75) {
            ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false); ctx.fillStyle = litGrad; ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx, cy, bulgeWidth, r, 0, -Math.PI / 2, Math.PI / 2, true); ctx.fillStyle = litGrad; ctx.fill();
        } else if (state.moonAge > 14.75 && state.moonAge <= 22.125) {
            ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, true); ctx.fillStyle = litGrad; ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx, cy, bulgeWidth, r, 0, -Math.PI / 2, Math.PI / 2, false); ctx.fillStyle = litGrad; ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, true); ctx.fillStyle = litGrad; ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx, cy, bulgeWidth, r, 0, -Math.PI / 2, Math.PI / 2, true); ctx.fillStyle = darkColor; ctx.fill();
        }

        ctx.fillStyle = 'rgba(161, 161, 170, 0.15)';
        ctx.beginPath();
        ctx.arc(cx - 20, cy - 20, 15, 0, Math.PI * 2); ctx.arc(cx + 25, cy + 10, 22, 0, Math.PI * 2); ctx.arc(cx - 10, cy + 30, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
};

/* ==========================================================================
   3. 方角・時刻・情報表示の計算
   ========================================================================== */
function getCurrentPhaseInfo() {
    const age = state.moonAge;
    for (let phase of MOON_PHASES) {
        if (age >= phase.ageMin && age < phase.ageMax) return phase;
    }
    return MOON_PHASES[0];
}

function getTimeNameHtml(hour) {
    let h = hour % 24;
    if (h >= 4.5 && h < 7.5) return '朝';
    else if (h >= 7.5 && h < 11.5) return '午前';
    else if (h >= 11.5 && h < 13.5) return '昼';
    else if (h >= 13.5 && h < 16.5) return '午後';
    else if (h >= 16.5 && h < 19.5) return '夕方';
    else if (h >= 19.5 && h < 23.5) return '夜';
    else return '夜中';
}

function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    let a = angle % twoPi;
    if (a > Math.PI) a -= twoPi;
    if (a <= -Math.PI) a += twoPi;
    return a;
}

function getMoonHourAngle() {
    const hourAngle = (state.timeHour - 12) * (Math.PI / 12);
    const phaseAngle = (state.moonAge / 29.5) * (Math.PI * 2);
    return normalizeAngle(hourAngle - phaseAngle);
}

function calculateMoonDirectionAndAltitude() {
    const moonHourAngle = getMoonHourAngle();
    const cosAngle = Math.cos(moonHourAngle);

    const phaseAngle = (state.moonAge / 29.5) * (Math.PI * 2);
    const phaseDistance = Math.min(phaseAngle, Math.PI * 2 - phaseAngle);
    const isNewMoon = phaseDistance < 0.000001;

    const aboveHorizon = cosAngle >= -0.000001;
    let direction = "見えません（地平線の下）";
    let altitude = "地平線の下";
    let isVisible = false;

    if (aboveHorizon) {
        if (moonHourAngle < -Math.PI * 0.25) {
            direction = "東の空（のぼってくる）";
            altitude = "低くのぼる";
        } else if (moonHourAngle > Math.PI * 0.25) {
            direction = "西の空（しずみかけ）";
            altitude = "低く見える";
        } else {
            direction = "南の空（高い）";
            altitude = "一番高く見える！";
        }

        if (isNewMoon) {
            direction = "太陽と同じ方向（新月）";
            altitude = "見えません（新月）";
        } else {
            isVisible = true;
        }
    } else if (isNewMoon) {
        direction = "太陽と同じ方向（新月）";
        altitude = "見えません（新月）";
    }

    return { direction, altitude, isVisible, aboveHorizon, isNewMoon, moonHourAngle };
}

function updateSkyBackground() {
    const skyBg = document.getElementById('skyBg');
    const h = state.timeHour % 24;
    
    const baseClasses = "w-48 h-48 md:w-56 md:h-56 rounded-full border-4 border-slate-800 flex items-center justify-center relative shadow-2xl overflow-hidden transition-colors duration-500";
    
    if (h >= 6 && h < 16) {
        skyBg.className = baseClasses + " bg-gradient-to-b from-slate-500 to-slate-600";
    } else if ((h >= 16 && h < 19) || (h >= 4 && h < 6)) {
        skyBg.className = baseClasses + " bg-gradient-to-b from-slate-800 via-stone-700 to-orange-900";
    } else {
        skyBg.className = baseClasses + " bg-slate-950";
    }
}

/* ==========================================================================
   4. UI全更新バインド
   ========================================================================== */
function updateAllViews() {
    document.getElementById('moonAgeVal').innerText = state.moonAge.toFixed(1);
    document.getElementById('orbitDaysDisplay').innerText = state.moonAge.toFixed(1);

    let hours = Math.floor(state.timeHour) % 24;
    let minutesNum = Math.floor((state.timeHour % 1) * 60);
    const mins = minutesNum.toString().padStart(2, '0');
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins}`;
    document.getElementById('timeVal').innerText = timeStr;
    document.getElementById('timeDisplay').innerText = timeStr;
    document.getElementById('timeNameVal').innerHTML = getTimeNameHtml(state.timeHour);

    if (window.ThreeViewer) ThreeViewer.updatePositions();
    MoonCanvas.draw();

    const phase = getCurrentPhaseInfo();
    document.getElementById('phaseBadge').innerText = phase.name;

    const posInfo = calculateMoonDirectionAndAltitude();
    document.getElementById('directionText').innerText = posInfo.direction;
    document.getElementById('altitudeText').innerText = posInfo.altitude;

    document.getElementById('explanationTitle').innerText = `${phase.name} の特徴`;

    const viewingTime = phase.visibleTime;
    document.getElementById('explanationBody').innerHTML = `
        ${phase.explanation}<br>
        <span class="text-amber-300 font-bold mt-1.5 block">💡 見やすい時間：${viewingTime}</span>
    `;

    updateSkyBackground();
}

/* ==========================================================================
   5. イベントハンドラー & 操作関数
   ========================================================================== */
document.getElementById('orbitSlider').addEventListener('input', (e) => {
    state.moonAge = parseFloat(e.target.value);
    if (state.isPlaying) togglePlay();
    updateAllViews();
});

document.getElementById('timeSlider').addEventListener('input', (e) => {
    state.timeHour = parseFloat(e.target.value);
    if (state.isPlayingEarth) togglePlayEarth();
    updateAllViews();
});

function calculateTodayMoonAge(date = new Date()) {
    const referenceNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    const synodicMonth = 29.530588853;
    const elapsedDays = (date.getTime() - referenceNewMoon) / 86400000;
    let moonAge = elapsedDays % synodicMonth;
    if (moonAge < 0) moonAge += synodicMonth;
    return Math.min(29.5, moonAge);
}

function setTodayMoon() {
    const now = new Date();
    const todayMoonAge = calculateTodayMoonAge(now);
    const todayTime = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

    if (state.isPlaying) togglePlay();
    if (state.isPlayingEarth) togglePlayEarth();

    state.moonAge = todayMoonAge;
    state.timeHour = todayTime;

    document.getElementById('orbitSlider').value = todayMoonAge;
    document.getElementById('timeSlider').value = todayTime;
    updateAllViews();
}

function setMoonAge(age) {
    state.moonAge = age;
    document.getElementById('orbitSlider').value = age;
    if (state.isPlaying) togglePlay();
    updateAllViews();
}

function setTimeVal(hour) {
    state.timeHour = hour;
    document.getElementById('timeSlider').value = hour;
    if (state.isPlayingEarth) togglePlayEarth();
    updateAllViews();
}

function togglePlay() {
    state.isPlaying = !state.isPlaying;
    
    [ {b: 'playBtn', i: 'playIcon', t: 'playText'},
      {b: 'fsPlayBtn', i: 'fsPlayIcon', t: 'fsPlayText'} ].forEach(ids => {
        const btn = document.getElementById(ids.b);
        const icon = document.getElementById(ids.i);
        const text = document.getElementById(ids.t);
        
        if(btn && icon && text) {
            if (state.isPlaying) {
                btn.classList.remove('bg-amber-400', 'hover:bg-amber-300', 'text-slate-950');
                btn.classList.add('bg-rose-500', 'hover:bg-rose-400', 'text-white');
                icon.className = "fa-solid fa-pause";
                text.innerHTML = "公転を一時停止";
            } else {
                btn.classList.remove('bg-rose-500', 'hover:bg-rose-400', 'text-white');
                btn.classList.add('bg-amber-400', 'hover:bg-amber-300', 'text-slate-950');
                icon.className = "fa-solid fa-play";
                text.innerHTML = "月を公転";
            }
        }
    });
}

function togglePlayEarth() {
    state.isPlayingEarth = !state.isPlayingEarth;
    
    [ {b: 'playEarthBtn', i: 'playEarthIcon', t: 'playEarthText'},
      {b: 'fsPlayEarthBtn', i: 'fsPlayEarthIcon', t: 'fsPlayEarthText'} ].forEach(ids => {
        const btn = document.getElementById(ids.b);
        const icon = document.getElementById(ids.i);
        const text = document.getElementById(ids.t);
        
        if(btn && icon && text) {
            if (state.isPlayingEarth) {
                btn.classList.remove('bg-emerald-400', 'hover:bg-emerald-300', 'text-slate-950');
                btn.classList.add('bg-rose-500', 'hover:bg-rose-400', 'text-white');
                icon.className = "fa-solid fa-pause";
                text.innerHTML = "自転を一時停止";
            } else {
                btn.classList.remove('bg-rose-500', 'hover:bg-rose-400', 'text-white');
                btn.classList.add('bg-emerald-400', 'hover:bg-emerald-300', 'text-slate-950');
                icon.className = "fa-solid fa-play";
                text.innerHTML = "地球を自転";
            }
        }
    });
}

function setSpeed(spd) {
    state.speed = spd;
    ['025', '05', '10', '20'].forEach(id => {
        const el1 = document.getElementById(`speed-${id}`);
        const el2 = document.getElementById(`fs-speed-${id}`);
        const defaultClass = "px-2 py-1 rounded transition text-slate-400 hover:text-white";
        if (el1) el1.className = defaultClass;
        if (el2) el2.className = defaultClass;
    });
    const activeId = spd === 0.25 ? '025' : spd === 0.5 ? '05' : spd === 1.0 ? '10' : '20';
    const activeClass = "px-2 py-1 rounded transition bg-slate-800 text-amber-300 font-bold";
    const activeEl1 = document.getElementById(`speed-${activeId}`);
    const activeEl2 = document.getElementById(`fs-speed-${activeId}`);
    if (activeEl1) activeEl1.className = activeClass;
    if (activeEl2) activeEl2.className = activeClass;
}

function switchTab(tab) {
    state.currentTab = tab;
    ['observe', 'gallery', 'quiz'].forEach(t => {
        const view = document.getElementById(`view-${t}`); const btn = document.getElementById(`tab-${t}`);
        if (t === tab) { view.classList.remove('hidden'); view.classList.add('flex'); btn.classList.add('active'); } 
        else { view.classList.add('hidden'); view.classList.remove('flex'); btn.classList.remove('active'); }
    });
    if (tab === 'observe' && window.ThreeViewer) setTimeout(ThreeViewer.onWindowResize, 100);
}

function setOrbitMode(mode) {
    if (state.orbitMode === mode) return; 
    
    const prevMode = state.orbitMode;
    state.orbitMode = mode;
    
    const moonAngle = (state.moonAge / 29.5) * Math.PI * 2;
    if (window.ThreeViewer) {
        if (prevMode === 'moonMoves' && mode === 'sunMoves') {
            ThreeViewer.shiftCameraAngle(moonAngle);
        } else if (prevMode === 'sunMoves' && mode === 'moonMoves') {
            ThreeViewer.shiftCameraAngle(-moonAngle);
        }
    }

    const btnMoon = document.getElementById('btnOrbitMoon');
    const btnSun = document.getElementById('btnOrbitSun');
    const btnRays = document.getElementById('btnRays');

    const activeClass = "px-5 py-2 rounded-lg bg-slate-700 text-white font-bold transition shadow";
    const activeClassAmber = "px-5 py-2 rounded-lg bg-amber-600 text-white font-bold transition shadow";
    const inactiveClass = "px-5 py-2 rounded-lg text-slate-400 hover:text-white transition";

    if (mode === 'moonMoves') {
        btnMoon.className = activeClass;
        btnSun.className = inactiveClass;
        if (window.ThreeViewer) ThreeViewer.setSunRaysVisible(state.showRays);
        if (btnRays) {
            btnRays.style.opacity = "1";
            btnRays.style.pointerEvents = "auto";
        }
    } else {
        btnMoon.className = inactiveClass;
        btnSun.className = activeClassAmber;
        if (window.ThreeViewer) ThreeViewer.setSunRaysVisible(false);
        if (btnRays) {
            btnRays.style.opacity = "0.4";
            btnRays.style.pointerEvents = "none";
        }
    }
    updateAllViews();
}

/* ==========================================================================
   6. 各種管理マネージャー群
   ========================================================================== */
const GalleryManager = {
    render: function() {
        const grid = document.getElementById('galleryGrid');
        grid.innerHTML = '';
        MOON_PHASES.forEach((phase) => {
            const card = document.createElement('div');
            card.className = "bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-400/50 transition duration-300 shadow-lg group cursor-pointer";
            card.onclick = () => { 
                setMoonAge((phase.ageMin + phase.ageMax) / 2); 
                switchTab('observe'); 
            };
            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-3xl">${phase.quizIcon}</span>
                        <span class="bg-slate-900 border border-slate-700 text-xs px-2.5 py-1 rounded text-amber-300 font-bold">月齢 ${(phase.ageMin).toFixed(1)}〜</span>
                    </div>
                    <h3 class="font-black text-base text-amber-300 group-hover:text-amber-200 transition">${phase.name}</h3>
                    <p class="text-xs text-slate-400 mb-2">（別名: ${phase.alias}）</p>
                    <p class="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">${phase.explanation}</p>
                </div>
                <div class="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs sm:text-sm text-emerald-400 font-bold">
                    <span><i class="fa-solid fa-clock"></i> ${phase.visibleTime}</span>
                    <span class="text-amber-400 group-hover:translate-x-1 transition">観察する <i class="fa-solid fa-chevron-right"></i></span>
                </div>`;
            grid.appendChild(card);
        });
    }
};

const QuizManager = {
    currentIdx: 0,
    score: 0,
    answered: false,

    start: function() {
        this.currentIdx = 0; 
        this.score = 0;
        document.getElementById('quizScoreDisplay').innerText = '0';
        document.getElementById('quizContainer').classList.remove('hidden');
        document.getElementById('quizComplete').classList.add('hidden');
        this.showQuestion();
    },

    showQuestion: function() {
        this.answered = false; 
        const q = QUIZ_QUESTIONS[this.currentIdx];
        document.getElementById('quizQuestionNum').innerText = `第 ${this.currentIdx + 1} 問 / 全 5 問`;
        document.getElementById('quizQuestionText').innerText = q.q;
        document.getElementById('quizFeedback').classList.add('hidden');
        
        const optionsContainer = document.getElementById('quizOptions');
        optionsContainer.innerHTML = '';
        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = "bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left p-3.5 rounded-xl font-bold text-xs sm:text-sm text-slate-200 transition flex items-center justify-between shadow";
            btn.onclick = () => this.selectAnswer(idx);
            btn.innerHTML = `<span>${idx + 1}. ${opt}</span><i class="fa-regular fa-circle text-slate-600"></i>`;
            optionsContainer.appendChild(btn);
        });
    },

    selectAnswer: function(selectedIdx) {
        if (this.answered) return;
        this.answered = true; 
        const q = QUIZ_QUESTIONS[this.currentIdx]; 
        const isCorrect = (selectedIdx === q.correct);
        
        if (isCorrect) {
            this.score++;
            document.getElementById('quizScoreDisplay').innerText = this.score;
        }
        
        const feedback = document.getElementById('quizFeedback');
        const resultHeader = document.getElementById('feedbackResult');
        feedback.classList.remove('hidden');
        
        if (isCorrect) {
            resultHeader.className = "font-black text-lg text-emerald-400 flex items-center gap-2";
            resultHeader.innerHTML = `<i class="fa-solid fa-circle-check"></i> 大正解！すごい！`;
        } else {
            resultHeader.className = "font-black text-lg text-rose-400 flex items-center gap-2";
            resultHeader.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> おしい！ざんねん！`;
        }
        document.getElementById('feedbackText').innerText = q.exp;

        Array.from(document.getElementById('quizOptions').children).forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === q.correct) btn.className = "bg-emerald-950/80 border-2 border-emerald-500 text-left p-3.5 rounded-xl font-bold text-xs sm:text-sm text-emerald-300 flex items-center justify-between shadow";
            else if (idx === selectedIdx && !isCorrect) btn.className = "bg-rose-950/80 border-2 border-rose-500 text-left p-3.5 rounded-xl font-bold text-xs sm:text-sm text-rose-300 flex items-center justify-between shadow";
            else btn.className = "opacity-40 bg-slate-950 border border-slate-800 text-left p-3.5 rounded-xl font-bold text-xs sm:text-sm text-slate-400 flex items-center justify-between";
        });
    },

    next: function() {
        this.currentIdx++;
        if (this.currentIdx < QUIZ_QUESTIONS.length) {
            this.showQuestion();
        } else {
            document.getElementById('quizContainer').classList.add('hidden');
            
            const resultMsg = document.getElementById('quizResultMessage');
            if (this.score === 5) {
                resultMsg.innerText = "全問正解！パーフェクト！";
            } else if (this.score >= 3) {
                resultMsg.innerText = "クリア！よくがんばったね！";
            } else {
                resultMsg.innerText = "もういちど復習してみよう！";
            }

            document.getElementById('quizComplete').classList.remove('hidden');
            document.getElementById('quizComplete').classList.add('flex');
            document.getElementById('finalScore').innerText = this.score;
        }
    }
};

const FullscreenManager = {
    activeElementId: null,
    scrollY: 0,
    previousActiveElement: null,
    resizeObserver: null,

    lockBodyScroll: function() {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = scrollbarWidth + 'px';
        }
        document.body.classList.add('fullscreen-active');
    },

    unlockBodyScroll: function() {
        document.body.classList.remove('fullscreen-active');
        document.body.style.paddingRight = '';
    },

    updateButton: function(btn, isFull) {
        if (!btn) return;
        btn.innerHTML = isFull
            ? '<i class="fa-solid fa-compress"></i> 元に戻す'
            : '<i class="fa-solid fa-expand"></i> 全画面表示';

        btn.classList.toggle('bg-slate-900', !isFull);
        btn.classList.toggle('border-slate-700', !isFull);
        btn.classList.toggle('bg-rose-900', isFull);
        btn.classList.toggle('border-rose-700', isFull);
    },

    syncUi: function(elementId, isFull, sourceButton = null) {
        document.querySelectorAll(`[data-fullscreen-button="${elementId}"]`).forEach(btn => {
            this.updateButton(btn, isFull);
        });

        const moonControls = document.getElementById('moonFullscreenControls');
        if (elementId === 'viewer-moon' && moonControls) {
            moonControls.classList.toggle('hidden', !isFull);
            moonControls.classList.toggle('flex', isFull);
        }
    },

    toggle: function(elementId, btnElement = null) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const isCurrentlyFull = el.classList.contains('custom-fullscreen');

        if (!isCurrentlyFull && this.activeElementId && this.activeElementId !== elementId) {
            this.exit(this.activeElementId);
        }

        if (isCurrentlyFull) {
            this.exit(elementId);
            return;
        }

        this.activeElementId = elementId;
        this.scrollY = window.scrollY;
        this.previousActiveElement = document.activeElement;

        this.lockBodyScroll();
        el.classList.add('custom-fullscreen');
        el.dataset.wasFullscreen = 'true';

        this.syncUi(elementId, true, btnElement);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (window.ThreeViewer) ThreeViewer.onWindowResize();
            });
        });
    },

    exit: function(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        el.classList.remove('custom-fullscreen');
        delete el.dataset.wasFullscreen;
        this.syncUi(elementId, false);

        if (this.activeElementId === elementId) {
            this.activeElementId = null;
            this.unlockBodyScroll();

            requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (window.ThreeViewer) ThreeViewer.onWindowResize();
                window.scrollTo(0, this.scrollY);
                    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
                        try { this.previousActiveElement.focus({ preventScroll: true }); } catch (_) {}
                    }
                    this.previousActiveElement = null;
                });
            });
        } else {
            if (window.ThreeViewer) ThreeViewer.onWindowResize();
        }
    },

    initObserver: function() {
        if (!window.ResizeObserver) return;
        const container = document.getElementById('canvas3d-container');
        if (!container) return;
        this.resizeObserver = new ResizeObserver(() => {
            if (window.ThreeViewer) ThreeViewer.onWindowResize();
        });
        this.resizeObserver.observe(container);
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeElementId) {
                this.exit(this.activeElementId);
            }
        });
    }
};

/* ==========================================================================
   8. イベント一括登録 (EventBinder)
   ========================================================================== */
const EventBinder = {
    init: function() {
        // 主要なボタンのイベントをJS側で一括登録
        const bindings = {
            // --- 既存の登録 ---
            'todayMoonBtn': setTodayMoon,
            'tab-observe': () => switchTab('observe'),
            'tab-gallery': () => switchTab('gallery'),
            'tab-quiz': () => switchTab('quiz'),
            'btnViewSpace': () => ThreeViewer.setViewMode('space'),
            'btnViewGround': () => ThreeViewer.setViewMode('ground'),
            'btnGroundFP': () => ThreeViewer.setGroundMode('firstPerson'),
            'btnGroundOV': () => ThreeViewer.setGroundMode('overview'),
            'btnRays': ThreeViewer.toggleSunRays,
            'playBtn': togglePlay,
            'fsPlayBtn': togglePlay,
            'playEarthBtn': togglePlayEarth,
            'fsPlayEarthBtn': togglePlayEarth,
            'speed-025': () => setSpeed(0.25),
            'speed-05': () => setSpeed(0.5),
            'speed-10': () => setSpeed(1.0),
            'speed-20': () => setSpeed(2.0),
            'fs-speed-025': () => setSpeed(0.25),
            'fs-speed-05': () => setSpeed(0.5),
            'fs-speed-10': () => setSpeed(1.0),
            'fs-speed-20': () => setSpeed(2.0),
            'btnOrbitMoon': () => setOrbitMode('moonMoves'),
            'btnOrbitSun': () => setOrbitMode('sunMoves'),
            'nextQuizBtn': () => QuizManager.next(),

            // --- 新しく追加したIDの登録 ---
            // 宇宙視点プリセット
            'btnPresetSunLeft': () => ThreeViewer.setPresetView('sun-left'),
            'btnPresetSunRight': () => ThreeViewer.setPresetView('sun-right'),
            'btnPresetTopLeft': () => ThreeViewer.setPresetView('top-left'),
            'btnPresetTopRight': () => ThreeViewer.setPresetView('top-right'),
            'btnResetCamera': ThreeViewer.resetCamera,

            // 観測者視点プリセット
            'btnGroundSouth': () => ThreeViewer.setGroundPreset('south'),
            'btnGroundEast': () => ThreeViewer.setGroundPreset('east'),
            'btnGroundWest': () => ThreeViewer.setGroundPreset('west'),
            'btnGroundZenith': () => ThreeViewer.setGroundPreset('zenith'),

            // ズーム操作
            'btnZoomIn': () => ThreeViewer.zoomCamera(-10),
            'btnZoomOut': () => ThreeViewer.zoomCamera(10),

            // 月齢指定
            'btnAge0': () => setMoonAge(0),
            'btnAge7': () => setMoonAge(7.4),
            'btnAge14': () => setMoonAge(14.8),
            'btnAge22': () => setMoonAge(22.1),
            'btnAge29': () => setMoonAge(29.5),

            // 時刻指定
            'btnTime0': () => setTimeVal(0),
            'btnTime6': () => setTimeVal(6),
            'btnTime12': () => setTimeVal(12),
            'btnTime18': () => setTimeVal(18),
            'btnTime24': () => setTimeVal(24),

            // クイズリトライ
            'retryQuizBtn': () => QuizManager.start()
        };

        // bindingsに登録されたIDと関数をすべてaddEventListenerで紐付け
        for (const [id, func] of Object.entries(bindings)) {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', func);
                el.removeAttribute('onclick');
            }
        }

        // 全画面表示ボタンを自動で紐付ける
        document.querySelectorAll('[data-fullscreen-button]').forEach(btn => {
            btn.addEventListener('click', function() {
                const targetId = this.getAttribute('data-fullscreen-button');
                FullscreenManager.toggle(targetId, this);
            });
            btn.removeAttribute('onclick');
        });
    }
};

/* ==========================================================================
   9. アプリ初期化
   ========================================================================== */
window.onload = function() {
    if (window.ThreeViewer) ThreeViewer.init();
    FullscreenManager.initObserver();
    GalleryManager.render();
    QuizManager.start();
    EventBinder.init(); // ★ここを追加
    updateAllViews();
};