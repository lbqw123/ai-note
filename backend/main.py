import sys
import io

# 设置 Windows 控制台编码为 UTF-8，支持 emoji 显示
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import httpx
import uuid
import re
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
import base64
from dotenv import load_dotenv
from supabase import create_client, Client

from ai_service import AIService

load_dotenv()


def clean_unicode(text: str) -> str:
    """清理字符串中的无效 Unicode 字符（surrogates）"""
    if not isinstance(text, str):
        return str(text) if text else ""
    # 移除 surrogate characters (U+D800-U+DFFF)
    return text.encode('utf-8', 'surrogatepass').decode('utf-8', 'ignore')

app = FastAPI(
    title=os.getenv("APP_NAME", "AI链接智能笔记系统"),
    version=os.getenv("APP_VERSION", "1.0.0")
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def block_raw_api_key(request, call_next):
    """拦截直接传递API密钥的请求"""
    if "X-API-Key" in request.headers:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=403, content={"msg": "非法请求，密钥已安全重构"})
    return await call_next(request)

ai_service = AIService()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# 加密密钥（应该从环境变量获取）
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "your-encryption-key-here")

def encrypt_api_key(api_key):
    """加密API密钥"""
    backend = default_backend()
    key = ENCRYPTION_KEY.encode('utf-8')[:32]  # AES-256需要32字节密钥
    iv = os.urandom(16)  # 生成16字节随机IV
    
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=backend)
    encryptor = cipher.encryptor()
    
    # 对数据进行填充
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(api_key.encode('utf-8')) + padder.finalize()
    
    encrypted = encryptor.update(padded_data) + encryptor.finalize()
    
    return {
        'encrypted_key': base64.b64encode(encrypted).decode('utf-8'),
        'iv': base64.b64encode(iv).decode('utf-8')
    }

def decrypt_api_key(encrypted_key, iv):
    """解密API密钥"""
    backend = default_backend()
    key = ENCRYPTION_KEY.encode('utf-8')[:32]
    
    encrypted = base64.b64decode(encrypted_key)
    iv_bytes = base64.b64decode(iv)
    
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv_bytes), backend=backend)
    decryptor = cipher.decryptor()
    
    decrypted = decryptor.update(encrypted) + decryptor.finalize()
    
    # 移除填充
    unpadder = padding.PKCS7(128).unpadder()
    data = unpadder.update(decrypted) + unpadder.finalize()
    
    return data.decode('utf-8')

def decrypt_api_key_simple(encrypted_key: str, iv: str) -> str:
    """解密前端传递的API密钥（简单XOR加密）"""
    try:
        key = 'AI_Notes_Secret_Key_2024!@#'
        encrypted = base64.b64decode(encrypted_key).decode('utf-8')
        
        decrypted = ''
        for i in range(len(encrypted)):
            char_code = ord(encrypted[i]) ^ ord(key[i % len(key)])
            decrypted += chr(char_code)
        
        return decrypted
    except Exception as e:
        print(f">>> [ERROR] 简单解密API密钥失败: {e}")
        raise e

def generate_key_token():
    """生成唯一的key_token"""
    return f"tk_{uuid.uuid4().hex[:16]}"


class LinkParseRequest(BaseModel):
    url: str


class TestConnectionRequest(BaseModel):
    platform: str
    api_key: str
    model: str = None


class AIRecommendRequest(BaseModel):
    current_note: dict
    candidate_notes: list
    folders: list


class APIKeySaveRequest(BaseModel):
    platform: str
    api_key: str
    model: str = None


class GenerateMindmapRequest(BaseModel):
    content: str
    title: str = ""


class APIKeyResponse(BaseModel):
    key_token: str
    platform: str


