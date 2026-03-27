import httpx
import os
from dotenv import load_dotenv
from typing import Dict, Any, Optional, List
import re
import logging
import json

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_CONFIGS = {
    'siliconflow': {
        'name': '硅基流动',
        'base_url': 'https://api.siliconflow.cn/v1/chat/completions',
        'default_model': 'deepseek-ai/DeepSeek-V3',
        'models': [
            'deepseek-ai/DeepSeek-V3',
            'deepseek-ai/DeepSeek-R1',
            'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
            'Qwen/Qwen2.5-7B-Instruct',
            'Qwen/Qwen2.5-72B-Instruct',
            'Qwen/Qwen3-8B',
            'THUDM/glm-4-9b-0414',
            'THUDM/glm-4-9b-chat',
            'meta-llama/Llama-3.1-8B-Instruct',
            'meta-llama/Llama-3.3-70B-Instruct'
        ],
        'headers': lambda key: {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json'
        }
    }
}

SYSTEM_PROMPT = """你是一名"知识整理与结构化专家"，请对我提供的的文本进行处理，1. 首先判断文本类型：干货型或知识型，根据文本内容判断。2. 标题：根据文本内容生成简洁有力的标题。具体规范请参考《标题规范》。3. 标签：提取文本中的核心知识点标签，每个标签2-6字。具体规范请参考《标签规范》。4. 内容：将文本整理成结构清晰、易读的markdown格式。具体规范请参考《内容整理规范》。5. 文件路径分类：根据文本内容判断，将输出结果归类到一个清晰、具体、可复用的文件路径中。具体规范请参考《文件路径规范》。6. 思维导图：将文本整理成树状结构思维导图（JSON格式）。具体规范请参考《思维导图规范》。


所有输出必须保持一致的逻辑，保持统一性。

《标题规范》
1. 标题要简洁有力，准确概括核心主题（10-20字）
2. 避免使用"关于"、"浅析"、"分析"等虚词开头
3. 优先使用具体知识点或问题类型作为标题
4. 好的标题示例：
   - "段落阅读：关键词句查找方法"
   - "Python编译器原理与应用"
   - "数据分析计算：排除法"
5. 不好的标题示例：
   - "关于阅读理解的分析"
   - "Python学习总结"
   - "数据分析方法总结"


《标签规范》
1. 排除无意义词汇（如：方法、内容、方式、技术、总结等）
2. 提取3-5个核心知识点标签，每个标签2-6字
3. 标签要具体到题型或解题方法，例如：
   - 阅读类：段落阅读、中心理解、语句排序、逻辑填空
   - 数据分析类：增长率计算、比重比较、平均数问题
   - 技术类：列表推导式、安装包、调试技巧

《内容整理规范》请将原始内容整理成结构清晰、易读的markdown格式
，1. **🍁 速览概览**：
   - 《分类》显示分类路径
   - 《标签》显示标签（使用#标签 格式）
2. **🍂 核心要点**：
   - 使用Emoji + 无序列表
   - 提炼3-5条核心观点或关键信息
   - 每条例控制在15-30字
3. **🍃 详细正文**：
   - 根据内容自动拆分 一级标题（#）、二级标题（##）和三级标题（###）有时可能有四级标题（####）和五级标题（#####）
   - 重点词汇使用 **加粗**
   - 步骤类内容使用数字列表
   - 对比类内容使用表格或引用块
   - 示例代码使用代码块
   - 重要提示使用引用块（> 格式）
4. **格式要求**：
   - 层级分明，逻辑清晰
   - 适当使用Emoji增加可读性
   - 避免长段文字，善用分段和列表
   - 保证原文的核心信息，去除冗余内容


《文件路径分类规范》
请根据你自身知识库中的标准知识体系，按照以下规则为输出生成唯一文件路径：
1. 路径至少三级，优先四级或五级。
2. 每一级都要具体、有意义的知识类别，避免出现 "其他"、"杂项"、"未分类"等。
3. 分类确定可复用，同类内容可直接归入同一路径。
4. 严格对应相关领域的专业知识体系（如：公务员考试、英语学习、编程技术体系等）。
最终路径格式：一级主题 / 二级子主题 / 三级模块 / 四级知识点 / 五级细分项
AI 自动判断逻辑：
识别问题首先判断所属一级主题：
科学 / 语言 / 编程 / 数学 / 效率工具 / 知识管理 / 职业技能 / 学习方法 / 情感心理 / 项目实践 等
确定二级子主题按主题标准体系分类：
科学 → 阅读 / 逻辑 / 面试 / 基础
语言 → 词汇 / 语法 / 听力 / 阅读 / 写作 / 翻译
编程 → Python / Java / 前端 / 后端 / 数据库 / 算法
知识管理 → 笔记方法 / 结构化整理 / 信息提取 / 知识库构建
具体三级知识点继续向下细化到具体模块：
阅读 → 数字关系 / 数据分析 / 逻辑判断 / 阅读理解 / 常识判断
阅读 → 细节阅读 / 速览阅读 / 标题题 / 主旨题
结构化整理 → 标题提炼 / 标签关联 / 分类路径 / 思维导图
细化四级/五级标准类目到最小可复用知识单元：
数据分析 → 计算技巧 / 时间陷阱 / 比重问题 / 平均数问题
阅读理解 → 中心理解 / 主旨判断 / 语句排序 / 逻辑填空
分类路径 → 分类规则 / 路径原则 / 自动归类逻辑
最终检查路径必须：
不含 "其他"/"杂项"/"未分类" 等模糊词
每一级都能代表一类知识
同类输出均可直接复用该路径
例如：
-科学 / 阅读/阅读理解/中心理解，数学 / 阅读/逻辑判断/逻辑推理，科学 / 阅读/数字关系/数学计算/工程问题
-语言 / 阅读理解 / 题型 / 标题题， 语言 / 语法 / 词法 / 虚词 / 介词
5. 路径中的每一级都要有意义，避免出现 "其他"、"杂项" 等模糊分类
{folder_hint}

《思维导图规范 - 必须严格遵守》
**核心原则**：1. 必须生成完整的树状结构，不能省略
2. 每个节点必须有topic字段，children字段可选
3. topic内容要简洁有力，控制在15字以内
4. 层级深度建议3-4层，重要内容可到5层
**判断文本不同类型不同处理逻辑**
1. 记忆类 特征：字数少，语句多为核心重点
处理逻辑：**必须完整保留所有要点**，每个要点都要展开2-4层深度，详细展开方法、结论、公式、技术、注意事项等。思维导图要像"知识清单"一样完整，每个核心要点都要分子节点展开。
2. 知识类 特征：字数多，解释性内容占比高
处理逻辑：突出结构与核心关系，保证最重要的解释，思维导图层级深度确保3-4层
3. 操作类 特征：内容大量列举系统信息
处理逻辑：**必须完整展开每个步骤**，思维导图要像"操作手册"一样完整，每个步骤都要子节点说明方法和注意事项
**结构要求**：- 中心主题：文章核心概要（1条）
- 一级分类：主要模块/部分（2-6条）
- 二级分支：核心知识点/方法（每条一级下2-5条）
- 三级分支：具体细节/步骤（按需展开）
- **重要：记忆型文本的每个分类都要继续展开2-5层**，不能省略任何要点
**内容提取优先级**：1. 核心结论和公式
2. 方法技巧和步骤
3. 关键关系和定义
4. 注意事项和易错点

**示例（逻辑推理干货版详细）**：
```json
{
    "topic": "逻辑题解题技术",
    "children": [
        {
            "topic": "第一步：分析题干关系",
            "children": [
                {
                    "topic": "逻辑关系定义",
                    "children": [
                        {"topic": "A 或 A 必有一真一假"},
                        {"topic": "所有都有的不矛盾"},
                        {"topic": "所有都不与有的不矛盾"}
                    ]
                },
                {
                    "topic": "分析题干方法",
                    "children": [
                        {"topic": "找出关键词：所有、有的"},
                        {"topic": "判断是否属于肯定"}
                    ]
                }
            ]
        }
    ]
}
```
```

请严格按照上述规范输出JSON格式的结果，确保格式正确且内容完整。
输出格式必须是标准JSON，不能包含任何额外内容。
"""

