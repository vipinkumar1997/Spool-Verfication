// Spool Verification System - Ultra Fast with Zebra Scanner Support
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
let currentField = 'surbhi';

// Always use POST with JSON headers
const apiHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

// Debounce function to prevent rapid multiple scans
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Validate Surbhi Sticker format
function validateSurbhiFormat(data) {
    if (!data || typeof data !== 'string') {
        return { valid: false, error: 'Empty' };
    }
    
    data = data.trim();
    const parts = data.split('$');
    if (parts.length !== 4) {
        return { valid: false, error: 'Invalid format' };
    }
    
    for (let i = 0; i < parts.length; i++) {
        if (!parts[i] || parts[i].trim() === '') {
            return { valid: false, error: 'Empty part' };
        }
    }
    
    return { valid: true, vpn: parts[0].trim() };
}

// Validate Manufacturing Sticker format
function validateManufacturingFormat(data) {
    if (!data || typeof data !== 'string') {
        return { valid: false, error: 'Empty' };
    }
    
    data = data.trim();
    
    if (data.includes('$')) {
        return { valid: false, error: 'Invalid format' };
    }
    
    if (data === '') {
        return { valid: false, error: 'Empty' };
    }
    
    return { valid: true, vpn: data };
}

// Safe API call with error handling and timeout
async function safeApiCall(url, options = {}, timeout = 3000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: { ...apiHeaders, ...options.headers },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            const text = await response.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            return { success: false, message: 'Server error', error: 'invalid_response' };
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            return { success: false, message: 'Request timeout', error: 'timeout' };
        }
        console.error('API call error:', error);
        return { success: false, message: 'Network error', error: 'network_error' };
    }
}

// Handle Surbhi input
function handleSurbhiInput() {
    const data = surbhiInput.value.trim();
    const validation = validateSurbhiFormat(data);
    
    if (validation.valid) {
        surbhiStatus.textContent = '✓';
        surbhiStatus.className = 'input-status valid';
        
        setTimeout(() => {
            if (currentField === 'surbhi' && validateSurbhiFormat(surbhiInput.value.trim()).valid) {
                manufacturingInput.disabled = false;
                manufacturingInput.focus();
                currentField = 'manufacturing';
            }
        }, 50);
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
        
        const surbhiValid = validateSurbhiFormat(surbhiInput.value.trim()).valid;
        if (surbhiValid && !verifyBtn.disabled) {
            setTimeout(() => {
                if (currentField === 'manufacturing' && validateManufacturingFormat(manufacturingInput.value.trim()).valid) {
                    verifyStickers();
                }
            }, 50);
        }
    } else {
        manufacturingStatus.textContent = '✗';
        manufacturingStatus.className = 'input-status invalid';
    }
    updateVerifyButton();
}

// Handle key down
function handleKeyDown(e, field) {
    if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        
        if (field === 'surbhi') {
            const validation = validateSurbhiFormat(surbhiInput.value.trim());
            if (validation.valid) {
                manufacturingInput.disabled = false;
                manufacturingInput.focus();
                currentField = 'manufacturing';
            }
        } else if (field === 'manufacturing') {
            const validation = validateManufacturingFormat(manufacturingInput.value.trim());
            if (validation.valid && validateSurbhiFormat(surbhiInput.value.trim()).valid) {
                verifyStickers();
            }
        }
    }
}

// Update verify button state
function updateVerifyButton() {
    const surbhiValid = validateSurbhiFormat(surbhiInput.value.trim()).valid;
    const manufacturingValid = manufacturingInput.value.trim() !== '';
    verifyBtn.disabled = !(surbhiValid && manufacturingValid);
}

// Verify stickers - Optimized for speed
async function verifyStickers() {
    const surbhiData = surbhiInput.value.trim();
    const manufacturingData = manufacturingInput.value.trim();
    
    // Disable button and show loading state
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="btn-icon">⏳</span> Checking...';
    
    try {
        const result = await safeApiCall('/api/verify', {
            method: 'POST',
            body: JSON.stringify({
                surbhi: surbhiData,
                manufacturing: manufacturingData
            })
        }, 5000);
        
        // Update stats
        totalScans++;
        if (result.success) {
            passCount++;
            showResult('success', '✅ PASS');
        } else {
            failCount++;
            showResult('error', result.message || '❌ FAIL');
        }
        
        updateStats();
        
        // Load updated data in background (don't wait)
        loadRecentScans();
        loadHistory();
        
    } catch (error) {
        showResult('error', '❌ Error');
    } finally {
        // Clear inputs quickly for next scan
        setTimeout(() => {
            surbhiInput.value = '';
            manufacturingInput.value = '';
            surbhiInput.focus();
            surbhiStatus.textContent = '';
            manufacturingStatus.textContent = '';
            manufacturingInput.disabled = true;
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<span class="btn-icon">⚡</span> Verify';
            currentField = 'surbhi';
        }, 500);
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
        const scans = await safeApiCall('/api/recent-scans', {}, 2000);
        
        if (scans && scans.length > 0) {
            recentScansDiv.innerHTML = scans.map((scan, index) => `
                <div class="scan-item">
                    <div class="scan-info">
                        <span class="scan-vpn">${scan.vpn || 'N/A'}</span>
                        <span class="scan-time">${scan.timestamp || ''}</span>
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
        const history = await safeApiCall('/api/history', {}, 2000);
        
        if (history && history.length > 0) {
            historyList.innerHTML = history.map(item => `
                <li class="scan-item">
                    <div class="scan-info">
                        <span class="scan-vpn">${item.vpn || 'N/A'}</span>
                        <span class="scan-time">${item.timestamp || ''}</span>
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
    if (confirm('Clear all data?')) {
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
        verifyBtn.innerHTML = '<span class="btn-icon">⚡</span> Verify';
        currentField = 'surbhi';
        
        recentScansDiv.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>No scans yet</p>
            </div>
        `;
        
        showResult('waiting', 'Scan Surbhi first');
    }
}

// Add event listeners with debouncing
surbhiInput.addEventListener('keydown', (e) => handleKeyDown(e, 'surbhi'));
surbhiInput.addEventListener('input', debounce(handleSurbhiInput, 100));
manufacturingInput.addEventListener('keydown', (e) => handleKeyDown(e, 'manufacturing'));
manufacturingInput.addEventListener('input', debounce(handleManufacturingInput, 100));

// Initialize
loadRecentScans();
loadHistory();
showResult('waiting', 'Scan Surbhi first');
currentField = 'surbhi';
surbhiInput.focus();
