/*

'||''|.   ..|''||   |''||''|     |     |''||''|  ..|''||   
 ||   || .|'    ||     ||       |||       ||    .|'    ||  
 ||...|' ||      ||    ||      |  ||      ||    ||      || 
 ||      '|.     ||    ||     .''''|.     ||    '|.     || 
.||.      ''|...|'    .||.   .|.  .||.   .||.    ''|...|'  
                                                           
                                                           
POTATO.THESERVER.LIFE
LICENSE GPL-3.0

-------------------------------
mobileControls.js
-
Mobile controls handler (Touch Zones + Gyroscope)
*/

// Control mode: 'touch' or 'gyro'
let controlMode = 'touch';
let gyroEnabled = false;
let gyroPermissionGranted = false;

// Touch zones tracking
let touchZones = {
    left: { active: false, touchId: null },
    right: { active: false, touchId: null }
};

// Gyroscope calibration
let gyroCalibration = {
    beta: 0,  // Front-to-back tilt
    gamma: 0  // Left-to-right tilt
};

let gyroSensitivity = 1.5; // Multiplier for gyro sensitivity
let deadZone = 5; // Degrees of tilt to ignore (prevent jitter)

// References to game state (will be set from gameCore)
let moveLeftRef = null;
let moveRightRef = null;
let controlsActiveRef = null;

/**
 * Reliable mobile detection
 * Checks both User Agent and touch capability
 */
export function isMobile() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Check for mobile patterns in user agent
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
    const isMobileUA = mobileRegex.test(userAgent.toLowerCase());
    
    // Check for touch support
    const hasTouch = ('ontouchstart' in window) || 
                     (navigator.maxTouchPoints > 0) || 
                     (navigator.msMaxTouchPoints > 0);
    
    // Device is mobile if it matches UA pattern OR has touch + small screen
    return isMobileUA || (hasTouch && window.innerWidth < 1024);
}

/**
 * Initialize mobile controls (only called if device is mobile)
 */
export function initMobileControls(moveLeftCallback, moveRightCallback, controlsActiveCallback) {
    if (!isMobile()) {
        console.log('[Mobile Controls] Desktop detected - skipping mobile controls initialization');
        return;
    }
    
    console.log('[Mobile Controls] Mobile device detected - initializing controls');
    
    // Store references to game state setters
    moveLeftRef = moveLeftCallback;
    moveRightRef = moveRightCallback;
    controlsActiveRef = controlsActiveCallback;
    
    // Load saved control mode preference
    const savedMode = localStorage.getItem('mobileControlMode');
    if (savedMode === 'gyro' || savedMode === 'touch') {
        controlMode = savedMode;
    }
    
    // Initialize touch controls (always available)
    initTouchControls();
    
    // Setup mobile UI
    createMobileUI();
    
    // If gyro mode was saved, try to enable it
    if (controlMode === 'gyro') {
        requestGyroPermission();
    }
    
    console.log(`[Mobile Controls] Initialized in ${controlMode} mode`);
}

/**
 * Initialize touch zone controls
 */
function initTouchControls() {
    const canvas = document.getElementById('gameCanvas');
    
    // Prevent default touch behaviors
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
    
    // Touch event listeners
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    
    console.log('[Touch Controls] Touch zones initialized');
}

/**
 * Handle touch start event
 */
function handleTouchStart(e) {
    if (controlMode !== 'touch') return;
    
    e.preventDefault();
    
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const midpoint = rect.width / 2;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const x = touch.clientX - rect.left;
        
        // Left zone (0 to midpoint)
        if (x < midpoint) {
            if (!touchZones.left.active) {
                touchZones.left.active = true;
                touchZones.left.touchId = touch.identifier;
                if (moveLeftRef) moveLeftRef(true);
            }
        }
        // Right zone (midpoint to width)
        else {
            if (!touchZones.right.active) {
                touchZones.right.active = true;
                touchZones.right.touchId = touch.identifier;
                if (moveRightRef) moveRightRef(true);
            }
        }
    }
}

/**
 * Handle touch move event (keep tracking which zone is touched)
 */