async def get_current_user(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.replace("Bearer ", "")
    
    try:
        import jwt
        decoded = jwt.decode(token, options={"verify_signature": False})
        user_id = decoded.get("sub")
        if user_id:
            return user_id
    except Exception as e:
        print(f"解析JWT token失败: {e}")
        return None
    
    return None


async def get_api_key_from_token(key_token: str, user_id: str = None) -> Optional[str]:
    """通过key_token获取API密钥"""
    try:
        # 检查key_token是否有效
        if not key_token:
            print(f">>> [DEBUG] key_token为空，跳过查询")
            return None
        
        if user_id:
            response = supabase.table("api_keys").select("*").eq("key_token", key_token).eq("user_id", user_id).execute()
            print(f">>> [DEBUG] 数据库查询结果: data={response.data}")
            if response.data and len(response.data) > 0:
                encrypted_key = response.data[0]["encrypted_key"]
                iv = response.data[0]["iv"]
                print(f">>> [DEBUG] encrypted_key长度: {len(encrypted_key) if encrypted_key else 0}")
                print(f">>> [DEBUG] iv: {iv}")
                try:
                    api_key = decrypt_api_key(encrypted_key, iv)
                    print(f">>> [DEBUG] 解密成功, api_key长度: {len(api_key) if api_key else 0}")
                    return api_key
                except Exception as decrypt_err:
                    print(f">>> [DEBUG] 解密失败: {decrypt_err}")
                    import traceback
                    traceback.print_exc()
                    return None
        else:
            pass
    except Exception as e:
        print(f"获取API密钥失败: {e}")
        import traceback
        traceback.print_exc()
    return None


async def get_api_key_from_db(platform: str, user_id: str) -> Optional[str]:
    """直接从数据库通过平台和用户ID获取API密钥"""
    try:
        if not user_id or not platform:
            print(f">>> [DEBUG] user_id或platform为空")
            return None
        
        response = supabase.table("api_keys").select("*").eq("platform", platform).eq("user_id", user_id).execute()
        print(f">>> [DEBUG] 从数据库查询API密钥: platform={platform}, data={response.data}")
        
        if response.data and len(response.data) > 0:
            encrypted_key = response.data[0]["encrypted_key"]
            iv = response.data[0]["iv"]
            print(f">>> [DEBUG] encrypted_key长度: {len(encrypted_key) if encrypted_key else 0}")
            print(f">>> [DEBUG] iv: {iv}")
            try:
                api_key = decrypt_api_key(encrypted_key, iv)
                print(f">>> [DEBUG] 解密成功, api_key长度: {len(api_key) if api_key else 0}")
                return api_key
            except Exception as decrypt_err:
                print(f">>> [DEBUG] 解密失败: {decrypt_err}")
                import traceback
                traceback.print_exc()
                return None
        else:
            print(f">>> [DEBUG] 数据库中没有找到该平台的API密钥")
    except Exception as e:
        print(f"从数据库获取API密钥失败: {e}")
        import traceback
        traceback.print_exc()
    return None


async def get_user_ai_settings(user_id: str) -> Optional[dict]:
    try:
        response = supabase.table("ai_settings").select("*").eq("user_id", user_id).execute()
        if response.data and len(response.data) > 0:
            data = response.data[0]
            settings_json = data.get("settings_json")
            if settings_json:
                if isinstance(settings_json, str):
                    try:
                        parsed = json.loads(settings_json)
                        # 移除apiKeys字段，只保留配置信息
                        if "apiKeys" in parsed:
                            del parsed["apiKeys"]
                        return parsed
                    except json.JSONDecodeError as e:
                        print(f"解析settings_json失败: {e}")
                else:
                    # 如果是字典，也移除apiKeys字段
                    if "apiKeys" in settings_json:
                        del settings_json["apiKeys"]
                    return settings_json
            # 降级到旧的字段结构
            platform = data.get("platform")
            model = data.get("model")
            if platform:
                return {
                    "selectedApi": platform,
                    "selectedModels": {platform: model}
                }
            # 至少返回一个空的配置对象
            return {
                "selectedApi": "siliconflow",
                "keyTokens": {},
                "selectedModels": {}
            }
    except Exception as e:
        print(f"获取用户AI设置失败: {e}")
    return None


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/api/test-api-connection")
async def test_api_connection(request: TestConnectionRequest):
    try:
        result = await ai_service.test_api_connection(request.platform, request.api_key, request.model)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/parse-link-new")
async def parse_link_new(request: LinkParseRequest, http_request: Request):
    try:
        print(f"=" * 50)
        print(f"解析链接: {request.url}")
        print(f"=" * 50)
        
        user_id = await get_current_user(http_request)
        
        api_key = None
        ai_platform = None
        ai_model = None
        
        # 从请求头获取key_token和加密的API密钥
        key_token = http_request.headers.get('X-Key-Token')
        encrypted_api_key = http_request.headers.get('X-Encrypted-API-Key')
        api_key_iv = http_request.headers.get('X-API-Key-IV')
        ai_platform = http_request.headers.get('X-AI-Platform')
        ai_model = http_request.headers.get('X-AI-Model')
        
        if key_token:
            # 登录用户：通过key_token从数据库获取API密钥
            api_key = await get_api_key_from_token(key_token, user_id)
            print(f">>> [DEBUG] 从key_token获取API密钥完成, api_key={'有值' if api_key else 'None'}")
        elif encrypted_api_key and api_key_iv:
            # 未登录用户：直接解密传递的API密钥（使用简单解密）
            try:
                api_key = decrypt_api_key_simple(encrypted_api_key, api_key_iv)
                print(f">>> [DEBUG] 未登录用户，从请求头解密API密钥完成, api_key={'有值' if api_key else 'None'}")
            except Exception as e:
                print(f">>> [ERROR] 解密API密钥失败: {e}")
                api_key = None
        elif user_id:
            print(f">>> [DEBUG] 已登录用户: {user_id}")
            user_settings = await get_user_ai_settings(user_id)
            if user_settings:
                selected_api = user_settings.get("selectedApi", "siliconflow")
                key_tokens = user_settings.get("keyTokens", {})
                selected_models = user_settings.get("selectedModels", {})
                
                key_token = key_tokens.get(selected_api)
                if key_token:
                    api_key = await get_api_key_from_token(key_token, user_id)
                    print(f">>> [DEBUG] 从key_token获取API密钥完成, api_key={'有值' if api_key else 'None'}")
                else:
                    # 如果key_token不存在，尝试直接从数据库获取API密钥
                    print(f">>> [DEBUG] key_token不存在，尝试直接从数据库获取API密钥")
                    api_key = await get_api_key_from_db(selected_api, user_id)
                    print(f">>> [DEBUG] 从数据库直接获取API密钥完成, api_key={'有值' if api_key else 'None'}")
                ai_platform = selected_api
                ai_model = selected_models.get(selected_api)
                print(f">>> [DEBUG] 从数据库获取用户AI设置: platform={ai_platform}, model={ai_model}")
            else:
                print(f">>> [DEBUG] 用户未配置AI设置")
        
        print(f">>> [DEBUG] API平台: {ai_platform}")
        print(f">>> [DEBUG] API模型: {ai_model}")
        
        parse_result = await ai_service.parse_ai_link(request.url, api_key, [], ai_platform, ai_model)
        
        # 确保 parse_result 不为 None
        if not parse_result:
            return {
                "success": False,
                "error": "解析结果为空"
            }
        
        print(f"解析结果标题: {parse_result.get('title', 'N/A')}")
        print(f"解析结果分类: {parse_result.get('category_path', 'N/A')}")
        
        content = clean_unicode(parse_result.get('content', ''))
        mindmap = None
        
        category_path = clean_unicode(parse_result.get('category_path', '未分类'))
        title = clean_unicode(parse_result.get('title', '未命名'))
        tags = [clean_unicode(tag) for tag in parse_result.get('tags', [])]
        platform = clean_unicode(parse_result.get('platform', 'unknown'))
        summary = clean_unicode(parse_result.get('summary', ''))
        
        return {
            "success": True,
            "note": {
                "id": "parsed_note",
                "title": title,
                "content": content,
                "folder_id": "parsed_folder",
                "tags": tags,
                "source_url": request.url,
                "source_platform": platform,
                "summary": summary,
                "created_at": "2025-01-01T00:00:00",
                "updated_at": "2025-01-01T00:00:00"
            },
            "category_path": category_path,
            "is_local_parse": parse_result.get('is_local_parse', False),
            "mindmap": mindmap,
            "mindmap_markdown": content
        }
    except Exception as e:
        print(f"解析链接失败: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": f"解析失败: {str(e)}"
        }


@app.post("/api/ai-recommend-notes")
async def ai_recommend_notes(request: AIRecommendRequest, http_request: Request):
    try:
        print(f"=" * 50)
        print(f"AI推荐笔记分析")
        print(f"=" * 50)
        
        user_id = await get_current_user(http_request)
        
        api_key = None
        ai_platform = None
        ai_model = None
        
        # 从请求头获取key_token和加密的API密钥
        key_token = http_request.headers.get('X-Key-Token')
        encrypted_api_key = http_request.headers.get('X-Encrypted-API-Key')
        api_key_iv = http_request.headers.get('X-API-Key-IV')
        ai_platform = http_request.headers.get('X-AI-Platform')
        ai_model = http_request.headers.get('X-AI-Model')
        
        if key_token:
            # 登录用户：通过key_token从数据库获取API密钥
            api_key = await get_api_key_from_token(key_token, user_id)
            print(f">>> [DEBUG] 从key_token获取API密钥")
        elif encrypted_api_key and api_key_iv:
            # 未登录用户：直接解密传递的API密钥（使用简单解密）
            try:
                api_key = decrypt_api_key_simple(encrypted_api_key, api_key_iv)
                print(f">>> [DEBUG] 未登录用户，从请求头解密API密钥完成")
            except Exception as e:
                print(f">>> [ERROR] 解密API密钥失败: {e}")
                api_key = None
        elif user_id:
            print(f">>> [DEBUG] 已登录用户: {user_id}")
            user_settings = await get_user_ai_settings(user_id)
            if user_settings:
                selected_api = user_settings.get("selectedApi", "siliconflow")
                key_tokens = user_settings.get("keyTokens", {})
                selected_models = user_settings.get("selectedModels", {})
                
                key_token = key_tokens.get(selected_api)
                if key_token:
                    api_key = await get_api_key_from_token(key_token, user_id)
                ai_platform = selected_api
                ai_model = selected_models.get(selected_api)
                print(f">>> [DEBUG] 从数据库获取用户AI设置: platform={ai_platform}, model={ai_model}")
            else:
                print(f">>> [DEBUG] 用户未配置AI设置")
        
        if not api_key:
            return {
                "success": False,
                "error": "未配置API密钥",
                "recommendations": []
            }
        
        print(f">>> [DEBUG] API平台: {ai_platform}")
        print(f">>> [DEBUG] API模型: {ai_model}")
        print(f">>> [DEBUG] 当前笔记: {request.current_note.get('title', 'N/A')}")
        print(f">>> [DEBUG] 候选笔记数量: {len(request.candidate_notes)}")
        
        current_note = request.current_note
        candidate_notes = request.candidate_notes
        folders = request.folders
        
        folder_map = {f['id']: f for f in folders}
        
        candidates_info = []
        for note in candidate_notes:
            folder_id = note.get('folderId')
            folder_name = folder_map.get(folder_id, {}).get('name', '未分类') if folder_id else '未分类'
            candidates_info.append({
                "id": note['id'],
                "title": note['title'],
                "content_preview": note.get('content', '')[:200] + "..." if len(note.get('content', '')) > 200 else note.get('content', ''),
                "tags": note.get('tags', []),
                "folder": folder_name
            })
        
        system_prompt = """你是一个专业的知识管理助手，擅长分析笔记之间的关联关系。
你的任务是分析当前笔记与候选笔记之间的关系，并给出推荐建议。

请严格按照以下JSON格式返回结果：
{
  "recommendations": [
    {
      "note_id": "候选笔记ID",
      "similarity": 85.5,
      "connection_type": "related",
      "reason": "推荐理由说明"
    }
  ]
}

连接类型(connection_type)只能是以下四种之一，请注意方向性：
- "dependent": 当前笔记的理解依赖于候选笔记提供的原理或定义（当前笔记→候选笔记）
- "extended": 候选笔记对当前笔记的内容进行了更深入的案例补充或实操演练（候选笔记→当前笔记）
- "contrast": 对比分析，属于同类并列关系（如：两种方法对比）
- "related": 主题相关，有交集但没有明确的递进或对立关系

相似度(similarity)打分校准：
- 95-100%: 几乎是同一主题的补充或高度互补的核心关联
- 80-90%: 核心概念重合，有明确的连接价值
- 40-70%: 仅主题大类相关，属于'顺便看看'的范畴
- 0-40%: 弱相关，通常不推荐

只推荐最相关的笔记（0-3个），按相似度从高到低排序。如果候选笔记与当前笔记完全无关（即使关键词重合但语境不同），请不要将其放入推荐列表，最终返回的recommendations数组数量可以是0到3个。"""

        user_prompt = f"""当前笔记信息：
标题：{current_note.get('title', '')}
内容：{current_note.get('content', '')[:500]}...
标签：{', '.join(current_note.get('tags', []))}

候选笔记列表（共{len(candidates_info)}个）：
{json.dumps(candidates_info, ensure_ascii=False, indent=2)}

请分析当前笔记与每个候选笔记的关系，返回JSON格式的推荐结果。
注意：
1. 如果两个笔记属于完全不同的领域（如公考和AI技术），且相似度低于20%，请不要推荐
2. 重点关注内容的语义相似度，而不仅仅是关键词匹配
3. 给出具体的推荐理由"""

        from ai_service import API_CONFIGS
        
        config = API_CONFIGS.get(ai_platform, API_CONFIGS['siliconflow'])
        model = ai_model or config['default_model']
        
        headers = config['headers'](api_key)
        
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 2000
        }
        
        print(f">>> [DEBUG] 调用AI API: {config['base_url']}")
        print(f">>> [DEBUG] 使用模型: {model}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                config['base_url'],
                headers=headers,
                json=payload,
                timeout=60.0
            )
            
            if response.status_code != 200:
                print(f">>> [ERROR] AI API调用失败: {response.status_code}")
                print(f">>> [ERROR] 响应: {response.text}")
                return {
                    "success": False,
                    "error": f"AI API调用失败: {response.status_code}",
                    "recommendations": []
                }
            
            result = response.json()
            ai_content = result['choices'][0]['message']['content']
            
            print(f">>> [DEBUG] AI响应内容: {ai_content[:500]}...")
            
            try:
                ai_result = json.loads(ai_content)
            except json.JSONDecodeError:
                import re
                json_match = re.search(r'```json\s*(.*?)\s*```', ai_content, re.DOTALL)
                if json_match:
                    ai_result = json.loads(json_match.group(1))
                else:
                    json_match = re.search(r'\{.*\}', ai_content, re.DOTALL)
                    if json_match:
                        ai_result = json.loads(json_match.group(0))
                    else:
                        raise ValueError("无法解析AI返回的JSON")
            
            recommendations = ai_result.get('recommendations', [])
            
            print(f">>> [DEBUG] 成功获取 {len(recommendations)} 个推荐")
            for rec in recommendations:
                print(f"  - {rec.get('note_id')}: 相似度{rec.get('similarity')}%, 类型{rec.get('connection_type')}")
            
            return {
                "success": True,
                "recommendations": recommendations
            }
            
    except Exception as e:
        print(f">>> [ERROR] AI推荐分析失败: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": f"AI推荐分析失败: {str(e)}",
            "recommendations": []
        }


