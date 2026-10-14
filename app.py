from flask import Flask, render_template, request, jsonify
from datetime import datetime

app = Flask(__name__)

# In-memory storage for recent scans (last 5)
recent_scans = []

# In-memory storage for history
history = []


def validate_surbhi_format(data):
    """Validate Surbhi Sticker Format: VPN$lotcode$datecode$qty"""
    if not data or not isinstance(data, str):
        return {'valid': False, 'error': 'Surbhi sticker data is empty'}
    
    parts = data.split('$')
    if len(parts) != 4:
        return {'valid': False, 'error': 'Surbhi sticker must have format: VPN$lotcode$datecode$qty'}
    
    for i, part in enumerate(parts):
        if not part or part.strip() == '':
            return {'valid': False, 'error': f'Part {i+1} is empty in Surbhi sticker'}
    
    return {'valid': True, 'vpn': parts[0]}


def validate_manufacturing_format(data):
    """Validate Manufacturing Sticker Format: VPN only"""
    if not data or not isinstance(data, str):
        return {'valid': False, 'error': 'Manufacturing sticker data is empty'}
    
    if '$' in data:
        return {'valid': False, 'error': 'Manufacturing sticker must contain only VPN (no $ allowed)'}
    
    if data.strip() == '':
        return {'valid': False, 'error': 'Manufacturing sticker VPN is empty'}
    
    return {'valid': True, 'vpn': data.strip()}


@app.route('/')
def index():
    """Main verification page"""
    return render_template('index.html', recent_scans=recent_scans)


@app.route('/api/verify', methods=['POST'])
def verify():
    """Verify VPNs from both stickers - Always returns JSON"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data received',
                'result': 'FAIL',
                'error': 'empty_request'
            }), 400
        
        surbhi_data = data.get('surbhi', '').strip()
        manufacturing_data = data.get('manufacturing', '').strip()
        
        # Validate Surbhi
        surbhi_validation = validate_surbhi_format(surbhi_data)
        if not surbhi_validation['valid']:
            result = {
                'success': False,
                'message': f'Invalid Surbhi Sticker: {surbhi_validation["error"]}',
                'result': 'FAIL'
            }
            history.append({
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'surbhi': surbhi_data,
                'manufacturing': manufacturing_data,
                'success': False,
                'error': surbhi_validation['error'],
                'result': 'FAIL'
            })
            return jsonify(result), 400
        
        # Validate Manufacturing
        manufacturing_validation = validate_manufacturing_format(manufacturing_data)
        if not manufacturing_validation['valid']:
            result = {
                'success': False,
                'message': f'Invalid Manufacturing Sticker: {manufacturing_validation["error"]}',
                'result': 'FAIL'
            }
            history.append({
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'surbhi': surbhi_data,
                'manufacturing': manufacturing_data,
                'success': False,
                'error': manufacturing_validation['error'],
                'result': 'FAIL'
            })
            return jsonify(result), 400
        
        # Compare VPNs
        surbhi_vpn = surbhi_validation['vpn']
        manufacturing_vpn = manufacturing_validation['vpn']
        is_match = surbhi_vpn == manufacturing_vpn
        
        result_message = 'PASS: VPNs match!' if is_match else f'FAIL: VPN mismatch! Surbhi: {surbhi_vpn}, Manufacturing: {manufacturing_vpn}'
        result_type = 'PASS' if is_match else 'FAIL'
        
        # Save to recent scans (last 5)
        recent_scans.insert(0, {
            'vpn': surbhi_vpn,
            'result': result_type,
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        recent_scans = recent_scans[:5]
        
        # Save to history
        history.append({
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'surbhi': surbhi_data,
            'manufacturing': manufacturing_data,
            'vpn': surbhi_vpn,
            'success': is_match,
            'result': result_type
        })
        history = history[:50]
        
        return jsonify({
            'success': is_match,
            'message': result_message,
            'result': result_type,
            'vpn': surbhi_vpn,
            'recent_scans': recent_scans
        })
    
    except Exception as e:
        # Always return JSON even on error
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}',
            'result': 'FAIL',
            'error': 'server_error'
        }), 500


@app.route('/api/recent-scans')
def get_recent_scans():
    """Get last 5 recent scans - Always returns JSON"""
    try:
        return jsonify(recent_scans)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/history')
def get_history():
    """Get verification history - Always returns JSON"""
    try:
        return jsonify(history)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/validate-surbhi', methods=['POST'])
def validate_surbhi():
    """Validate Surbhi sticker format - Always returns JSON"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'valid': False, 'error': 'No data received'}), 400
        
        surbhi_data = data.get('data', '').strip()
        validation = validate_surbhi_format(surbhi_data)
        return jsonify(validation)
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 500


@app.route('/api/validate-manufacturing', methods=['POST'])
def validate_manufacturing():
    """Validate Manufacturing sticker format - Always returns JSON"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'valid': False, 'error': 'No data received'}), 400
        
        manufacturing_data = data.get('data', '').strip()
        validation = validate_manufacturing_format(manufacturing_data)
        return jsonify(validation)
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000, debug=False)
