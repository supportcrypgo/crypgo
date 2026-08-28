import json
import os
from pathlib import Path
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

credentials_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'Crypgo-secrets' / 'google-client-secret.json'
token_path = Path.home() / 'Crypgo-secrets' / 'gmail_refresh_token.txt'
if not credentials_path.exists():
    raise SystemExit(f'Credential file not found: {credentials_path}')

with credentials_path.open(encoding='utf-8') as credentials_file:
    client_config = json.load(credentials_file)

flow = InstalledAppFlow.from_client_secrets_file(
    str(credentials_path),
    scopes=['https://www.googleapis.com/auth/gmail.send']
)

# This will open a browser window for authorization
creds = flow.run_local_server(port=8080)

print(f"Refresh Token: {creds.refresh_token}")
print(f"Access Token: {creds.token}")

# Save to file for reference
client = client_config.get('installed') or client_config.get('web') or {}
with token_path.open('w', encoding='utf-8') as f:
    f.write(f"REFRESH_TOKEN={creds.refresh_token}\n")
    f.write(f"ACCESS_TOKEN={creds.token}\n")
    f.write(f"CLIENT_ID={client.get('client_id', '')}\n")
    f.write('CLIENT_SECRET=stored-in-google-client-secret.json\n')

print(f"\nTokens saved to {token_path}")