@app.post("/api/ai/key/save")
async def save_api_key(request: APIKeySaveRequest, http_request: Request):
    """保存API密钥（加密存储）"""
    auth_header = http_request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="用户未登录")
    
    token = auth_header.replace("Bearer ", "")
    
    # 生成key_token
    key_token = generate_key_token()
    
    # 加密API密钥
    encrypted_data = encrypt_api_key(request.api_key)
    
    # 保存到数据库
    try:
        # 使用 ANON_KEY（RLS 已禁用）
        from supabase import create_client
        user_supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))
        
        # 直接使用token作为认证，不调用auth.get_user
        # 假设前端已经验证了用户的身份，我们只需要使用token来执行数据库操作
        
        # 从请求头中获取用户ID（如果前端传递了的话）
        user_id = http_request.headers.get("X-User-ID")
        
        # 如果没有获取到用户ID，尝试从token中解析
        if not user_id:
            import jwt
            try:
                # 解析JWT token获取用户ID
                decoded = jwt.decode(token, options={"verify_signature": False})
                user_id = decoded.get("sub")
            except Exception as e:
                print(f"解析JWT token失败: {e}")
                raise HTTPException(status_code=401, detail="用户未登录")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="用户未登录")
        
        # 检查是否已存在该平台的密钥
        existing = user_supabase.table("api_keys").select("id").eq("user_id", user_id).eq("platform", request.platform).execute()
        
        if existing.data and len(existing.data) > 0:
            # 更新现有密钥
            user_supabase.table("api_keys").update({
                "key_token": key_token,
                "encrypted_key": encrypted_data["encrypted_key"],
                "iv": encrypted_data["iv"]
            }).eq("user_id", user_id).eq("platform", request.platform).execute()
        else:
            # 创建新密钥
            user_supabase.table("api_keys").insert({
                "user_id": user_id,
                "platform": request.platform,
                "key_token": key_token,
                "encrypted_key": encrypted_data["encrypted_key"],
                "iv": encrypted_data["iv"]
            }).execute()
        
        return APIKeyResponse(key_token=key_token, platform=request.platform)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user/ai-settings")
