import json
import sys

print("=== 测试脚本开始 ===")
print(f"Python版本: {sys.version}")

# 模拟从数据库获取的设置
test_settings = {
    "user_id": "c5f655d6-d948-44dd-be75-08af9053952d",
    "settings_json": '{"selectedApi":"modelscope","apiKeys":{"siliconflow":"","openrouter":"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","zhipuai":"2cbbffbbb35547a4a68246121f6b973. BQjGJWwDGR71Hr","modelscope":"ms-2c623f2a-b8fa-40d8-9a71-0e7c0155116"},"selectedModels":{"siliconflow":"deepseek-ai/DeepSeek-V3","openrouter":"stepfun/step-3.5-flash:free","zhipuai":"glm-4.1V-Thinking-Flash","modelscope":"deepseek-ai/DeepSeek-R1-Distill-Qwen-32B"}}',
    "platform": "modelscope",
    "api_key": "ms-2c623f2a-b8fa-40d8-9a71-0e7c0155116",
    "model": "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
}

print("\n=== 测试解析settings_json ===")
settings_json = test_settings.get("settings_json")
print(f"settings_json: {settings_json}")

if settings_json:
    if isinstance(settings_json, str):
        try:
            parsed_settings = json.loads(settings_json)
            print("\n解析成功！")
            print(f"selectedApi: {parsed_settings.get('selectedApi')}")
            print(f"apiKeys: {parsed_settings.get('apiKeys')}")
            print(f"selectedModels: {parsed_settings.get('selectedModels')}")
            
            # 检查当前选中平台的API密钥
            selected_api = parsed_settings.get('selectedApi')
            api_keys = parsed_settings.get('apiKeys', {})
            api_key = api_keys.get(selected_api)
            print(f"\n当前选中平台: {selected_api}")
            print(f"对应的API密钥: {api_key[:15]}..." if api_key else "无API密钥")
            
        except json.JSONDecodeError as e:
            print(f"解析settings_json失败: {e}")
    else:
        print(f"settings_json不是字符串: {type(settings_json)}")
else:
    print("settings_json为None")

print("\n=== 测试降级逻辑 ===")
platform = test_settings.get("platform")
api_key = test_settings.get("api_key")
model = test_settings.get("model")
print(f"旧字段结构: platform={platform}, api_key={api_key[:15]}..." if api_key else "无API密钥")

# 测试模拟get_user_ai_settings函数
print("\n=== 测试模拟的get_user_ai_settings函数 ===")
def mock_get_user_ai_settings(data):
    settings_json = data.get("settings_json")
    if settings_json:
        if isinstance(settings_json, str):
            try:
                return json.loads(settings_json)
            except json.JSONDecodeError as e:
                print(f"解析settings_json失败: {e}")
        return settings_json
    # 降级到旧的字段结构
    platform = data.get("platform")
    api_key = data.get("api_key")
    model = data.get("model")
    if platform and api_key:
        return {
            "selectedApi": platform,
            "apiKeys": {platform: api_key},
            "selectedModels": {platform: model}
        }
    # 至少返回一个空的配置对象
    return {
        "selectedApi": "siliconflow",
        "apiKeys": {},
        "selectedModels": {}
    }

result = mock_get_user_ai_settings(test_settings)
print(f"函数返回结果: {result}")

# 测试从返回结果中提取API密钥
print("\n=== 测试提取API密钥 ===")
selected_api = result.get("selectedApi")
api_keys = result.get("apiKeys", {})
api_key = api_keys.get(selected_api)
print(f"selectedApi: {selected_api}")
print(f"apiKeys: {api_keys}")
print(f"提取的API密钥: {api_key[:15]}..." if api_key else "无API密钥")

print("\n=== 测试脚本结束 ===")
