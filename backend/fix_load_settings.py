import re

# 使用绝对路径（大写 AI）
file_path = r'd:\edge\分类\AI 笔记\backend\main.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 查找要替换的代码段
start_marker = '@app.get("/api/ai/settings/load")'
end_marker = 'raise HTTPException(status_code=500, detail=str(e))'

start_idx = content.find(start_marker)
if start_idx == -1:
    print('❌ 未找到 start_marker')
    exit(1)

# 找到 end_marker 后面的第一个空行
end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print('❌ 未找到 end_marker')
    exit(1)

# 找到函数结束的位置（end_marker 后的换行 + 空行）
end_of_function = content.find('\n\n', end_idx + len(end_marker))
if end_of_function == -1:
    end_of_function = end_idx + len(end_marker)

old_code = content[start_idx:end_of_function]

new_code = '''@app.get("/api/ai/settings/load")
async def load_ai_settings(http_request: Request):
    """加载用户的 AI 设置（只返回 keyTokens，不返回明文 API 密钥）"""
    try:
        user_id = await get_current_user(http_request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")

        user_settings = await get_user_ai_settings(user_id)
        if not user_settings:
            return {"settings": None}

        # 安全版本：只返回 keyTokens，不返回明文 apiKeys
        safe_settings = {
            "selectedApi": user_settings.get("selectedApi"),
            "keyTokens": user_settings.get("keyTokens", {}),
            "selectedModels": user_settings.get("selectedModels", {})
        }

        return {"settings": safe_settings}
    except HTTPException:
        raise
    except Exception as e:
        print(f"加载 AI 设置失败：{e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))'''

new_content = content[:start_idx] + new_code + content[end_of_function:]

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('✅ 修改成功！load_ai_settings 接口现在只返回 keyTokens')
print(f'替换了 {len(old_code)} 字符')