function handleTouchMove(e) {
    if (controlMode !== 'touch') return;
    
    e.preventDefault();
    
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const midpoint = rect.width / 2;
    
    // Update active zones based on current touch positions
    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const x = touch.clientX - rect.left;
        
        // Check if this touch is in left zone
        if (touch.identifier === touchZones.left.touchId) {
            if (x >= midpoint) {
                // Touch moved from left to right zone
                touchZones.left.active = false;
                touchZones.left.touchId = null;
                if (moveLeftRef) moveLeftRef(false);
                
                if (!touchZones.right.active) {
                    touchZones.right.active = true;
                    touchZones.right.touchId = touch.identifier;
                    if (moveRightRef) moveRightRef(true);
                }
            }
        }
        // Check if this touch is in right zone
        else if (touch.identifier === touchZones.right.touchId) {
            if (x < midpoint) {
                // Touch moved from right to left zone
                touchZones.right.active = false;
                touchZones.right.touchId = null;
                if (moveRightRef) moveRightRef(false);
                
                if (!touchZones.left.active) {
                    touchZones.left.active = true;
                    touchZones.left.touchId = touch.identifier;
                    if (moveLeftRef) moveLeftRef(true);
                }
            }
        }
    }
}

/**
 * Handle touch end/cancel event
 */
function handleTouchEnd(e) {
    if (controlMode !== 'touch') return;
    
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        
        if (touch.identifier === touchZones.left.touchId) {
            touchZones.left.active = false;
            touchZones.left.touchId = null;
            if (moveLeftRef) moveLeftRef(false);
        }
        
        if (touch.identifier === touchZones.right.touchId) {
            touchZones.right.active = false;
            touchZones.right.touchId = null;
            if (moveRightRef) moveRightRef(false);
        }
    }
}

/**
 * Request permission for gyroscope (required for iOS 13+)
 */
export function requestGyroPermission() {
    // Check if DeviceOrientationEvent exists
    if (typeof DeviceOrientationEvent === 'undefined') {
        alert('Gyroscope not supported on this device');
        return;
    }
    
    // iOS 13+ requires explicit permission
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    gyroPermissionGranted = true;
                    enableGyroControls();
                } else {
                    alert('Gyroscope permission denied. Using touch controls.');
                    controlMode = 'touch';
                    updateMobileUI();
                }
            })
            .catch(error => {
                console.error('[Gyro] Permission error:', error);
                alert('Failed to access gyroscope. Using touch controls.');
                controlMode = 'touch';
                updateMobileUI();
            });
    } else {
        // Non-iOS or older iOS - no permission needed
        gyroPermissionGranted = true;
        enableGyroControls();
    }
}

/**
 * Enable gyroscope controls
 */
function enableGyroControls() {
    if (gyroEnabled) return; // Already enabled
    
    // Calibrate on first enable
    calibrateGyro();
    
    window.addEventListener('deviceorientation', handleDeviceOrientation);
    gyroEnabled = true;
    controlMode = 'gyro';
    
    // Save preference
    localStorage.setItem('mobileControlMode', 'gyro');
    
    console.log('[Gyro] Gyroscope controls enabled');
    updateMobileUI();
}

/**
 * Disable gyroscope controls
 */
function disableGyroControls() {
    window.removeEventListener('deviceorientation', handleDeviceOrientation);
    gyroEnabled = false;
    controlMode = 'touch';
    
    // Reset movement
    if (moveLeftRef) moveLeftRef(false);
    if (moveRightRef) moveRightRef(false);
    
    // Save preference
    localStorage.setItem('mobileControlMode', 'touch');
    
    console.log('[Gyro] Gyroscope controls disabled');
    updateMobileUI();
}

/**
 * Calibrate gyroscope to current device position
 */
function calibrateGyro() {
    // Wait for next orientation event to set baseline
    const calibrationHandler = (event) => {
        if (event.beta !== null && event.gamma !== null) {
            gyroCalibration.beta = event.beta;
            gyroCalibration.gamma = event.gamma;
            console.log('[Gyro] Calibrated to:', gyroCalibration);
            window.removeEventListener('deviceorientation', calibrationHandler);
        }
    };
    
    window.addEventListener('deviceorientation', calibrationHandler);
    
    // Fallback: if no event after 2 seconds, assume neutral position
    setTimeout(() => {
        window.removeEventListener('deviceorientation', calibrationHandler);
    }, 2000);
}

/**
 * Handle device orientation events
 */
function handleDeviceOrientation(event) {
    if (controlMode !== 'gyro' || !gyroEnabled) return;
    
    if (event.gamma === null || event.beta === null) return;
    
    // Gamma: left-to-right tilt (-90 to 90)
    // Negative = tilt left, Positive = tilt right
    const rawGamma = event.gamma - gyroCalibration.gamma;
    
    // Apply dead zone
    let tilt = 0;
    if (Math.abs(rawGamma) > deadZone) {
        tilt = rawGamma;
    }
    
    // Apply sensitivity
    tilt *= gyroSensitivity;
    
    // Determine movement direction
    const shouldMoveLeft = tilt < -10;
    const shouldMoveRight = tilt > 10;
    
    // Update movement state
    if (moveLeftRef) moveLeftRef(shouldMoveLeft);
    if (moveRightRef) moveRightRef(shouldMoveRight);
}

