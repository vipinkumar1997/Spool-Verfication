// Spool Sticker Verification System
// Surbhi Sticker Format: VPN$lotcode$datecode$qty
// Manufacturing Sticker Format: VPN only

const historyList = document.getElementById('historyList');
const resultDiv = document.getElementById('result');

// Load history from localStorage
function loadHistory() {
    const history = JSON.parse(localStorage.getItem('stickerVerificationHistory')) || [];
    historyList.innerHTML = history.map(item => 
        `<li class="${item.success ? 'success' : 'error'}">
            ${new Date(item.timestamp).toLocaleString()} - 
            ${item.success ? '✅ Match' : '❌ ' + (item.error || 'No Match')} - 
            Surbhi: ${item.surbhi || 'empty'}, Manufacturing: ${item.manufacturing || 'empty'}
        </li>`
    ).join('');
}

// Save to history
function saveToHistory(surbhiData, manufacturingData, success, error = '') {
    const history = JSON.parse(localStorage.getItem('stickerVerificationHistory')) || [];
    history.unshift({
        surbhi: surbhiData,
        manufacturing: manufacturingData,
        success,
        error,
        timestamp: new Date().toISOString()
    });
    // Keep last 50 entries
    if (history.length > 50) {
        history.pop();
    }
    localStorage.setItem('stickerVerificationHistory', JSON.stringify(history));
    loadHistory();
}

// Validate Surbhi Sticker format: VPN$lotcode$datecode$qty
function validateSurbhiFormat(data) {
    if (!data || typeof data !== 'string') {
        return { valid: false, error: 'Surbhi sticker data is empty' };
    }
    
    const parts = data.split('$');
    
    // Must have exactly 4 parts
    if (parts.length !== 4) {
        return { valid: false, error: 'Surbhi sticker must have format: VPN$lotcode$datecode$qty' };
    }
    
    // Check each part is not empty
    for (let i = 0; i < parts.length; i++) {
        if (!parts[i] || parts[i].trim() === '') {
            return { valid: false, error: `Part ${i + 1} is empty in Surbhi sticker` };
        }
    }
    
    return { valid: true, vpn: parts[0], parts };
}

// Validate Manufacturing Sticker format: VPN only
function validateManufacturingFormat(data) {
    if (!data || typeof data !== 'string') {
        return { valid: false, error: 'Manufacturing sticker data is empty' };
    }
    
    // Must not contain $ character (only VPN)
    if (data.includes('$')) {
        return { valid: false, error: 'Manufacturing sticker must contain only VPN (no $ allowed)' };
    }
    
    // Must not be empty after trimming
    if (data.trim() === '') {
        return { valid: false, error: 'Manufacturing sticker VPN is empty' };
    }
    
    return { valid: true, vpn: data.trim() };
}

// Extract VPN from data
function extractVPN(data, type) {
    if (type === 'surbhi') {
        const validation = validateSurbhiFormat(data);
        if (!validation.valid) {
            return { vpn: null, error: validation.error };
        }
        return { vpn: validation.vpn, error: null };
    } else if (type === 'manufacturing') {
        const validation = validateManufacturingFormat(data);
        if (!validation.valid) {
            return { vpn: null, error: validation.error };
        }
        return { vpn: validation.vpn, error: null };
    }
    return { vpn: null, error: 'Invalid sticker type' };
}

// Verify if VPNs from both stickers match
function verifyStickers() {
    const surbhiData = document.getElementById('surbhiSticker').value.trim();
    const manufacturingData = document.getElementById('manufacturingSticker').value.trim();
    
    // Validate Surbhi sticker
    const surbhiValidation = validateSurbhiFormat(surbhiData);
    if (!surbhiValidation.valid) {
        showResult('error', `❌ Invalid Surbhi Sticker Format: ${surbhiValidation.error}`);
        saveToHistory(surbhiData, manufacturingData, false, `Invalid Surbhi: ${surbhiValidation.error}`);
        return;
    }
    
    // Validate Manufacturing sticker
    const manufacturingValidation = validateManufacturingFormat(manufacturingData);
    if (!manufacturingValidation.valid) {
        showResult('error', `❌ Invalid Manufacturing Sticker Format: ${manufacturingValidation.error}`);
        saveToHistory(surbhiData, manufacturingData, false, `Invalid Manufacturing: ${manufacturingValidation.error}`);
        return;
    }
    
    // Extract VPNs
    const surbhiVPN = surbhiValidation.vpn;
    const manufacturingVPN = manufacturingValidation.vpn;
    
    // Compare VPNs (case-sensitive as per requirement)
    const isMatch = surbhiVPN === manufacturingVPN;
    
    if (isMatch) {
        showResult('success', `✅ SUCCESS! VPNs match: ${surbhiVPN}`);
        saveToHistory(surbhiData, manufacturingData, true);
    } else {
        showResult('error', `❌ VPNs do not match!<br>Surbhi VPN: ${surbhiVPN}<br>Manufacturing VPN: ${manufacturingVPN}`);
        saveToHistory(surbhiData, manufacturingData, false, `VPN mismatch: ${surbhiVPN} vs ${manufacturingVPN}`);
    }
}

// Show result with animation
function showResult(type, message) {
    resultDiv.className = `result ${type}`;
    resultDiv.innerHTML = message;
    
    // Scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

// Allow Enter key to trigger verification
function handleKeyPress(e) {
    if (e.key === 'Enter') {
        verifyStickers();
    }
}

// Add event listeners
document.getElementById('surbhiSticker').addEventListener('keypress', handleKeyPress);
document.getElementById('manufacturingSticker').addEventListener('keypress', handleKeyPress);

// Initialize
loadHistory();
showResult('waiting', 'Enter both sticker data and click verify');
