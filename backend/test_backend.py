import requests
import sys

try:
    r = requests.get('http://localhost:8000/health', timeout=5)
    print(f"Health check: {r.status_code} - {r.text}")
except Exception as e:
    print(f"连接失败: {e}")

try:
    r = requests.post('http://localhost:8000/api/test-api-connection',
                      json={'platform': 'siliconflow', 'api_key': 'sk-test', 'model': 'deepseek-ai/DeepSeek-V3'},
                      timeout=10)
    print(f"Test API: {r.status_code} - {r.text}")
except Exception as e:
    print(f"Test API 失败: {e}")