/**
 * Toggle between touch and gyro modes
 */
export function toggleControlMode() {
    if (controlMode === 'touch') {
        requestGyroPermission();
    } else {
        disableGyroControls();
    }
}

/**
 * Create mobile-specific UI elements
 */
function createMobileUI() {
    // Create a persistent control mode toggle button at top of screen
    createPersistentToggleButton();
    
    // Also add controls to pause menu for convenience
    addControlsToPauseMenu();
    
    // Add visual indicators for touch zones (only in touch mode)
    createTouchZoneIndicators();
}

/**
 * Create a persistent toggle button always visible on screen
 */
function createPersistentToggleButton() {
    // Check if button already exists
    if (document.getElementById('mobileControlTogglePersistent')) return;
    
    const toggleButton = document.createElement('button');
    toggleButton.id = 'mobileControlTogglePersistent';
    toggleButton.innerHTML = controlMode === 'touch' ? '📱 Touch' : '🎯 Gyro';
    toggleButton.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10000;
        padding: 12px 20px;
        border: 3px solid ${controlMode === 'touch' ? '#6BCF7F' : '#FF6B6B'};
        background: ${controlMode === 'touch' ? 'rgba(107, 207, 127, 0.9)' : 'rgba(255, 107, 107, 0.9)'};
        color: #fff;
        border-radius: 25px;
        cursor: pointer;
        font-family: 'Fredoka', sans-serif;
        font-size: 16px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    `;
    
    toggleButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleControlMode();
    });
    
    // Add hover effect
    toggleButton.addEventListener('touchstart', () => {
        toggleButton.style.transform = 'scale(0.95)';
    });
    
    toggleButton.addEventListener('touchend', () => {
        toggleButton.style.transform = 'scale(1)';
    });
    
    document.body.appendChild(toggleButton);
    
    console.log('[Mobile UI] Persistent toggle button created');
}

/**
 * Add control mode selection to pause menu
 */
function addControlsToPauseMenu() {
    const pauseMenu = document.getElementById('pauseMenu');
    if (!pauseMenu) return;
    
    // Check if controls already exist in pause menu
    if (document.getElementById('mobileControlToggle')) return;
    
    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'mobileControlToggle';
    toggleContainer.style.cssText = `
        margin: 15px 0;
        padding: 10px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
    `;
    
    const label = document.createElement('div');
    label.textContent = 'Controls:';
    label.style.cssText = `
        font-size: 14px;
        margin-bottom: 8px;
        color: #fff;
        font-family: 'Fredoka', sans-serif;
    `;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: center;
    `;
    
    const touchButton = document.createElement('button');
    touchButton.id = 'touchModeButton';
    touchButton.textContent = '📱 Touch';
    touchButton.style.cssText = `
        flex: 1;
        padding: 10px;
        border: 2px solid #6BCF7F;
        background: ${controlMode === 'touch' ? '#6BCF7F' : 'rgba(107, 207, 127, 0.2)'};
        color: #fff;
        border-radius: 5px;
        cursor: pointer;
        font-family: 'Fredoka', sans-serif;
        font-size: 14px;
        transition: all 0.3s;
    `;
    
    const gyroButton = document.createElement('button');
    gyroButton.id = 'gyroModeButton';
    gyroButton.textContent = '🎯 Gyro';
    gyroButton.style.cssText = `
        flex: 1;
        padding: 10px;
        border: 2px solid #FF6B6B;
        background: ${controlMode === 'gyro' ? '#FF6B6B' : 'rgba(255, 107, 107, 0.2)'};
        color: #fff;
        border-radius: 5px;
        cursor: pointer;
        font-family: 'Fredoka', sans-serif;
        font-size: 14px;
        transition: all 0.3s;
    `;
    
    touchButton.addEventListener('click', () => {
        if (controlMode !== 'touch') {
            disableGyroControls();
        }
    });
    
    gyroButton.addEventListener('click', () => {
        if (controlMode !== 'gyro') {
            requestGyroPermission();
        }
    });
    
    buttonContainer.appendChild(touchButton);
    buttonContainer.appendChild(gyroButton);
    
    toggleContainer.appendChild(label);
    toggleContainer.appendChild(buttonContainer);
    
    // Insert before the first button in pause menu
    const firstButton = pauseMenu.querySelector('button');
    if (firstButton) {
        pauseMenu.insertBefore(toggleContainer, firstButton);
    } else {
        pauseMenu.appendChild(toggleContainer);
    }
    
    // Add calibration button for gyro mode
    const calibrateButton = document.createElement('button');
    calibrateButton.id = 'calibrateGyroButton';
    calibrateButton.textContent = '🎯 Recalibrate Gyro';
    calibrateButton.style.cssText = `
        display: ${controlMode === 'gyro' ? 'block' : 'none'};
        margin: 10px auto;
        padding: 8px 15px;
        border: 2px solid #FFD93D;
        background: rgba(255, 217, 61, 0.3);
        color: #fff;
        border-radius: 5px;
        cursor: pointer;
        font-family: 'Fredoka', sans-serif;
        font-size: 12px;
    `;
    
    calibrateButton.addEventListener('click', () => {
        calibrateGyro();
        alert('Gyroscope recalibrated! Hold device in neutral position.');
    });
    
    pauseMenu.insertBefore(calibrateButton, toggleContainer.nextSibling);
}

