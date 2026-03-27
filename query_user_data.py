import os
from supabase import create_client

# 直接设置环境变量
os.environ["SUPABASE_URL"] = "https://fqvkiaowfzulpwodjobd.supabase.co"
# 使用 anon key（从 .env 文件）
os.environ["SUPABASE_ANON_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdmtpYW93Znp1bHB3b2Rqb2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjA2MDgsImV4cCI6MjA4OTczNjYwOH0.CshSFpLVEf3sLq7jnc0QhxB_8JtDdXTHaBbNjPveXYw"

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_ANON_KEY"]
)

user_id = "c5f655d6-d948-44dd-be75-08af9053952d"

# 查询 api_keys 表
print("=== API Keys 表 ===")
response = supabase.table("api_keys").select("*").eq("user_id", user_id).execute()
print(f"找到 {len(response.data)} 条记录:")
for record in response.data:
    print(f"  - platform: {record.get('platform')}, key_token: {record.get('key_token')}")

# 查询 ai_settings 表
print("\n=== AI Settings 表 ===")
response = supabase.table("ai_settings").select("*").eq("user_id", user_id).execute()
print(f"找到 {len(response.data)} 条记录:")
for record in response.data:
    settings_json = record.get("settings_json")
    print(f"  settings_json: {settings_json}")
    if isinstance(settings_json, str):
        import json
        try:
            parsed = json.loads(settings_json)
            print(f"    解析后：{parsed}")
            print(f"    keyTokens: {parsed.get('keyTokens', {})}")
        except:
            pass
    elif isinstance(settings_json, dict):
        print(f"    keyTokens: {settings_json.get('keyTokens', {})}")
