// Spool Sticker Verification System - Ultra Fast
// Surbhi Sticker Format: VPN$lotcode$datecode$qty
// Manufacturing Sticker Format: VPN only
// Workflow: Surbhi -> Manufacturing -> Verify

const historyList = document.getElementById('historyList');
const resultDiv = document.getElementById('result');
const recentScansDiv = document.getElementById('recentScans');
const surbhiInput = document.getElementById('surbhiSticker');
const manufacturingInput = document.getElementById('manufacturingSticker');
const verifyBtn = document.getElementById('verifyBtn');
const surbhiStatus = document.getElementById('surbhiStatus');
const manufacturingStatus = document.getElementById('manufacturingStatus');

// Store recent successful scans
let recentScans = [];

// Load recent scans from localStorage
function loadRecentScans() {
    const savedScans = JSON.parse(localStorage.getItem('recentScans')) || [];
    recentScans = savedScans.slice(-5);
    updateRecentScansDisplay();
}

// Update the live display of recent scans
function updateRecentScansDisplay() {
    if (recentScans.length === 0) {
        recentScansDiv.innerHTML = '<p class="no-scans">No spools scanned yet</p>';
        return;
    }
    
    recentScansDiv.innerHTML = recentScans.map((scan, index) => `
        <div class="scan-item">
            <span class="scan-number">#${recentScans.length - index}</span>
            <span class="scan-vpn">${scan.vpn}</span>
            <span class="scan-result ${scan.result}">${scan.result === 'PASS' ? '✅' : '❌'}</span>
            <span class="scan-time">${new Date(scan.timestamp).toLocaleTimeString()}</span>
        </div>
    `).join('');
}

// Save recent scan
function saveRecentScan(vpn, result) {
    recentScans.unshift({
        vpn: vpn,
        result: result,
        timestamp: new Date().toISOString()
    });
    
    if (recentScans.length > 5) {
        recentScans.pop();
    }
    
    localStorage.setItem('recentScans', JSON.stringify(recentScans));
    updateRecentScansDisplay();
}

// Load history from localStorage
function loadHistory() {
    const history = JSON.parse(localStorage.getItem('stickerVerificationHistory')) || [];
    historyList.innerHTML = history.map(item => 
        `<li class="${item.success ? 'success' : 'error'}">
            ${new Date(item.timestamp).toLocaleString()} - 
            ${item.success ? '✅ PASS' : '❌ FAIL'} - 
            VPN: ${item.vpn || 'N/A'}
        </li>`
    ).join('');
}

// Save to history
function saveToHistory(vpn, success, error = '') {
    const history = JSON.parse(localStorage.getItem('stickerVerificationHistory')) || [];
    history.unshift({
        vpn: vpn,
        success: success,
        error: error,
        timestamp: new Date().toISOString()
    });
    if (history.length > 50) {
        history.pop();
    }
    localStorage.setItem('stickerVerificationHistory', JSON.stringify(history));
    loadHistory();
}

// Validate Surbhi Sticker format
function validateSurbhiFormat(data) {
    if (!data || typeof data !== 'string') {
        return { valid: false, error: 'Empty' };
    }
    
    const parts = data.split('$');
    if (parts.length !== 4) {
        return { valid: false, error: 'Invalid format' };
    }
    
    for (let i = 0; i < parts.length; i++) {
        if (!parts[i] || parts[i].trim() === '') {
            return { valid: false, error: 'Empty part' };
        }
    }
    
    return { valid: true, vpn: parts[0] };
}

// Validate Manufacturing Sticker format
function validateManufacturingFormat(data) {
    if (!data || typeof data !== 'string') {
        return { valid: false, error: 'Empty' };
    }
    
    if (data.includes('$')) {
        return { valid: false, error: 'Invalid format' };
    }
    
    if (data.trim() === '') {
        return { valid: false, error: 'Empty' };
    }
    
    return { valid: true, vpn: data.trim() };
}