/**
 * Create visual indicators for touch zones
 */
function createTouchZoneIndicators() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    
    const canvasParent = canvas.parentElement;
    
    // Check if indicators already exist
    if (document.getElementById('touchZoneIndicators')) return;
    
    const indicatorContainer = document.createElement('div');
    indicatorContainer.id = 'touchZoneIndicators';
    indicatorContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        display: ${controlMode === 'touch' ? 'flex' : 'none'};
    `;
    
    const leftIndicator = document.createElement('div');
    leftIndicator.id = 'leftTouchZone';
    leftIndicator.style.cssText = `
        flex: 1;
        border-right: 1px dashed rgba(255, 255, 255, 0.3);
        transition: background-color 0.2s;
    `;
    
    const rightIndicator = document.createElement('div');
    rightIndicator.id = 'rightTouchZone';
    rightIndicator.style.cssText = `
        flex: 1;
        transition: background-color 0.2s;
    `;
    
    indicatorContainer.appendChild(leftIndicator);
    indicatorContainer.appendChild(rightIndicator);
    
    // Position container over canvas
    const canvasPosition = window.getComputedStyle(canvasParent).position;
    if (canvasPosition === 'static') {
        canvasParent.style.position = 'relative';
    }
    
    canvasParent.appendChild(indicatorContainer);
    
    // Visual feedback on touch
    setInterval(() => {
        if (controlMode === 'touch') {
            leftIndicator.style.backgroundColor = touchZones.left.active 
                ? 'rgba(107, 207, 127, 0.2)' 
                : 'transparent';
            rightIndicator.style.backgroundColor = touchZones.right.active 
                ? 'rgba(107, 207, 127, 0.2)' 
                : 'transparent';
        }
    }, 50);
}

/**
 * Update mobile UI when control mode changes
 */
function updateMobileUI() {
    // Update persistent toggle button
    const persistentButton = document.getElementById('mobileControlTogglePersistent');
    if (persistentButton) {
        persistentButton.innerHTML = controlMode === 'touch' ? '📱 Touch' : '🎯 Gyro';
        persistentButton.style.border = `3px solid ${controlMode === 'touch' ? '#6BCF7F' : '#FF6B6B'}`;
        persistentButton.style.background = controlMode === 'touch' 
            ? 'rgba(107, 207, 127, 0.9)' 
            : 'rgba(255, 107, 107, 0.9)';
    }
    
    // Update pause menu buttons
    const touchButton = document.getElementById('touchModeButton');
    const gyroButton = document.getElementById('gyroModeButton');
    const calibrateButton = document.getElementById('calibrateGyroButton');
    const indicators = document.getElementById('touchZoneIndicators');
    
    if (touchButton) {
        touchButton.style.background = controlMode === 'touch' 
            ? '#6BCF7F' 
            : 'rgba(107, 207, 127, 0.2)';
    }
    
    if (gyroButton) {
        gyroButton.style.background = controlMode === 'gyro' 
            ? '#FF6B6B' 
            : 'rgba(255, 107, 107, 0.2)';
    }
    
    if (calibrateButton) {
        calibrateButton.style.display = controlMode === 'gyro' ? 'block' : 'none';
    }
    
    if (indicators) {
        indicators.style.display = controlMode === 'touch' ? 'flex' : 'none';
    }
}

/**
 * Get current control mode (for external use)
 */
export function getControlMode() {
    return controlMode;
}

/**
 * Cleanup function (call when game ends)
 */
export function cleanupMobileControls() {
    if (gyroEnabled) {
        disableGyroControls();
    }
    
    // Reset touch zones
    touchZones.left.active = false;
    touchZones.left.touchId = null;
    touchZones.right.active = false;
    touchZones.right.touchId = null;
}