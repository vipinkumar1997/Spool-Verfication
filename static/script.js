// Spool Verification System - Ultra Fast
// Surbhi Sticker Format: VPN$lotcode$datecode$qty
// Manufacturing Sticker Format: VPN only

const surbhiInput = document.getElementById('surbhiSticker');
const manufacturingInput = document.getElementById('manufacturingSticker');
const verifyBtn = document.getElementById('verifyBtn');
const surbhiStatus = document.getElementById('surbhiStatus');
const manufacturingStatus = document.getElementById('manufacturingStatus');
const resultDiv = document.getElementById('result');
const recentScansDiv = document.getElementById('recentScans');
const historyList = document.getElementById('historyList');

// Stats
let totalScans = 0;
let passCount = 0;
let failCount = 0;

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

// Handle Surbhi input
function handleSurbhiInput() {
    const data = surbhiInput.value.trim();
    const validation = validateSurbhiFormat(data);
    
    if (validation.valid) {
        surbhiStatus.textContent = '✓';
        surbhiStatus.className = 'input-status valid';
        manufacturingInput.disabled = false;
        manufacturingInput.focus();
    } else {
        surbhiStatus.textContent = '✗';
        surbhiStatus.className = 'input-status invalid';
        manufacturingInput.disabled = true;
    }
    updateVerifyButton();
}

// Handle Manufacturing input
function handleManufacturingInput() {
    const data = manufacturingInput.value.trim();
    const validation = validateManufacturingFormat(data);
    
    if (validation.valid) {
        manufacturingStatus.textContent = '✓';
        manufacturingStatus.className = 'input-status valid';
    } else {
        manufacturingStatus.textContent = '✗';
        manufacturingStatus.className = 'input-status invalid';
    }
    updateVerifyButton();
}

// Update verify button state
function updateVerifyButton() {
    const surbhiValid = validateSurbhiFormat(surbhiInput.value.trim()).valid;
    const manufacturingValid = manufacturingInput.value.trim() !== '';
    verifyBtn.disabled = !(surbhiValid && manufacturingValid);
}

// Handle key down
function handleKeyDown(e, field) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (field === 'surbhi' && validateSurbhiFormat(surbhiInput.value.trim()).valid) {
            manufacturingInput.focus();
        } else if (field === 'manufacturing' && !verifyBtn.disabled) {
            verifyStickers();
        }
    }
}

// Ultra fast verification
async function verifyStickers() {
    const surbhiData = surbhiInput.value.trim();
    const manufacturingData = manufacturingInput.value.trim();
    
    // Disable button during verification
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="btn-icon">⏳</span> Verifying...';
    
    try {
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                surbhi: surbhiData,
                manufacturing: manufacturingData
            })
        });
        
        const result = await response.json();
        
        // Update stats
        totalScans++;
        if (result.success) {
            passCount++;
            showResult('success', '✅ PASS - VPNs match!');
        } else {
            failCount++;
            showResult('error', result.message || '❌ FAIL - VPN mismatch');
        }
        
        updateStats();
        
        // Load updated recent scans
        await loadRecentScans();
        await loadHistory();
        
    } catch (error) {
        showResult('error', '❌ Error: ' + error.message);
    } finally {
        // Clear inputs for next scan
        setTimeout(() => {
            surbhiInput.value = '';
            manufacturingInput.value = '';
            surbhiInput.focus();
            surbhiStatus.textContent = '';
            manufacturingStatus.textContent = '';
            manufacturingInput.disabled = true;
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<span class="btn-icon">⚡</span> Verify Now';
        }, 1000);
    }
}

// Show result
function showResult(type, message) {
    const resultIcon = resultDiv.querySelector('.result-icon');
    const resultText = resultDiv.querySelector('.result-text');
    
    resultDiv.className = `result-display ${type}`;
    resultText.textContent = message;
    
    if (type === 'success') {
        resultIcon.textContent = '✅';
    } else if (type === 'error') {
        resultIcon.textContent = '❌';
    } else {
        resultIcon.textContent = '👆';
    }
    
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

// Load recent scans
async function loadRecentScans() {
    try {
        const response = await fetch('/api/recent-scans');
        const scans = await response.json();
        
        if (scans && scans.length > 0) {
            recentScansDiv.innerHTML = scans.map((scan, index) => `
                <div class="scan-item">
                    <div class="scan-info">
                        <span class="scan-vpn">${scan.vpn}</span>
                        <span class="scan-time">${scan.timestamp}</span>
                    </div>
                    <span class="scan-result ${scan.result}">
                        ${scan.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}
                    </span>
                </div>
            `).join('');
        } else {
            recentScansDiv.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <p>No scans yet</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading recent scans:', error);
    }
}

// Load history
async function loadHistory() {
    try {
        const response = await fetch('/api/history');
        const history = await response.json();
        
        if (history && history.length > 0) {
            historyList.innerHTML = history.map(item => `
                <li class="scan-item">
                    <div class="scan-info">
                        <span class="scan-vpn">${item.vpn || 'N/A'}</span>
                        <span class="scan-time">${item.timestamp}</span>
                    </div>
                    <span class="scan-result ${item.result}">
                        ${item.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}
                    </span>
                </li>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Update stats display
function updateStats() {
    document.getElementById('totalScans').textContent = totalScans;
    document.getElementById('passCount').textContent = passCount;
    document.getElementById('failCount').textContent = failCount;
}

// Clear all data
function clearAll() {
    if (confirm('Are you sure you want to clear all data?')) {
        totalScans = 0;
        passCount = 0;
        failCount = 0;
        updateStats();
        
        surbhiInput.value = '';
        manufacturingInput.value = '';
        surbhiStatus.textContent = '';
        manufacturingStatus.textContent = '';
        manufacturingInput.disabled = true;
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<span class="btn-icon">⚡</span> Verify Now';
        
        recentScansDiv.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>No scans yet</p>
            </div>
        `;
        
        showResult('waiting', 'Scan both stickers to verify');
    }
}

// Initialize
loadRecentScans();
loadHistory();
showResult('waiting', 'Scan both stickers to verify');
