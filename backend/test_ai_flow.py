import asyncio
import httpx

async def test_ai_flow():
    """测试AI调用流程"""
    
    # 1. 测试后端是否正常运行
    print("=" * 50)
    print("步骤1: 测试后端连接")
    print("=" * 50)
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:8000/health")
            print(f"后端状态: {response.status_code}")
            print(f"后端响应: {response.json()}")
    except Exception as e:
        print(f"后端连接失败: {e}")
        return
    
    # 2. 测试AI连接
    print("\n" + "=" * 50)
    print("步骤2: 测试AI连接")
    print("=" * 50)
    
    # 使用测试密钥（请替换为真实的密钥）
    test_api_key = "sk-test-key-1234567890"  # 替换为真实密钥
    test_platform = "siliconflow"
    test_model = "deepseek-ai/DeepSeek-V3"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://localhost:8000/api/test-api-connection",
                json={
                    "platform": test_platform,
                    "api_key": test_api_key,
                    "model": test_model
                }
            )
            print(f"测试连接状态: {response.status_code}")
            print(f"测试连接响应: {response.json()}")
    except Exception as e:
        print(f"测试连接失败: {e}")
    
    # 3. 测试链接解析
    print("\n" + "=" * 50)
    print("步骤3: 测试链接解析")
    print("=" * 50)
    
    test_url = "https://www.doubao.com/test"  # 测试链接
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "http://localhost:8000/api/parse-link-new",
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": test_api_key,
                    "X-AI-Platform": test_platform,
                    "X-AI-Model": test_model
                },
                json={"url": test_url}
            )
            print(f"链接解析状态: {response.status_code}")
            result = response.json()
            print(f"是否成功: {result.get('success')}")
            print(f"是否本地解析: {result.get('is_local_parse')}")
            print(f"标题: {result.get('note', {}).get('title')}")
            print(f"分类: {result.get('category_path')}")
            print(f"标签: {result.get('note', {}).get('tags')}")
    except Exception as e:
        print(f"链接解析失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_ai_flow())