// Validate Surbhi input in real-time
function validateSurbhi() {
    const data = surbhiInput.value.trim();
    const validation = validateSurbhiFormat(data);
    
    if (validation.valid) {
        surbhiStatus.textContent = '✅ Valid';
        surbhiStatus.className = 'status valid';
        manufacturingInput.disabled = false;
        manufacturingInput.focus();
    } else {
        surbhiStatus.textContent = '❌ ' + validation.error;
        surbhiStatus.className = 'status invalid';
        manufacturingInput.disabled = true;
        verifyBtn.disabled = true;
    }
    updateVerifyButton();
}

// Validate Manufacturing input in real-time
function validateManufacturing() {
    const data = manufacturingInput.value.trim();
    const validation = validateManufacturingFormat(data);
    
    if (validation.valid) {
        manufacturingStatus.textContent = '✅ Valid';
        manufacturingStatus.className = 'status valid';
    } else {
        manufacturingStatus.textContent = '❌ ' + validation.error;
        manufacturingStatus.className = 'status invalid';
    }
    updateVerifyButton();
}

// Update verify button state
function updateVerifyButton() {
    const surbhiValid = validateSurbhiFormat(surbhiInput.value.trim()).valid;
    const manufacturingValid = manufacturingInput.value.trim() !== '';
    verifyBtn.disabled = !(surbhiValid && manufacturingValid);
}

// Ultra fast verification
function verifyStickers() {
    const surbhiData = surbhiInput.value.trim();
    const manufacturingData = manufacturingInput.value.trim();
    
    const surbhiValidation = validateSurbhiFormat(surbhiData);
    if (!surbhiValidation.valid) {
        showResult('error', '❌ FAIL: Invalid Surbhi format');
        saveToHistory(surbhiData, false, 'Invalid Surbhi format');
        return;
    }
    
    const manufacturingValidation = validateManufacturingFormat(manufacturingData);
    if (!manufacturingValidation.valid) {
        showResult('error', '❌ FAIL: Invalid Manufacturing format');
        saveToHistory(manufacturingData, false, 'Invalid Manufacturing format');
        return;
    }
    
    const surbhiVPN = surbhiValidation.vpn;
    const manufacturingVPN = manufacturingValidation.vpn;
    const isMatch = surbhiVPN === manufacturingVPN;
    
    if (isMatch) {
        showResult('success', '✅ PASS: VPNs match!');
        saveToHistory(surbhiVPN, true);
        saveRecentScan(surbhiVPN, 'PASS');
    } else {
        showResult('error', `❌ FAIL: VPN mismatch!<br>Surbhi: ${surbhiVPN}<br>Manufacturing: ${manufacturingVPN}`);
        saveToHistory(surbhiVPN, false, `Mismatch: ${surbhiVPN} vs ${manufacturingVPN}`);
        saveRecentScan(surbhiVPN, 'FAIL');
    }
    
    // Clear inputs for next scan
    setTimeout(() => {
        surbhiInput.value = '';
        manufacturingInput.value = '';
        surbhiInput.focus();
        surbhiStatus.textContent = '';
        manufacturingStatus.textContent = '';
        manufacturingInput.disabled = true;
        verifyBtn.disabled = true;
    }, 1000);
}

// Show result
function showResult(type, message) {
    resultDiv.className = `result ${type}`;
    resultDiv.innerHTML = message;
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

// Handle Enter key
function handleKeyPress(e) {
    if (e.key === 'Enter') {
        if (!surbhiInput.disabled && surbhiInput === document.activeElement) {
            validateSurbhi();
            if (validateSurbhiFormat(surbhiInput.value.trim()).valid) {
                manufacturingInput.focus();
            }
        } else if (!manufacturingInput.disabled && manufacturingInput === document.activeElement) {
            validateManufacturing();
            if (manufacturingInput.value.trim() !== '') {
                verifyStickers();
            }
        }
    }
}

// Add event listeners
surbhiInput.addEventListener('keypress', handleKeyPress);
manufacturingInput.addEventListener('keypress', handleKeyPress);

// Initialize
loadHistory();
loadRecentScans();
showResult('waiting', 'Scan Surbhi sticker first');
