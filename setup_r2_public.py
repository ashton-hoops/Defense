#!/usr/bin/env python3
"""
Enable public access on R2 bucket so videos can be streamed.
Run this once to configure the bucket.
"""

import boto3
import json
from pathlib import Path

# Load R2 credentials
r2_config = {}
r2_env_path = Path('.env.r2')
if r2_env_path.exists():
    with open(r2_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                r2_config[key] = value

if not r2_config:
    print("❌ R2 config not found in .env.r2")
    exit(1)

# Create R2 client
s3 = boto3.client(
    's3',
    endpoint_url=f"https://{r2_config['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
    aws_access_key_id=r2_config['R2_ACCESS_KEY_ID'],
    aws_secret_access_key=r2_config['R2_SECRET_ACCESS_KEY'],
    region_name='auto'
)

bucket_name = r2_config['R2_BUCKET_NAME']

# Create public read policy
public_policy = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": ["s3:GetObject"],
            "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
        }
    ]
}

try:
    print(f"🔓 Setting public read policy on bucket '{bucket_name}'...")
    s3.put_bucket_policy(
        Bucket=bucket_name,
        Policy=json.dumps(public_policy)
    )
    print(f"✅ Bucket '{bucket_name}' is now publicly readable!")
    print(f"📹 Videos will be accessible at: {r2_config['R2_PUBLIC_URL']}/filename.mp4")
except Exception as e:
    print(f"❌ Failed to set bucket policy: {e}")
    print("\n⚠️  You may need to enable public access in Cloudflare dashboard:")
    print(f"   1. Go to https://dash.cloudflare.com")
    print(f"   2. Navigate to R2 → {bucket_name}")
    print(f"   3. Go to Settings → Public Access")
    print(f"   4. Enable 'Allow Access' or connect a custom domain")
