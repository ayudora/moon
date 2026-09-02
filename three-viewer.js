window.ThreeViewer = (function() {
    /* ==========================================================================
       1. カプセル化された変数（外部からは直接見えない・触れない）
       ========================================================================== */
    let scene, camera, renderer;
    let universeGroup, groundGroup;
    let sunMesh, earthGroup, earthMesh, moonMesh, moonOrbitLine, sunRaysGroup, observerMarker;
    let gSunMesh, gMoonMesh, gSunLight, skyMat, gStars, groundPlateMesh;
    let labelN, labelS, labelE, labelW, labelZenith;
    let uSunLight;
    
    let isDragging3D = false;
    let previousMousePosition = { x: 0, y: 0 };

    let camTheta = Math.PI / 2;
    let camElevation = 0.55;
    let camRadius = 55;
    let targetCamTheta = Math.PI / 2;
    let targetCamElevation = 0.55;
    let targetCamRadius = 55;

    let gCamYaw = 0;
    let gCamPitch = 0.4;
    let targetGCamYaw = 0;
    let targetGCamPitch = 0.4;

    let camFov = 80;
    let targetCamFov = 80;
    let isAnimatingToPreset = false;

    /* ==========================================================================
       2. 内部の処理関数群（従来通りの処理）
       ========================================================================== */
    function init3D() {
        const container = document.getElementById('canvas3d-container');
        const width = container.clientWidth;
        const height = container.clientHeight || 320;

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        applyCameraTransform();

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);

        universeGroup = new THREE.Group();
        scene.add(universeGroup);

        groundGroup = new THREE.Group();
        scene.add(groundGroup);
        groundGroup.visible = false;

        const sunGeo = new THREE.SphereGeometry(4, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xff8c00 });
        sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.position.set(-30, 0, 0);
        universeGroup.add(sunMesh);

        uSunLight = new THREE.DirectionalLight(0xffffff, 1.8);
        uSunLight.position.set(-30, 0, 0);
        uSunLight.target.position.set(0, 0, 0);
        universeGroup.add(uSunLight);
        universeGroup.add(uSunLight.target);

        const ambientLight = new THREE.AmbientLight(0x222233, 0.3);
        universeGroup.add(ambientLight);

        sunRaysGroup = new THREE.Group();
        for (let z = -12; z <= 12; z += 6) {
            const rayGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-28, 0, z),
                new THREE.Vector3(20, 0, z)
            ]);
            const rayMat = new THREE.LineDashedMaterial({ color: 0xffe066, dashSize: 1, gapSize: 0.5, opacity: 0.4, transparent: true });
            const rayLine = new THREE.Line(rayGeo, rayMat);
            rayLine.computeLineDistances();
            sunRaysGroup.add(rayLine);
        }
        universeGroup.add(sunRaysGroup);

        earthGroup = new THREE.Group();
        const earthCanvas = document.createElement('canvas');
        earthCanvas.width = 512; earthCanvas.height = 256;
        const eCtx = earthCanvas.getContext('2d');
        eCtx.fillStyle = '#2563eb'; eCtx.fillRect(0, 0, 512, 256);
        eCtx.fillStyle = '#16a34a';
        [{x: 100, y: 100, rx: 60, ry: 35}, {x: 170, y: 130, rx: 35, ry: 25}, {x: 320, y: 100, rx: 50, ry: 40}, {x: 340, y: 180, rx: 30, ry: 45}, {x: 220, y: 170, rx: 35, ry: 35}, {x: 440, y: 160, rx: 40, ry: 25}].forEach(c => {
            eCtx.beginPath(); eCtx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2); eCtx.fill();
        });
        eCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; eCtx.lineWidth = 2;
        for (let x = 0; x <= 512; x += 64) {
            eCtx.beginPath(); eCtx.moveTo(x, 0); eCtx.lineTo(x, 256); eCtx.stroke();
        }
        const earthTexture = new THREE.CanvasTexture(earthCanvas);
        const earthGeo = new THREE.SphereGeometry(3.2, 32, 32);
        const earthMat = new THREE.MeshPhongMaterial({ map: earthTexture, specular: 0x111111, shininess: 10 });
        earthMesh = new THREE.Mesh(earthGeo, earthMat);
        earthGroup.add(earthMesh);

        const axisGeo = new THREE.CylinderGeometry(0.06, 0.06, 9, 8);
        const axisMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
        const axisMesh = new THREE.Mesh(axisGeo, axisMat);
        earthGroup.add(axisMesh);

        const obsGroup = new THREE.Group();
        const pinMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const obsBodyGeo = new THREE.ConeGeometry(0.38, 1.1, 24);
        const obsMesh = new THREE.Mesh(obsBodyGeo, pinMat);
        obsMesh.position.y = 0.55;
        obsGroup.add(obsMesh);
        const headGeo = new THREE.SphereGeometry(0.32, 24, 24);
        const headMesh = new THREE.Mesh(headGeo, pinMat);
        headMesh.position.y = 1.25;
        obsGroup.add(headMesh);
        const lat = 35 * (Math.PI / 180);
        obsGroup.position.set(-3.2 * Math.cos(lat), 3.2 * Math.sin(lat), 0);
        obsGroup.rotation.z = (Math.PI / 2) - lat;
        observerMarker = obsGroup;
        earthGroup.add(observerMarker);
        universeGroup.add(earthGroup);

        const orbitRadius = 14;
        const orbitGeo = new THREE.RingGeometry(orbitRadius - 0.1, orbitRadius + 0.1, 64);
        const orbitMat = new THREE.MeshBasicMaterial({ color: 0x475569, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
        moonOrbitLine = new THREE.Mesh(orbitGeo, orbitMat);
        moonOrbitLine.rotation.x = Math.PI / 2;
        universeGroup.add(moonOrbitLine);

        const moonGeo = new THREE.SphereGeometry(1.2, 32, 32);
        const moonMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, emissive: 0x111111, shininess: 5 });
        moonMesh = new THREE.Mesh(moonGeo, moonMat);
        universeGroup.add(moonMesh);

        const gAmbient = new THREE.AmbientLight(0x222233, 0.3);
        groundGroup.add(gAmbient);

        gSunLight = new THREE.DirectionalLight(0xfff5ed, 2.2);
        groundGroup.add(gSunLight);
        groundGroup.add(gSunLight.target);

        const skyGeo = new THREE.SphereGeometry(200, 32, 32);
        skyMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.BackSide });
        const skyDome = new THREE.Mesh(skyGeo, skyMat);
        groundGroup.add(skyDome);

        const groundPlateGeo = new THREE.CylinderGeometry(200, 200, 1, 32);
        const groundPlateMat = new THREE.MeshBasicMaterial({ color: 0x064e3b });
        groundPlateMesh = new THREE.Mesh(groundPlateGeo, groundPlateMat);
        groundPlateMesh.position.y = -0.5;
        groundGroup.add(groundPlateMesh);

        const gSunGeo = new THREE.SphereGeometry(2.5, 32, 32);
        const gSunMatBody = new THREE.MeshBasicMaterial({ color: 0xff8c00 });
        gSunMesh = new THREE.Mesh(gSunGeo, gSunMatBody);
        groundGroup.add(gSunMesh);

        const gMoonGeo = new THREE.SphereGeometry(2.5, 32, 32);
        const gMoonMatBody = new THREE.MeshPhongMaterial({ color: 0xdddddd, emissive: 0x111111, shininess: 5 });
        gMoonMesh = new THREE.Mesh(gMoonGeo, gMoonMatBody);
        groundGroup.add(gMoonMesh);

        function createLabelSprite(text, bgColor, textColor, borderColor) {
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 80;
            const ctx = canvas.getContext('2d');
            
            const x = 12, y = 12, w = 232, h = 56, r = 16;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            
            ctx.fillStyle = bgColor;
            ctx.fill();
            
            ctx.lineWidth = 4;
            ctx.strokeStyle = borderColor;
            ctx.stroke();
            
            ctx.fillStyle = textColor;
            ctx.font = 'bold 30px "M PLUS Rounded 1c", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 128, 40 + 2);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(22.5, 7.03125, 1);
            sprite.renderOrder = 10;
            return sprite;
        }
        
        labelS = createLabelSprite('南(正面)', 'rgba(15, 23, 42, 0.8)', '#fde047', 'rgba(253, 224, 71, 0.4)'); 
        labelS.position.set(0, 2, -54); 
        labelS.scale.set(29.25, 9.14, 1);
        groundGroup.add(labelS);

        labelE = createLabelSprite('東(昇る)', 'rgba(15, 23, 42, 0.8)', '#93c5fd', 'rgba(147, 197, 253, 0.4)'); labelE.position.set(-54, 2, 0); groundGroup.add(labelE);
        labelW = createLabelSprite('西(沈む)', 'rgba(15, 23, 42, 0.8)', '#fca5a5', 'rgba(252, 165, 165, 0.4)'); labelW.position.set(54, 2, 0); groundGroup.add(labelW);
        labelN = createLabelSprite('北(背後)', 'rgba(15, 23, 42, 0.8)', '#d1d5db', 'rgba(209, 213, 219, 0.4)'); labelN.position.set(0, 2, 54); groundGroup.add(labelN);
        
        labelZenith = createLabelSprite('天頂(真上)', 'rgba(15, 23, 42, 0.8)', '#c084fc', 'rgba(192, 132, 252, 0.4)'); labelZenith.position.set(0, 48, -10); groundGroup.add(labelZenith);
        labelZenith.visible = false;

        const R_ORBIT = 50;
        const orbitPoints = [];
        for(let i=0; i<=60; i++){
            const ang = (i/60) * Math.PI * 2;
            const x = R_ORBIT * Math.sin(ang);
            const y = R_ORBIT * Math.cos(ang) * Math.sin(55 * Math.PI / 180);
            const z = -R_ORBIT * Math.cos(ang) * Math.cos(55 * Math.PI / 180);
            if(y >= -5) orbitPoints.push(new THREE.Vector3(x, y, z));
        }
        const orbGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
        const trackLine = new THREE.Line(orbGeo, orbMat);
        groundGroup.add(trackLine);

        const starsGeo = new THREE.BufferGeometry();
        const starsPos = [];
        for (let i = 0; i < 600; i++) {
            const x = (Math.random() - 0.5) * 380;
            const y = (Math.random() - 0.5) * 380;
            const z = (Math.random() - 0.5) * 380;
            if (Math.sqrt(x*x + y*y + z*z) > 100) starsPos.push(x, y, z);
        }
        starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starsPos, 3));
        const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0 });
        gStars = new THREE.Points(starsGeo, starsMat);
        groundGroup.add(gStars);

        const dom = renderer.domElement;
        
        dom.addEventListener('mousedown', (e) => {
            isDragging3D = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        window.addEventListener('mouseup', () => isDragging3D = false);
        window.addEventListener('mousemove', (e) => {
            if (!isDragging3D) return;
            handleCameraDrag(e.clientX - previousMousePosition.x, e.clientY - previousMousePosition.y);
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        dom.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging3D = true;
                previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        });
        window.addEventListener('touchend', () => isDragging3D = false);
        window.addEventListener('touchmove', (e) => {
            if (!isDragging3D || e.touches.length !== 1) return;
            handleCameraDrag(e.touches[0].clientX - previousMousePosition.x, e.touches[0].clientY - previousMousePosition.y);
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        });

        dom.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (state.viewMode === 'space') {
                camRadius = Math.max(15, Math.min(85, camRadius + e.deltaY * 0.03));
                targetCamRadius = camRadius;
            }
        }, { passive: false });

        document.getElementById('loadingOverlay').classList.add('hidden');
        window.addEventListener('resize', onWindowResize);
        animate3D();
    }

    function handleCameraDrag(deltaX, deltaY) {
        isAnimatingToPreset = false;
        
        if (state.viewMode === 'space') {
            camTheta -= deltaX * 0.008;
            camElevation = Math.max(-1.3, Math.min(1.48, camElevation + deltaY * 0.008));
            targetCamTheta = camTheta;
            targetCamElevation = camElevation;
            targetCamRadius = camRadius;
        } else if (state.viewMode === 'ground') {
            if (state.groundMode === 'firstPerson') {
                gCamYaw -= deltaX * 0.005;
                gCamPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, gCamPitch - deltaY * 0.005));
                targetGCamYaw = gCamYaw;
                targetGCamPitch = gCamPitch;
            }
        }
    }

    function zoomCamera(delta) {
        if (state.viewMode === 'space') {
            targetCamRadius = Math.max(15, Math.min(85, targetCamRadius + delta));
            isAnimatingToPreset = true;
        } else if (state.viewMode === 'ground' && state.groundMode === 'firstPerson') {
            targetCamFov = Math.max(30, Math.min(120, targetCamFov + delta * 0.8));
            isAnimatingToPreset = true;
        }
    }

    function applyCameraTransform() {
        if (state.viewMode === 'space') {
            if (camera.fov !== 45) { camera.fov = 45; camera.updateProjectionMatrix(); }
            if (isAnimatingToPreset) {
                camTheta += (targetCamTheta - camTheta) * 0.18;
                camElevation += (targetCamElevation - camElevation) * 0.18;
                camRadius += (targetCamRadius - camRadius) * 0.18;
                if (Math.abs(targetCamTheta - camTheta) < 0.001 && Math.abs(targetCamElevation - camElevation) < 0.001 && Math.abs(targetCamRadius - camRadius) < 0.01) {
                    isAnimatingToPreset = false;
                }
            }
            const cosElev = Math.cos(camElevation);
            camera.position.x = camRadius * cosElev * Math.cos(camTheta);
            camera.position.z = camRadius * cosElev * Math.sin(camTheta);
            camera.position.y = camRadius * Math.sin(camElevation);
            camera.lookAt(0, 0, 0);

        } else if (state.viewMode === 'ground') {
            if (state.groundMode === 'overview') {
                if (camera.fov !== 25) { camera.fov = 25; camera.updateProjectionMatrix(); }
                
                const reqWidth = 120;
                const reqHeight = 55;
                const fovRad = THREE.MathUtils.degToRad(25 / 2);
                
                let targetZ = reqWidth / (2 * camera.aspect * Math.tan(fovRad));
                const minZHeight = reqHeight / (2 * Math.tan(fovRad));
                
                targetZ = Math.max(targetZ, minZHeight);
                
                camera.position.set(0, 6, targetZ);
                camera.lookAt(0, 18, 0); 
            } else {
                if (isAnimatingToPreset) {
                    camFov += (targetCamFov - camFov) * 0.18;
                    camera.fov = camFov;
                    camera.updateProjectionMatrix();

                    gCamYaw += (targetGCamYaw - gCamYaw) * 0.18;
                    gCamPitch += (targetGCamPitch - gCamPitch) * 0.18;
                    
                    if (Math.abs(targetGCamYaw - gCamYaw) < 0.001 && Math.abs(targetGCamPitch - gCamPitch) < 0.001 && Math.abs(targetCamFov - camFov) < 0.1) {
                        isAnimatingToPreset = false;
                    }
                }
                camera.position.set(0, 1.5, 0);
                const dirX = -Math.sin(gCamYaw) * Math.cos(gCamPitch);
                const dirY = Math.sin(gCamPitch);
                const dirZ = -Math.cos(gCamYaw) * Math.cos(gCamPitch);
                camera.lookAt(camera.position.x + dirX, camera.position.y + dirY, camera.position.z + dirZ);
            }
        }
    }

