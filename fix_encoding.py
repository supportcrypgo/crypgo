import json

data = open('crypgo_dump.json', 'rb').read()
print(f'File size: {len(data)} bytes')

# Check for problematic bytes
problem_bytes = set()
for i, b in enumerate(data):
    if b >= 128:
        problem_bytes.add(b)
        
print(f'Problem bytes found: {[hex(b) for b in problem_bytes]}')

# Fix common Windows-1252 encoding issues
fixed = data.replace(b'\x96', b'--')   # en-dash
fixed = fixed.replace(b'\x92', b"'")    # right single quote
fixed = fixed.replace(b'\x91', b"'")    # left single quote
fixed = fixed.replace(b'\x93', b'"')    # left double quote
fixed = fixed.replace(b'\x94', b'"')    # right double quote
fixed = fixed.replace(b'\x97', b'---')  # em-dash
fixed = fixed.replace(b'\x85', b'...')  # ellipsis

open('crypgo_dump_fixed.json', 'wb').write(fixed)
print('Fixed file created')

# Verify it's valid JSON
try:
    json.loads(fixed.decode('utf-8'))
    print('JSON is valid!')
except json.JSONDecodeError as e:
    print(f'JSON decode error: {e}')