async def get_ai_settings(http_request: Request):
    try:
        user_id = await get_current_user(http_request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")
        
        user_settings = await get_user_ai_settings(user_id)
        if user_settings:
            return {
                "success": True,
                "settings": user_settings
            }
        else:
            return {
                "success": True,
                "settings": None
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"获取AI设置失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai/settings/load")
async def load_ai_settings(http_request: Request):
    """加载用户的完整AI设置（包括解密的API密钥）"""
    try:
        user_id = await get_current_user(http_request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")

        user_settings = await get_user_ai_settings(user_id)
        if not user_settings:
            return {"settings": None}

        key_tokens = user_settings.get("keyTokens", {})
        decrypted_keys = {}

        for platform, key_token in key_tokens.items():
            if key_token:
                api_key = await get_api_key_from_token(key_token, user_id)
                if api_key:
                    decrypted_keys[platform] = api_key

        full_settings = {
            "selectedApi": user_settings.get("selectedApi"),
            "apiKeys": decrypted_keys,
            "keyTokens": key_tokens,
            "selectedModels": user_settings.get("selectedModels", {})
        }

        return {"settings": full_settings}
    except HTTPException:
        raise
    except Exception as e:
        print(f"加载AI设置失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-mindmap")
async def generate_mindmap(request: GenerateMindmapRequest):
    """根据笔记内容生成思维导图"""
    try:
        print(f"=" * 50)
        print(f"AI生成思维导图")
        print(f"=" * 50)
        print(f"标题: {request.title}")
        print(f"内容长度: {len(request.content)} 字符")
        
        ai_service = AIService()
        
        # 使用本地方法生成思维导图
        mindmap = ai_service._generate_mindmap_local(request.content, request.title)
        
        print(f"思维导图生成成功，节点数: {len(mindmap.get('nodes', []))}")
        
        return {
            "success": True,
            "mindmap": mindmap
        }
    except Exception as e:
        print(f"生成思维导图失败: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": f"生成失败: {str(e)}"
        }


class NoteSummaryRequest(BaseModel):
    noteId: str
    title: str
    content: str


@app.post("/api/ai/note-summary")
async def generate_note_summary(request: NoteSummaryRequest, http_request: Request):
    """为笔记生成AI摘要"""
    try:
        print(f">>> [DEBUG] 生成笔记摘要: {request.title}")

        user_id = await get_current_user(http_request)
        api_key = None
        ai_platform = None
        ai_model = None

        key_token = http_request.headers.get('X-Key-Token')
        encrypted_api_key = http_request.headers.get('X-Encrypted-API-Key')
        api_key_iv = http_request.headers.get('X-API-Key-IV')
        ai_platform = http_request.headers.get('X-AI-Platform')
        ai_model = http_request.headers.get('X-AI-Model')

        if key_token:
            api_key = await get_api_key_from_token(key_token, user_id)
        elif encrypted_api_key and api_key_iv:
            api_key = decrypt_api_key_simple(encrypted_api_key, api_key_iv)
        elif user_id:
            user_settings = await get_user_ai_settings(user_id)
            if user_settings:
                selected_api = user_settings.get("selectedApi", "siliconflow")
                key_tokens = user_settings.get("keyTokens", {})
                selected_models = user_settings.get("selectedModels", {})

                key_token = key_tokens.get(selected_api)
                if key_token:
                    api_key = await get_api_key_from_token(key_token, user_id)
                else:
                    api_key = await get_api_key_from_db(selected_api, user_id)
                ai_platform = selected_api
                ai_model = selected_models.get(selected_api)

        if not api_key:
            return {"success": False, "error": "请先配置AI密钥"}

        system_prompt = """你是一个笔记处理助手。你的任务是为用户的笔记生成简洁的摘要。

要求：
1. 摘要长度控制在50-100字
2. 提取笔记的核心概念和关键知识点
3. 使用中文简洁表达
4. 只返回摘要内容，不要其他解释

输出格式：
【摘要】<50-100字的摘要内容>"""

        result = await ai_service.call_ai_api(
            system_prompt=system_prompt,
            user_content=f"笔记标题：{request.title}\n\n笔记内容：\n{request.content[:2000]}",
            api_key=api_key,
            platform=ai_platform,
            model=ai_model
        )

        if result:
            summary = result.replace('【摘要】', '').strip()
            return {"success": True, "summary": summary}
        else:
            return {"success": False, "error": "AI生成失败"}

    except Exception as e:
        print(f">>> [ERROR] 生成笔记摘要失败: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


class KnowledgeChatRequest(BaseModel):
    messages: List[dict]


@app.post("/api/ai/knowledge-chat")
async def knowledge_chat(request: KnowledgeChatRequest, http_request: Request):
    """AI知识助手对话接口"""
    try:
        print(f"=" * 50)
        print(f"AI知识助手对话")
        print(f"=" * 50)

        user_id = await get_current_user(http_request)

        api_key = None
        ai_platform = None
        ai_model = None

        key_token = http_request.headers.get('X-Key-Token')
        encrypted_api_key = http_request.headers.get('X-Encrypted-API-Key')
        api_key_iv = http_request.headers.get('X-API-Key-IV')
        ai_platform = http_request.headers.get('X-AI-Platform')
        ai_model = http_request.headers.get('X-AI-Model')

        print(f">>> [DEBUG] Headers: key_token={'有' if key_token else '无'}, encrypted={'有' if encrypted_api_key else '无'}, platform={ai_platform}")
        print(f">>> [DEBUG] User ID: {user_id}")

        if key_token:
            api_key = await get_api_key_from_token(key_token, user_id)
            print(f">>> [DEBUG] 从key_token获取API密钥完成")
        elif encrypted_api_key and api_key_iv:
            api_key = decrypt_api_key_simple(encrypted_api_key, api_key_iv)
            print(f">>> [DEBUG] 从请求头解密API密钥完成, result={'成功' if api_key else '失败'}")
        elif user_id:
            user_settings = await get_user_ai_settings(user_id)
            if user_settings:
                selected_api = user_settings.get("selectedApi", "siliconflow")
                key_tokens = user_settings.get("keyTokens", {})
                selected_models = user_settings.get("selectedModels", {})

                key_token = key_tokens.get(selected_api)
                if key_token:
                    api_key = await get_api_key_from_token(key_token, user_id)
                else:
                    api_key = await get_api_key_from_db(selected_api, user_id)
                ai_platform = selected_api
                ai_model = selected_models.get(selected_api)
                print(f">>> [DEBUG] 从数据库获取: platform={ai_platform}, api_key={'有' if api_key else '无'}")
            else:
                print(f">>> [DEBUG] 用户设置为空")
        else:
            print(f">>> [DEBUG] 没有认证信息或API配置")

        if not api_key or not ai_platform:
            return {
                "response": "请先在AI设置中配置API密钥",
                "sources": []
            }

        # 前端已发送完整提示词，后端直接使用
        result = await ai_service.call_ai_api(
            system_prompt="",
            user_content="\n".join([f"{m.get('role', '')}: {m.get('content', '')}" for m in request.messages]),
            api_key=api_key,
            platform=ai_platform,
            model=ai_model
        )

        if result:
            # 处理 AI 返回内容
            processed_result = process_knowledge_response(result, ai_platform)
            return {
                "response": processed_result,
                "sources": []
            }
        else:
            return {
                "response": "抱歉，AI助手暂时无法回答。请稍后再试。",
                "sources": []
            }

    except Exception as e:
        print(f">>> [ERROR] AI知识助手对话失败: {e}")
        import traceback
        traceback.print_exc()
        return {
            "response": f"抱歉，发生错误: {str(e)}",
            "sources": []
        }


def process_knowledge_response(response: str, platform: str = None) -> str:
    """处理 AI 知识助手的返回内容"""
    if not response:
        return "AI 未返回有效内容"
    
    cleaned = response.strip()
    
    # 1. 移除 Markdown 代码块标记
    cleaned = re.sub(r'^\s*```json\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^\s*```\s*', '', cleaned)
    cleaned = re.sub(r'\s*```\s*$', '', cleaned)
    cleaned = cleaned.strip()
    
    # 2. 移除思考过程（OpenRouter 特有）
    if platform == 'openrouter':
        thinking_patterns = [
            r'让我试着.*?(?=\n#{1,3}|\n[📚💡🎯📊✅📖⚡]|\{)',
            r'我需要.*?(?=\n#{1,3}|\n[📚💡🎯📊✅📖⚡]|\{)',
            r'我应该.*?(?=\n#{1,3}|\n[📚💡🎯📊✅📖⚡]|\{)',
        ]
        for pattern in thinking_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.DOTALL)
    
    # 3. 检测并转换 JSON 格式
    if cleaned.startswith('{'):
        try:
            data = json.loads(cleaned)
            if isinstance(data, dict):
                # 优先提取 answer 字段（最常见的格式）
                if 'answer' in data:
                    cleaned = data['answer']
                elif 'response' in data:
                    cleaned = data['response']
                elif 'content' in data:
                    cleaned = data['content']
                elif 'content_markdown' in data:
                    cleaned = data['content_markdown']
                # 处理只有 recommendations 数组的情况
                elif 'recommendations' in data:
                    recs = data['recommendations']
                    if isinstance(recs, list):
                        lines = ["## 🎯 学习推荐\n"]
                        for i, rec in enumerate(recs, 1):
                            if isinstance(rec, dict):
                                topic = rec.get('topic', '未知主题')
                                detail = rec.get('detail', '')
                                reason = rec.get('reason', '')
                                lines.append(f"### {i}. {topic}")
                                if detail:
                                    lines.append(f"\n{detail}")
                                if reason:
                                    lines.append(f"\n💡 **理由**：{reason}")
                                lines.append("")
                        cleaned = "\n".join(lines)
        except json.JSONDecodeError:
            pass
    
    # 4. 格式优化
    cleaned = format_markdown_content(cleaned)
    
    # 5. 确保不是空内容
    if not cleaned.strip():
        return "AI 返回内容为空，请重新提问"
    
    # 6. 限制长度（超过 2000 字截断）
    if len(cleaned) > 2000:
        cleaned = cleaned[:2000] + "\n\n...（内容过长，已截断）"
    
    return cleaned.strip()


def format_markdown_content(content: str) -> str:
    """优化 Markdown 内容格式，增强可读性"""
    if not content:
        return content
    
    lines = content.split('\n')
    formatted_lines = []
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # 标题前后添加空行
        if stripped.startswith('##'):
            if formatted_lines and formatted_lines[-1].strip():
                formatted_lines.append('')
            formatted_lines.append(stripped)
            formatted_lines.append('')
        elif stripped.startswith('###'):
            if formatted_lines and formatted_lines[-1].strip() and not formatted_lines[-1].strip().startswith('#'):
                formatted_lines.append('')
            formatted_lines.append(stripped)
        # 列表项保持缩进
        elif stripped.startswith('- ') or stripped.startswith('* '):
            formatted_lines.append('  ' + stripped)
        # 数字列表
        elif stripped and stripped[0].isdigit() and '. ' in stripped[:4]:
            formatted_lines.append('  ' + stripped)
        # 空行保留
        elif not stripped:
            if formatted_lines and formatted_lines[-1].strip():
                formatted_lines.append('')
        else:
            formatted_lines.append(stripped)
    
    # 清理多余空行
    result = '\n'.join(formatted_lines)
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    return result.strip()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
