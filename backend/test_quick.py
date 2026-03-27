import asyncio
import httpx
import sys
sys.path.append('.')
from ai_service import API_CONFIGS

async def test_connection():
    platform = "siliconflow"  # 或 "openrouter", "zhipuai", "modelscope"
    api_key = input("请输入API密钥: ").strip()

    config = API_CONFIGS.get(platform)
    if not config:
        print(f"未知平台: {platform}")
        return

    print(f"\n测试 {config['name']} API连接...")
    print(f"URL: {config['base_url']}")
    print(f"模型: {config['default_model']}")

    headers = config['headers'](api_key)
    data = {
        "model": config['default_model'],
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 5
    }

    print(f"\n发送请求...")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            response = await client.post(config['base_url'], headers=headers, json=data)
            print(f"响应状态码: {response.status_code}")
            print(f"响应内容: {response.text[:500]}")
    except Exception as e:
        print(f"请求失败: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())