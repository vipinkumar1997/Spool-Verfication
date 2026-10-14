// Spool Sticker Verification System - Ultra Fast Python Flask
// Surbhi Sticker Format: VPN$lotcode$datecode$qty
// Manufacturing Sticker Format: VPN only

const historyList = document.getElementById('historyList');
const resultDiv = document.getElementById('result');
const recentScansDiv = document.getElementById('recentScans');
const surbhiInput = document.getElementById('surbhiSticker');
const manufacturingInput = document.getElementById('manufacturingSticker');
const verifyBtn = document.getElementById('verifyBtn');
const surbhiStatus = document.getElementById('surbhiStatus');
const manufacturingStatus = document.getElementById('manufacturingStatus');

// Load recent scans from server
async function loadRecentScans() {
    try {
        const response = await fetch('/api/recent-scans');
        const scans = await response.json();
        updateRecentScansDisplay(scans);
    } catch (error) {
        console.error('Error loading recent scans:', error);
    }
}

// Load history from server
async function loadHistory() {
    try {
        const response = await fetch('/api/history');
        const history = await response.json();
        historyList.innerHTML = history.map(item => 
            `<li class="${item.success ? 'success' : 'error'}">
                ${new Date(item.timestamp).toLocaleString()} - 
                ${item.success ? '✅ PASS' : '❌ FAIL'} - 
                VPN: ${item.vpn || 'N/A'}
            </li>`
        ).join('');
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Update the live display of recent scans
function updateRecentScansDisplay(scans) {
    if (!scans || scans.length === 0) {
        recentScansDiv.innerHTML = '<p class="no-scans">No spools scanned yet</p>';
        return;
    }
    
    recentScansDiv.innerHTML = scans.map((scan, index) => `
        <div class="scan-item">
            <span class="scan-number">#${scans.length - index}</span>
            <span class="scan-vpn">${scan.vpn}</span>
            <span class="scan-result ${scan.result}">${scan.result === 'PASS' ? '✅' : '❌'}</span>
            <span class="scan-time">${new Date(scan.timestamp).toLocaleTimeString()}</span>
        </div>
    `).join('');
}

// Validate Surbhi input in real-time
async function validateSurbhi() {
    const data = surbhiInput.value.trim();
    
    try {
        const response = await fetch('/api/validate-surbhi', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({data: data})
        });
        const validation = await response.json();
        
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
    } catch (error) {
        console.error('Validation error:', error);
    }
    
    updateVerifyButton();
}

// Validate Manufacturing input in real-time
async function validateManufacturing() {
    const data = manufacturingInput.value.trim();
    
    try {
        const response = await fetch('/api/validate-manufacturing', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({data: data})
        });
        const validation = await response.json();
        
        if (validation.valid) {
            manufacturingStatus.textContent = '✅ Valid';
            manufacturingStatus.className = 'status valid';
        } else {
            manufacturingStatus.textContent = '❌ ' + validation.error;
            manufacturingStatus.className = 'status invalid';
        }
    } catch (error) {
        console.error('Validation error:', error);
    }
    
    updateVerifyButton();
}

// Update verify button state
function updateVerifyButton() {
    const surbhiValid = surbhiInput.value.trim() !== '';
    const manufacturingValid = manufacturingInput.value.trim() !== '';
    verifyBtn.disabled = !(surbhiValid && manufacturingValid);
}

// Ultra fast verification
async function verifyStickers() {
    const surbhiData = surbhiInput.value.trim();
    const manufacturingData = manufacturingInput.value.trim();
    
    verifyBtn.disabled = true;
    verifyBtn.textContent = '⏳ Verifying...';
    
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
        
        if (result.success) {
            showResult('success', '✅ PASS: VPNs match!');
        } else {
            showResult('error', result.message);
        }
        
        // Load updated data
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
            verifyBtn.textContent = '⚡ Verify';
        }, 1000);
    }
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
            if (surbhiInput.value.trim() !== '') {
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
loadRecentScans();
loadHistory();
showResult('waiting', 'Scan Surbhi sticker first');