class AIService:
    def __init__(self):
        pass

    async def test_api_connection(self, platform: str, api_key: str, model: str = None) -> Dict[str, Any]:
        """测试API连接 - 统一参数配置器"""
        try:
            api_key = api_key.strip()
            
            config = API_CONFIGS.get(platform)
            if not config:
                return {"success": False, "error": f"未知平台: {platform}"}
            
            use_model = model or config['default_model']
            
            print(f">>> [DEBUG] 测试API连接: {config['name']}")
            print(f">>> [DEBUG] 模型: {use_model}")
            print(f">>> [DEBUG] API Key前15位: {api_key[:15]}...")
            
            headers = config['headers'](api_key)
            
            data = {
                "model": use_model,
                "messages": [{"role": "user", "content": "hi"}],
                "max_tokens": 5
            }
            
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
                response = await client.post(config['base_url'], headers=headers, json=data)
                
                print(f">>> [DEBUG] 响应状态码: {response.status_code}")
                
                if response.status_code == 200:
                    return {"success": True, "message": f"{config['name']}连接成功"}
                elif response.status_code == 401:
                    error_msg = "API密钥无效，请检查密钥是否正确"
                    print(f">>> [DEBUG] {error_msg}")
                    return {"success": False, "error": error_msg}
                elif response.status_code == 402:
                    error_msg = f"{config['name']}余额不足，请充值或切换平台"
                    print(f">>> [DEBUG] {error_msg}")
                    return {"success": False, "error": error_msg}
                elif response.status_code == 429:
                    error_msg = "请求过于频繁，请稍后重试"
                    print(f">>> [DEBUG] {error_msg}")
                    return {"success": False, "error": error_msg}
                else:
                    error_text = response.text[:300]
                    print(f">>> [DEBUG] 错误响应: {error_text}")
                    return {"success": False, "error": f"连接失败 ({response.status_code}): {error_text}"}
                    
        except httpx.TimeoutException:
            print(f">>> [DEBUG] API测试超时")
            return {"success": False, "error": "连接超时，请检查网络或API服务状态"}
        except Exception as e:
            print(f">>> [DEBUG] API测试失败: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

if __name__ == "__main__":
    print("测试文件加载成功!")
