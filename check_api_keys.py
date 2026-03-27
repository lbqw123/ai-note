import os
import sys
from pathlib import Path

# 获取当前目录
current_dir = Path(__file__).parent
env_path = current_dir / ".env"

print(f"Reading .env from: {env_path}")

# 手动解析 .env 文件
if env_path.exists():
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

from supabase import create_client

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_key:
    supabase_key = os.getenv("SUPABASE_ANON_KEY")

print(f"Connecting to: {supabase_url}")

supabase = create_client(supabase_url, supabase_key)

# 获取当前用户的 api_keys
# 注意：这里需要用户 ID，我们先获取所有记录看看
response = supabase.table("api_keys").select("*").limit(10).execute()

print(f"\n找到的 API 密钥记录:")
for record in response.data:
    print(f"  - user_id: {record.get('user_id')}, platform: {record.get('platform')}, key_token: {record.get('key_token')}")

# 获取 ai_settings 表
response = supabase.table("ai_settings").select("*").limit(10).execute()

print(f"\n找到的 AI 设置记录:")
for record in response.data:
    print(f"  - user_id: {record.get('user_id')}, settings_json: {record.get('settings_json')}")
