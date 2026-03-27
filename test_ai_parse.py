import requests
import json

# 测试AI解析功能
url = "http://localhost:8000/api/parse-link-new"

# 测试数据
payload = {
    "url": "https://www.doubao.com/thread/w59890b84fed6ac63"
}

# 测试未登录状态（直接传递API Key）
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "sk-xxx",  # 替换为实际的API Key
    "X-AI-Platform": "siliconflow",
    "X-AI-Model": "deepseek-ai/DeepSeek-V3"
}

print("=== 测试AI解析功能 ===")
print(f"请求URL: {url}")
print(f"请求数据: {json.dumps(payload, indent=2)}")
print(f"请求头: {json.dumps(headers, indent=2)}")

response = requests.post(url, json=payload, headers=headers)

print(f"\n响应状态码: {response.status_code}")
print(f"响应内容: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")

if response.status_code == 200:
    result = response.json()
    if result.get("success"):
        print("\n=== 解析成功 ===")
        print(f"标题: {result.get('note', {}).get('title')}")
        print(f"分类: {result.get('category_path')}")
        print(f"标签: {result.get('note', {}).get('tags')}")
        print(f"是否本地解析: {result.get('is_local_parse')}")
    else:
        print("\n=== 解析失败 ===")
        print(f"错误信息: {result.get('error')}")
else:
    print("\n=== 请求失败 ===")
    print(f"错误: {response.text}")