function setViewMode(mode) {
        state.viewMode = mode;
        const btnSpace = document.getElementById('btnViewSpace');
        const btnGround = document.getElementById('btnViewGround');
        const presetSpace = document.getElementById('presetSpace');
        const hintLabel = document.getElementById('dragHintLabel');
        const subModeToggle = document.getElementById('groundSubModeToggle');
        const presetGround = document.getElementById('presetGround');

        if (mode === 'space') {
            btnSpace.className = "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition bg-indigo-600 text-white flex items-center gap-1.5 shadow";
            btnGround.className = "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition text-slate-400 hover:text-white flex items-center gap-1.5 hover:bg-slate-800";
            
            universeGroup.visible = true;
            groundGroup.visible = false;
            
            presetSpace.classList.remove('hidden'); presetSpace.classList.add('flex');
            subModeToggle.classList.add('hidden'); subModeToggle.classList.remove('flex');
            presetGround.classList.add('hidden'); presetGround.classList.remove('flex');
            
            hintLabel.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right text-indigo-400 text-sm"></i><span class="text-xs sm:text-sm font-bold text-slate-200">見回す</span>';
            hintLabel.style.display = 'flex';
            const zoomControls = document.getElementById('zoomControls');
            if (zoomControls) { zoomControls.classList.remove('hidden'); zoomControls.classList.add('flex'); }

            targetCamTheta = Math.PI / 2;
            targetCamElevation = 0.55;
            targetCamRadius = 55;
            isAnimatingToPreset = true;
            
        } else {
            btnSpace.className = "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition text-slate-400 hover:text-white flex items-center gap-1.5 hover:bg-slate-800";
            btnGround.className = "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition bg-emerald-600 text-white flex items-center gap-1.5 shadow";
            
            universeGroup.visible = false;
            groundGroup.visible = true;

            presetSpace.classList.add('hidden'); presetSpace.classList.remove('flex');
            subModeToggle.classList.remove('hidden'); subModeToggle.classList.add('flex');
            
            setGroundMode(state.groundMode === 'overview' ? 'overview' : 'firstPerson');
            
            const moonAngle = (state.moonAge / 29.5) * Math.PI * 2;
            const timeAngle = ((state.timeHour - 12) / 24) * Math.PI * 2;
            let diff = (moonAngle - timeAngle) % (Math.PI * 2);
            if (diff > Math.PI) diff -= Math.PI * 2;
            if (diff < -Math.PI) diff += Math.PI * 2;
            
            targetGCamYaw = diff; 
            targetGCamPitch = 0.4;  //見上げる角度
            isAnimatingToPreset = true;
        }
        updateAllViews();
    }

    function setGroundMode(mode) {
        state.groundMode = mode;
        const btnFP = document.getElementById('btnGroundFP');
        const btnOV = document.getElementById('btnGroundOV');
        const presetGround = document.getElementById('presetGround');
        const hintLabel = document.getElementById('dragHintLabel');
        const zoomControls = document.getElementById('zoomControls');

        if (mode === 'firstPerson') {
            btnFP.className = "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition bg-emerald-600 text-white flex items-center gap-1.5 shadow";
            btnOV.className = "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition text-slate-400 hover:text-white flex items-center gap-1.5 hover:bg-slate-800";
            
            presetGround.classList.remove('hidden'); presetGround.classList.add('flex');
            
            // 追加：方向ボタンを表示する
            ['btnGroundSouth', 'btnGroundEast', 'btnGroundWest', 'btnGroundZenith'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = '';
            });

            hintLabel.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right text-emerald-400 text-sm"></i><span class="text-xs sm:text-sm font-bold text-slate-200">見回す</span>';
            hintLabel.style.display = 'flex';
            
            if (zoomControls) { zoomControls.classList.remove('hidden'); zoomControls.classList.add('flex'); }
            
            if(labelN) labelN.visible = true;
            if(labelZenith) labelZenith.visible = false;
            
            isAnimatingToPreset = true;
        } else {
            btnFP.className = "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition text-slate-400 hover:text-white flex items-center gap-1.5 hover:bg-slate-800";
            btnOV.className = "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition bg-fuchsia-600 text-white flex items-center gap-1.5 shadow";
            
            // 変更：全画面ボタンを残すために、コンテナ(箱)自体は表示したままにする
            presetGround.classList.remove('hidden'); presetGround.classList.add('flex');
            
            // 追加：方向ボタンだけを隠す
            ['btnGroundSouth', 'btnGroundEast', 'btnGroundWest', 'btnGroundZenith'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            hintLabel.style.display = 'none';
            
            if (zoomControls) { zoomControls.classList.add('hidden'); zoomControls.classList.remove('flex'); }
            
            if(labelN) labelN.visible = false;
            if(labelZenith) labelZenith.visible = true;
            
            isAnimatingToPreset = true;
        }
        updateAllViews();
    }

    function setPresetView(type) {
        isAnimatingToPreset = true;
        if (state.orbitMode === 'sunMoves') {
            const moonAngle = (state.moonAge / 29.5) * Math.PI * 2;
            const sunAngle = Math.PI + moonAngle;
            const isTopView = (type === 'top-left' || type === 'top-right');
            const isLeft = (type === 'sun-left' || type === 'top-left');

            targetCamTheta = sunAngle + (isLeft ? -Math.PI / 2 : Math.PI / 2);
            targetCamElevation = isTopView ? 1.45 : 0.35;
            targetCamRadius = 55;
        } else {
            if (type === 'sun-left') { targetCamTheta = Math.PI / 2; targetCamElevation = 0.35; targetCamRadius = 55; }
            else if (type === 'sun-right') { targetCamTheta = -Math.PI / 2; targetCamElevation = 0.35; targetCamRadius = 55; }
            else if (type === 'top-left') { targetCamTheta = Math.PI / 2; targetCamElevation = 1.45; targetCamRadius = 55; }
            else if (type === 'top-right') { targetCamTheta = -Math.PI / 2; targetCamElevation = 1.45; targetCamRadius = 55; }
        }
    }

    function setGroundPreset(dir) {
        isAnimatingToPreset = true;
        if (dir === 'south') { targetGCamYaw = 0; targetGCamPitch = 0.4; } 
        else if (dir === 'east') { targetGCamYaw = Math.PI / 2; targetGCamPitch = 0.4; } 
        else if (dir === 'west') { targetGCamYaw = -Math.PI / 2; targetGCamPitch = 0.4; } 
        else if (dir === 'zenith') { targetGCamPitch = Math.PI / 2 - 0.2; }
    }

    function resetCamera() {
        setPresetView('sun-left');
    }

    function toggleSunRays() {
        if (state.orbitMode === 'sunMoves') return;
        state.showRays = !state.showRays;
        sunRaysGroup.visible = state.showRays;
        const btn = document.getElementById('btnRays');
        if (state.showRays) { 
            btn.classList.add('text-amber-300'); 
            btn.classList.remove('text-slate-500'); 
        } else { 
            btn.classList.remove('text-amber-300'); 
            btn.classList.add('text-slate-500'); 
        }
    }

    function onWindowResize() {
        const container = document.getElementById('canvas3d-container');
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight || 320;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    }

    function update3DPositions() {
        if (universeGroup && universeGroup.visible) {
            const orbitRadius = 14;
            const moonAngle = (state.moonAge / 29.5) * Math.PI * 2;
            
            if (state.orbitMode === 'moonMoves') {
                moonMesh.position.x = -orbitRadius * Math.cos(moonAngle);
                moonMesh.position.z = orbitRadius * Math.sin(moonAngle);
                sunMesh.position.set(-30, 0, 0);
                sunRaysGroup.rotation.y = 0;
            } else {
                moonMesh.position.x = -orbitRadius;
                moonMesh.position.z = 0;
                const sunAng = Math.PI + moonAngle;
                sunMesh.position.set(30 * Math.cos(sunAng), 0, 30 * Math.sin(sunAng));
                sunRaysGroup.rotation.y = moonAngle; 
            }
            
            if (uSunLight) uSunLight.position.copy(sunMesh.position);

            let currentEarthRotation = ((state.timeHour - 12) / 24) * Math.PI * 2;

            // 太陽が動くモードの時は、カメラの移動に合わせて地球の向きも補正し、画面上で固定させる
            if (state.orbitMode === 'sunMoves') {
                const moonAngle = (state.moonAge / 29.5) * Math.PI * 2;
                currentEarthRotation += moonAngle;
            }

            earthGroup.rotation.y = currentEarthRotation;
        }

        if (groundGroup && groundGroup.visible) {
            const R_SUN = 50;
            const R_MOON = 48;

            const hourAngle = (state.timeHour - 12) * (Math.PI / 12);
            
            const sx = R_SUN * Math.sin(hourAngle);
            const sy = R_SUN * Math.cos(hourAngle) * Math.sin(55 * Math.PI / 180);
            const sz = -R_SUN * Math.cos(hourAngle) * Math.cos(55 * Math.PI / 180);
            
            gSunMesh.position.set(sx, sy, sz);

            const moonHourAngle = getMoonHourAngle();
            
            const mx = R_MOON * Math.sin(moonHourAngle);
            const my = R_MOON * Math.cos(moonHourAngle) * Math.sin(55 * Math.PI / 180);
            const mz = -R_MOON * Math.cos(moonHourAngle) * Math.cos(55 * Math.PI / 180);
            
            gMoonMesh.position.set(mx, my, mz);

            if (state.groundMode === 'overview') {
                const reqWidth = 120;
                const reqHeight = 55;
                const fovRad = THREE.MathUtils.degToRad(25 / 2);
                
                let targetZ = reqWidth / (2 * camera.aspect * Math.tan(fovRad));
                const minZHeight = reqHeight / (2 * Math.tan(fovRad));
                targetZ = Math.max(targetZ, minZHeight);
                
                const ovCamPos = new THREE.Vector3(0, 6, targetZ); 
                
                const V = new THREE.Vector3().subVectors(ovCamPos, gMoonMesh.position).normalize();
                const up = new THREE.Vector3(0, 1, 0);
                const R = new THREE.Vector3().crossVectors(up, V).normalize();
                
                const alpha = (state.moonAge / 29.5) * Math.PI * 2;
                
                const L_dir = new THREE.Vector3()
                    .addScaledVector(V, -Math.cos(alpha))
                    .addScaledVector(R, Math.sin(alpha));
                    
                gSunLight.position.copy(gMoonMesh.position).addScaledVector(L_dir, 100);
                gSunLight.target.position.copy(gMoonMesh.position);
            } else {
                const sunDir = new THREE.Vector3(sx, sy, sz).normalize();
                gSunLight.position.copy(gMoonMesh.position).addScaledVector(sunDir, 100);
                gSunLight.target.position.copy(gMoonMesh.position);
            }
            gSunLight.target.updateMatrixWorld();

            updateSkyDomeColor();
        }
    }

    function updateSkyDomeColor() {
        if (!skyMat || !groundGroup.visible) return;
        const h = state.timeHour;
        let color = new THREE.Color();
        let starOp = 0;
        
        const colorNight = new THREE.Color(0x0f172a);
        const colorSunset = new THREE.Color(0xb87a59);
        const colorDay = new THREE.Color(0x5b7c99);
        
        if (h >= 4 && h < 6) {
            const t = (h - 4) / 2;
            color.lerpColors(colorNight, colorSunset, t);
            starOp = 1 - t;
        } else if (h >= 6 && h < 8) {
            const t = (h - 6) / 2;
            color.lerpColors(colorSunset, colorDay, t);
        } else if (h >= 8 && h < 16) {
            color.copy(colorDay);
        } else if (h >= 16 && h < 18) {
            const t = (h - 16) / 2;
            color.lerpColors(colorDay, colorSunset, t);
        } else if (h >= 18 && h < 20) {
            const t = (h - 18) / 2;
            color.lerpColors(colorSunset, colorNight, t);
            starOp = t;
        } else {
            color.copy(colorNight);
            starOp = 1;
        }
        
        skyMat.color.copy(color);
        if(gStars) gStars.material.opacity = starOp;
    }

    function animate3D() {
        requestAnimationFrame(animate3D);
        applyCameraTransform();

        let needsUpdate = false;

        if (state.isPlaying) {
            state.moonAge += 0.05 * state.speed;
            if (state.moonAge >= 29.5) state.moonAge = 0;
            document.getElementById('orbitSlider').value = state.moonAge.toFixed(1);
            needsUpdate = true;
        }

        if (state.isPlayingEarth) {
            state.timeHour += (0.08 * state.speed);
            if (state.timeHour >= 24) state.timeHour = 0;
            document.getElementById('timeSlider').value = state.timeHour.toFixed(1);
            needsUpdate = true;
        }

        if (needsUpdate) {
            updateAllViews();
        }

        renderer.render(scene, camera);
    }

    /* ==========================================================================
       3. 外部から操作するための専用API（窓口）
       ========================================================================== */
    return {
        init: init3D,
        updatePositions: update3DPositions,
        onWindowResize: onWindowResize,
        zoomCamera: zoomCamera,
        setViewMode: setViewMode,       
        setGroundMode: setGroundMode,
        setPresetView: setPresetView,
        setGroundPreset: setGroundPreset,
        resetCamera: resetCamera,
        toggleSunRays: toggleSunRays,
        
        // main.jsが変数を直接操作する代わりに用意した専用メソッド
        shiftCameraAngle: function(delta) {
            camTheta += delta;
            targetCamTheta += delta;
        },
        setSunRaysVisible: function(visible) {
            if (sunRaysGroup) sunRaysGroup.visible = visible;
        }
    };
})();