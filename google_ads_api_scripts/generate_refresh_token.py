# generate_refresh_token.py
import json
from google_auth_oauthlib.flow import Flow

import os
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Load your OAuth credentials from the JSON file you downloaded
CREDENTIALS_FILE = "client_secret.json"  # Update this path

# Check your OAuth client in Google Cloud Console for existing redirect URIs
# Common options:
REDIRECT_URI = "http://localhost:8080/callback"  # Add this to your OAuth client
# OR use one that's already configured in your OAuth client

SCOPES = ['https://www.googleapis.com/auth/adwords']

def show_oauth_client_info():
    """Helper to show what's in your OAuth client file"""
    with open(CREDENTIALS_FILE, 'r') as f:
        creds = json.load(f)
    
    client_type = 'web' if 'web' in creds else 'installed'
    client_info = creds[client_type]
    
    print("=" * 60)
    print("YOUR OAUTH CLIENT INFO:")
    print("=" * 60)
    print(f"Client ID: {client_info['client_id']}")
    print(f"App Type: {client_type}")
    
    if 'redirect_uris' in client_info:
        print("Configured Redirect URIs:")
        for uri in client_info['redirect_uris']:
            print(f"  - {uri}")
    else:
        print("No redirect URIs found in the JSON file")
    print("=" * 60)
    
    return client_info.get('redirect_uris', [])

def generate_refresh_token():
    # Show what's in your OAuth file first
    existing_uris = show_oauth_client_info()
    
    # Use existing URI if available, otherwise use localhost
    if existing_uris:
        redirect_uri = existing_uris[0]
        print(f"Using existing redirect URI: {redirect_uri}")
    else:
        redirect_uri = REDIRECT_URI
        print(f"Using default redirect URI: {redirect_uri}")
        print("Make sure you've added this URI to your OAuth client in Google Cloud Console!")
    
    # Load credentials from your JSON file
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE,
        scopes=SCOPES
    )
    flow.redirect_uri = redirect_uri
    
    # Get authorization URL
    auth_url, _ = flow.authorization_url(
        access_type='offline',  # This is crucial for getting refresh token
        include_granted_scopes='true',
        prompt='consent'  # Forces consent screen to show
    )
    
    print("\n" + "=" * 60)
    print("STEP 1: Visit this URL in your browser:")
    print(auth_url)
    print("=" * 60)
    print(f"\nSTEP 2: After authorizing, you'll be redirected to: {redirect_uri}")
    print("The page might not load (that's normal for localhost).")
    print("Copy the ENTIRE URL from your browser's address bar and paste it below.")
    print("=" * 60)
    
    # Get the authorization response
    authorization_response = input('\nPaste the full redirect URL here: ').strip()
    
    try:
        # Fetch the OAuth2 tokens
        flow.fetch_token(authorization_response=authorization_response)
        
        print("\n" + "=" * 60)
        print("SUCCESS! Your credentials:")
        print("=" * 60)
        print(f"CLIENT_ID: {flow.client_config['client_id']}")
        print(f"CLIENT_SECRET: {flow.client_config['client_secret']}")
        print(f"REFRESH_TOKEN: {flow.credentials.refresh_token}")
        print("=" * 60)
        print("\nAdd these to your environment variables:")
        print(f"GOOGLE_ADS_CLIENT_ID={flow.client_config['client_id']}")
        print(f"GOOGLE_ADS_CLIENT_SECRET={flow.client_config['client_secret']}")
        print(f"GOOGLE_ADS_REFRESH_TOKEN={flow.credentials.refresh_token}")
    
    except Exception as e:
        print(f"\nError: {e}")
        print("\nCommon issues:")
        print("1. Redirect URI mismatch - check your OAuth client configuration")
        print("2. Invalid authorization code - try generating a new auth URL")
        print("3. Network issues - check your internet connection")

if __name__ == "__main__":
    generate_refresh_token()