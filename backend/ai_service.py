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
    },
    'openrouter': {
        'name': 'OpenRouter',
        'base_url': 'https://openrouter.ai/api/v1/chat/completions',
        'default_model': 'stepfun/step-3.5-flash:free',
        'models': [
            'stepfun/step-3.5-flash:free',
            'nvidia/nemotron-3-super-120b-a12b:free',
            'openrouter/hunter-alpha',
            'arcee-ai/trinity-large-preview:free',
            'minimax/minimax-m2.5:free',
            'nvidia/nemotron-nano-12b-v2-vl:free',
            'nvidia/llama-nemotron-embed-vl-1b-v2:free',
            'liquid/lfm-2.5-1.2b-thinking:free',
            'arcee-ai/trinity-mini:free',
            'z-ai/glm-4.5-air:free'
        ],
        'headers': lambda key: {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:5173',
            'X-Title': 'AI Notes System'
        }
    },
    'zhipuai': {
        'name': '智谱GLM',
        'base_url': 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        'default_model': 'glm-4.7-Flash',
        'models': [
            'glm-4.7-Flash',
            'glm-4.6V-Flash',
            'glm-4.1V-Thinking-Flash',
            'glm-4-Flash-250414',
            'glm-4V-Flash',
            'glm-4-flash'
        ],
        'headers': lambda key: {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json'
        }
    },
    'modelscope': {
        'name': '魔搭ModelScope',
        'base_url': 'https://api-inference.modelscope.cn/v1/chat/completions',
        'default_model': 'moonshotai/Kimi-K2.5',
        'models': [
           'moonshotai/Kimi-K2.5',
           'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
           'ZhipuAI/GLM-5', 
           'ZhipuAI/GLM-4.6',
            'deepseek-ai/DeepSeek-V3.2',
            'MiniMax/M2.5-12B-Instruct'
        ],
        'headers': lambda key: {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json'
        }
    }
}

SYSTEM_PROMPT = """【⚠️ 强制要求 - 必须遵守】

你是知识整理专家，分析文本并输出纯JSON。

**格式要求（违反将导致解析失败）：**
1. **直接返回纯 JSON**，不要包含 ```json 或 ``` 等任何标记
2. **content_markdown 字段中**：如果要换行的话用 `\\n` 表示换行（如 `"第一行\\n第二行"`），绝对不能用实际换行符
3. **JSON 字段之间**可以有换行，不影响解析
4. **不要返回任何 JSON 以外的文字说明**
5. **如果返回格式不符合要求，将无法被系统解析**



❌ **错误格式（不要这样做）：**
- 包含 ```json 标记
- JSON 中有实际换行符
- content_markdown 中没有用 \\n 转义


【任务】
1. title: 简洁标题(10-20字)，避免"关于/浅析/总结"
2. category: 分类路径(至少3级)，如"公考/行测/资料分析/速算技巧"，具体要求看《文件路径分类规范》
3. tags: 3-5个核心标签(2-6字)，具体到题型/方法，精准描述文章内容，是高频出现的关键词
4. summary: 笔记摘要（50-80字，概括核心内容和知识点）
5. content_markdown: Markdown格式正文：
   【标题层级规范 - 严格执行】
   - # 一级标题：用于三个主要章节
     * # 🍁速览
     * # 🍂核心要点  
     * # 🍃详细正文
   - ## 二级标题：用于详细正文下的主要小节
   - ### 三级标题：用于二级标题下的细分内容
   - #### 四级标题：用于三级标题下的细分内容
   
   内容结构：
   - # 🍁速览：分类路径+标签（简洁呈现，方便快速了解）
   - # 🍂核心要点：3-5条核心要点，15-30字/条，概括文章精华
   - # 🍃详细正文：使用 ## 二级标题作为主要小节，必要时使用 ### 三级标题细分
     * 使用 **加粗** 标记重点概念和关键词
     * 使用 - 或 1. 列表展示步骤、方法、要点
     * 详细正文必须包含完整的方法步骤、原则定义、说明解释
     * 详细正文必须包含必要的示例、图表、公式等，辅助说明
     * 可适当使用Emoji表情，增强可读性
     
   【数学公式格式要求】
   - 使用纯文本或 Unicode 字符表示公式，**不要使用 LaTeX 格式**
   - ❌ 错误：$\\frac{A}{B} \\times \\frac{a-b}{1+a}$
   - ✅ 正确：A/B × (a-b)/(1+a) 或 使用 ÷ 表示除法
   - 分数用 / 或 ÷ 表示，不要用 \\frac{}{}
   - 乘法用 × 或 * 表示，不要用 \\times
   - 上下标用简单的文字描述，如：x的平方、A的n次方
     
 


《文件路径分类规范》
请根据你自身知识库中的标准知识体系，按照以下规则为输出生成唯一文件路径：
1. 路径至少三级，优先四级或五级。
2. 每一级都要具体、有意义的知识类别，避免出现 "其他"、"杂项"、"未分类"等。
3. 分类确定可复用，同类内容可直接归入同一路径。
4. 严格对应相关领域的专业知识体系（公考、教师考试、法考、会计等知识体系分类参考粉笔的分类体系）。
最终路径格式：一级主题 / 二级子主题 / 三级模块 / 四级知识点 / 五级细分项
AI 自动判断逻辑：
识别问题首先判断所属一级主题，确定二级子主题按主题标准体系分类，再确定三级模块按二级子主题分类，细化四级/五级标准类目到最小可复用知识单元，
最终检查路径必须：
不含 "其他"/"杂项"/"未分类" 等模糊词
每一级都能代表一类知识
同类输出均可直接复用该路径
例如：
-公考/行测/判断推理/逻辑判断/真假推理

{folder_hint}



【JSON 输出格式 - 严格遵守】

⚠️ **重要警告**：
1. 必须返回**纯 JSON 格式**，不要包含 ```json 或 ``` 等 Markdown 代码块标记
2. JSON 字符串值中**不能包含实际的换行符**（\n），所有换行必须使用 \\n 转义
3. 不要返回任何 JSON 以外的文字说明


请严格按照以下 JSON 格式输出，**只返回 JSON，不要任何其他内容**：
{{
    "title": "笔记标题（简洁有力，不超过20字）",
    "category": "分类路径（如：公考/行测/言语理解，至少两级）",
    "tags": ["标签1", "标签2", "标签3"],
    "summary": "笔记摘要（50-80字，概括核心内容和知识点）",
    "content_markdown": "结构化正文（使用Markdown格式，包含列表、加粗等）"
}}

**再次强调**：
- 不要 ```json 标记
- 字符串内用 \\n 表示换行，不要用实际换行
- 只返回 JSON 文本，前后不要加任何说明
"""

# 针对不同平台的系统提示词调整
PLATFORM_PROMPT_ADJUSTMENTS = {
    "openrouter": """
⚠️ **严格限制 - 必须遵守**：
1. **只输出 JSON**，不要输出任何思考过程、解释或自然语言
2. **禁止输出**："让我试着"、"我需要"、"我应该"、"现在"等思考性文字
3. **content_markdown 字段**：只包含整理后的正文内容，不要包含调试信息或格式说明
4. **直接返回**：从第一个 { 开始，到最后一个 } 结束，中间不要有任何其他文字
""",
    "zhipuai": """
💡 **重要提示**：
1. **内容结构**：title 是标题，content_markdown 是正文内容
2. **不要重复**：content_markdown 中不要重复 title 的内容
3. **格式规范**：使用 \n 作为换行符（不是 \r\n）
4. **JSON 格式**：确保返回完整、正确的 JSON
""",
    "modelscope": """
💡 **提示**：请生成简洁但完整的内容，确保 JSON 格式正确。
"""
}

class AIService:
    def __init__(self):
        pass
    
    def _decode_unicode_escapes(self, text: str) -> str:
        """解码 Unicode 转义字符（如 \\u901f\\u67e5 → 速查）"""
        if not text:
            return text
        try:
            # 使用正则表达式匹配 \\uXXXX 格式的转义序列
            def replace_unicode(match):
                code = match.group(1)
                try:
                    return chr(int(code, 16))
                except:
                    return match.group(0)
            
            # 替换 \\uXXXX 为实际字符
            decoded = re.sub(r'\\u([0-9a-fA-F]{4})', replace_unicode, text)
            return decoded
        except Exception as e:
            print(f">>> [DEBUG] Unicode解码失败: {e}")
            return text
    
    def _fix_invalid_unicode_escapes(self, text: str) -> str:
        """
        修复无效的 Unicode 转义序列
        处理被截断的 \\uXXX 或 UTF-16 代理对问题
        """
        if not text:
            return text
        
        # 步骤1: 修复不完整的 Unicode 转义（\\u 后面少于4个十六进制字符）
        # 将 \\uXXX（3个字符）或 \\uXX（2个字符）等替换为占位符
        text = re.sub(r'\\u([0-9a-fA-F]{1,3})(?![0-9a-fA-F])', r'[U\1]', text)
        
        # 步骤2: 处理 UTF-16 代理对（Emoji 等）
        # 代理对范围: 高代理 \\ud800-\udbff，低代理 \\udc00-\udfff
        # 将代理对转换为实际的 Unicode 字符
        def replace_surrogate_pair(match):
            high = int(match.group(1), 16)
            low = int(match.group(2), 16)
            # 计算实际的 Unicode 码点
            code_point = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00)
            try:
                return chr(code_point)
            except:
                return match.group(0)
        
        # 匹配代理对: \\ud8xx\\udcxx
        text = re.sub(r'\\u(d[89ab][0-9a-fA-F]{2})\\u(d[c-f][0-9a-fA-F]{2})', 
                      replace_surrogate_pair, text, flags=re.IGNORECASE)
        
        # 步骤3: 处理单独的高代理或低代理（不完整的代理对）
        # 单独的高代理 \\ud8xx-\udbxx
        text = re.sub(r'\\u(d[89ab][0-9a-fA-F]{2})(?!\\u[dc][0-9a-fA-F]{2})', 
                      lambda m: f"[H{m.group(1)}]", text, flags=re.IGNORECASE)
        # 单独的低代理 \\udcxx-\udfx
        text = re.sub(r'(?<!\\u[d89ab][0-9a-fA-F]{2})\\u(d[c-f][0-9a-fA-F]{2})', 
                      lambda m: f"[L{m.group(1)}]", text, flags=re.IGNORECASE)
        
        return text
    
    def _remove_duplicate_title_from_content(self, content: str, title: str) -> str:
        """
        从 content_markdown 中删除与 title 重复的部分
        智谱AI经常会在 content 中重复 title 的内容
        """
        if not content or not title:
            return content
        
        # 获取 title 的纯文本（移除 emoji 和特殊字符）
        title_clean = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9]', '', title).lower()
        
        # 按行分割
        lines = content.split('\n')
        result_lines = []
        skip_until_next_heading = False
        
        for i, line in enumerate(lines):
            # 检查是否是标题行（以 # 开头）
            if line.strip().startswith('#'):
                # 获取这行的纯文本
                line_clean = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9]', '', line).lower()
                
                # 如果这行包含 title 的内容，认为是重复标题，跳过
                if title_clean and (title_clean in line_clean or line_clean in title_clean):
                    skip_until_next_heading = True
                    print(f">>> [DEBUG] 智谱AI处理: 跳过重复标题行: {line[:50]}")
                    continue
                else:
                    # 遇到新的标题，停止跳过
                    skip_until_next_heading = False
            
            # 如果在跳过模式中，且当前行不是空行，继续跳过
            if skip_until_next_heading and line.strip():
                continue
            
            # 如果当前行不是空行，退出跳过模式
            if skip_until_next_heading and not line.strip():
                skip_until_next_heading = False
                continue
            
            result_lines.append(line)
        
        # 重新组合内容
        result = '\n'.join(result_lines)
        
        # 清理开头的空行
        result = result.lstrip('\n')
        
        print(f">>> [DEBUG] 智谱AI处理: 去重后内容长度 {len(result)}")
        return result
    
    def _clean_openrouter_thinking(self, content: str) -> str:
        """
        清理 OpenRouter 模型在 content 中输出的思考过程
        """
        if not content:
            return content
        
        # 定义需要删除的思考模式
        thinking_patterns = [
            r'让我试着.*',
            r'我需要.*',
            r'我应该.*',
            r'现在.*',
            r'在content_markdown字符串中.*',
            r'所有双引号需要转义吗.*',
            r'检查内容.*',
            r'所以，我可以直接拼接字符串.*',
            r'最后，输出时.*',
            r'长字符串.*',
            r'"\s*}\s*$',  # 删除结尾的孤立的 " }
            r'在JSON字符串中.*',
            r'但Markdown中可能有引号.*',
            r'公式里有括号.*',
            r'所以.*?(?=\n|$)',
        ]
        
        # 按行处理
        lines = content.split('\n')
        result_lines = []
        
        for line in lines:
            line_stripped = line.strip()
            
            # 检查是否是思考性文字
            is_thinking = False
            for pattern in thinking_patterns:
                if re.search(pattern, line_stripped, re.IGNORECASE):
                    is_thinking = True
                    print(f">>> [DEBUG] OpenRouter处理: 删除思考行: {line_stripped[:50]}")
                    break
            
            if not is_thinking:
                result_lines.append(line)
        
        # 重新组合
        result = '\n'.join(result_lines)
        
        # 清理多余空行
        result = re.sub(r'\n{3,}', '\n\n', result)
        result = result.strip()
        
        print(f">>> [DEBUG] OpenRouter处理: 清理后内容长度 {len(result)}")
        return result
    
    def fix_json_from_ai(self, ai_response: str, platform: str = None) -> Optional[Dict[str, Any]]:
        """
        一键修复 AI 返回的 JSON 格式问题
        处理各种常见的 JSON 格式错误
        """
        if not ai_response or not ai_response.strip():
            return None
        
        original = ai_response.strip()
        print(f">>> [DEBUG] JSON修复: 原始内容长度 {len(original)}, 平台: {platform}")
        
        # 步骤0: 如果内容包含自然语言说明，尝试提取其中的 JSON 部分
        # 查找第一个 { 和最后一个 } 之间的内容
        json_match = re.search(r'\{.*\}', original, re.DOTALL)
        if json_match:
            potential_json = json_match.group(0)
            # 尝试直接解析提取的内容
            try:
                result = json.loads(potential_json)
                print(f">>> [DEBUG] JSON修复: 从文本中提取JSON成功")
                return result
            except json.JSONDecodeError:
                # 提取的内容不是有效JSON，继续使用原始内容
                pass
        
        # 步骤0.5: 平台特殊处理 - 预处理内容
        if platform == 'zhipuai':
            # 1. 将 \r\n 替换为 \n
            original = original.replace('\r\n', '\n').replace('\r', '\n')
            # 2. 删除重复的标题（如果 content_markdown 以 # 开头且与 title 重复）
            # 这个处理在解析后完成
            print(f">>> [DEBUG] JSON修复: 智谱AI预处理完成")
        elif platform == 'openrouter':
            # OpenRouter 特殊处理：去除思考过程
            # 查找并删除常见的思考模式
            thinking_patterns = [
                r'让我试着.*?(?=\{)',
                r'我需要.*?(?=\{)',
                r'我应该.*?(?=\{)',
                r'现在.*?(?=\{)',
                r'在content_markdown字符串中.*?(?=\{)',
                r'所有双引号需要转义吗.*?(?=\{)',
                r'检查内容.*?(?=\{)',
                r'所以，我可以直接拼接字符串.*?(?=\{)',
                r'最后，输出时.*?(?=\{)',
                r'长字符串.*?(?=\{)',
            ]
            for pattern in thinking_patterns:
                original = re.sub(pattern, '', original, flags=re.DOTALL | re.IGNORECASE)
            print(f">>> [DEBUG] JSON修复: OpenRouter预处理完成")
        
        # 步骤1: 移除 Markdown 代码块标记
        cleaned = original
        cleaned = re.sub(r'^\s*```json\s*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'^\s*```\s*', '', cleaned)
        cleaned = re.sub(r'\s*```\s*$', '', cleaned)
        cleaned = cleaned.strip()
        
        # 步骤1.5: 修复无效的 Unicode 转义序列（必须在解析 JSON 之前）
        cleaned = self._fix_invalid_unicode_escapes(cleaned)
        print(f">>> [DEBUG] JSON修复: 修复Unicode后长度 {len(cleaned)}")
        print(f">>> [DEBUG] JSON修复: 移除代码块后长度 {len(cleaned)}")
        
        # 步骤2: 尝试直接解析（最理想的状况）
        try:
            result = json.loads(cleaned)
            print(f">>> [DEBUG] JSON修复: 直接解析成功")
            return result
        except json.JSONDecodeError as e:
            print(f">>> [DEBUG] JSON修复: 直接解析失败 - {e}")
            # 打印出错的上下文，帮助诊断无效的 Unicode
            error_msg = str(e)
            if "Invalid \\uXXXX escape" in error_msg:
                # 提取列号
                import re as re_module
                col_match = re_module.search(r'column (\d+)', error_msg)
                if col_match:
                    col = int(col_match.group(1))
                    start = max(0, col - 50)
                    end = min(len(cleaned), col + 50)
                    context = cleaned[start:end]
                    print(f">>> [DEBUG] 无效Unicode上下文: ...{context}...")
                    print(f">>> [DEBUG] 出错位置标记: {' ' * (col - start)}^")
                    # 查找所有 \u 开头的序列
                    unicode_matches = re_module.findall(r'\\u[0-9a-fA-F]{0,4}', cleaned)
                    if unicode_matches:
                        print(f">>> [DEBUG] 找到的Unicode序列: {unicode_matches[:20]}")  # 只显示前20个
        
        # 步骤3: 使用新方法 - 提取并修复字段
        # 第一步：删除 tags 数组中的换行符
        # 第二步：将 content_markdown 中的换行符替换为 \n
        try:
            # 先尝试提取各个字段
            # 使用正则提取 title
            title_match = re.search(r'"title"\s*:\s*"([^"]*)"', cleaned, re.DOTALL)
            title = title_match.group(1) if title_match else ""
            # 删除 title 中的换行
            title = title.replace('\n', ' ').replace('\r', ' ')
            
            # 提取 category
            category_match = re.search(r'"category"\s*:\s*"([^"]*)"', cleaned, re.DOTALL)
            category = category_match.group(1) if category_match else ""
            category = category.replace('\n', ' ').replace('\r', ' ')
            
            # 提取 tags 数组
            tags_match = re.search(r'"tags"\s*:\s*\[([^\]]*)\]', cleaned, re.DOTALL)
            tags_str = tags_match.group(1) if tags_match else ""
            # 删除 tags 中的所有换行
            tags_str = tags_str.replace('\n', ' ').replace('\r', ' ')
            # 解析 tags
            tags = []
            for tag_match in re.findall(r'"([^"]*)"', tags_str):
                tag = tag_match.strip()
                if tag:
                    tags.append(tag)
            
            # 提取 content_markdown - 使用更高效的正则方法
            cm_match = re.search(r'"content_markdown"\s*:\s*"(.*?)"\s*,\s*"(?:category|tags|title)"', cleaned, re.DOTALL)
            if cm_match:
                content_markdown = cm_match.group(1)
                # 处理转义字符
                content_markdown = content_markdown.replace('\\"', '"').replace('\\\\', '\\').replace('\\n', '\n')
            else:
                # 备用：尝试简单提取
                cm_start = re.search(r'"content_markdown"\s*:\s*"', cleaned)
                if cm_start:
                    start_pos = cm_start.end()
                    # 快速找到结束引号（处理转义）
                    remaining = cleaned[start_pos:]
                    # 使用正则找到未转义的引号
                    end_match = re.search(r'(?<!\\)"', remaining)
                    if end_match:
                        content_markdown = remaining[:end_match.start()]
                        content_markdown = content_markdown.replace('\\"', '"').replace('\\\\', '\\').replace('\\n', '\n')
                    else:
                        content_markdown = remaining
                else:
                    content_markdown = ""
            
            # 解码 Unicode 转义字符
            title = self._decode_unicode_escapes(title)
            category = self._decode_unicode_escapes(category)
            content_markdown = self._decode_unicode_escapes(content_markdown)
            tags = [self._decode_unicode_escapes(tag) for tag in tags]
            
            # 构建修复后的结果（不包含mindmap）
            result = {
                "title": title,
                "category": category,
                "tags": tags,
                "content_markdown": content_markdown
            }
            
            # 验证必要字段
            if title:
                print(f">>> [DEBUG] JSON修复: 字段提取成功，title={title}")
                return result
            else:
                print(f">>> [DEBUG] JSON修复: 字段提取失败，title为空")
                
        except Exception as e:
            print(f">>> [DEBUG] JSON修复: 字段提取出错 - {e}")
            import traceback
            traceback.print_exc()
        
        # 步骤4: 如果字段提取失败，尝试使用 json.dumps 强制转义
        try:
            # 尝试将内容作为 Python 字典字符串处理
            # 先用 eval 尝试解析（危险但有效，仅用于修复）
            # 替换 true/false/null 为 Python 的 True/False/None
            py_style = cleaned.replace('true', 'True').replace('false', 'False').replace('null', 'None')
            # 尝试安全地解析
            result = eval(py_style, {"__builtins__": {}}, {})
            if isinstance(result, dict):
                # 使用 json.dumps 强制转义所有特殊字符
                fixed_json = json.dumps(result, ensure_ascii=False)
                # 再解析回来
                result = json.loads(fixed_json)
                print(f">>> [DEBUG] JSON修复: eval + dumps 成功")
                return result
        except Exception as e:
            print(f">>> [DEBUG] JSON修复: eval + dumps 失败 - {e}")
        
        # 步骤5: 如果都失败了，记录错误并返回 None
        print(f">>> [DEBUG] JSON 修复失败，原始内容前300字符: {original[:300]}")
        return None

    async def parse_ai_link(self, url: str, api_key: str = None, existing_folders: List[str] = None, ai_platform: str = None, ai_model: str = None) -> Dict[str, Any]:
        """解析AI链接，获取内容并分析"""
        try:
            print(f">>> [DEBUG] 开始解析链接: {url}")
            
            # 检测平台
            platform = self.detect_platform(url)
            print(f">>> [DEBUG] 检测到平台: {platform}")
            
            # 获取内容
            content = await self.fetch_content_via_jina(url)
            if not content:
                print(f">>> [DEBUG] 通过Jina获取内容失败，尝试直接获取")
                content = await self.fetch_content_directly(url)
            
            if not content:
                return {
                    "title": "无法获取内容",
                    "content": "无法从链接中获取内容，请检查链接是否有效。",
                    "tags": ["错误"],
                    "category_path": "未分类",
                    "platform": platform,
                    "is_local_parse": True,
                    "mindmap": self._generate_mindmap_local("无法获取内容")
                }
            
            print(f">>> [DEBUG] 获取到内容长度: {len(content)} 字符")
            
            # 尝试使用AI分析
            if api_key and ai_platform:
                try:
                    print(f">>> [DEBUG] 开始AI分析，平台: {ai_platform}, 模型: {ai_model}")
                    result = await self.analyze_content_with_ai(content, platform, api_key, url, existing_folders, ai_platform, ai_model)
                    if result and "title" in result:
                        print(f">>> [DEBUG] AI分析成功，标题: {result['title']}")
                        return result
                    else:
                        print(f">>> [DEBUG] AI分析返回结果无效或为空，降级到本地解析")
                except Exception as e:
                    print(f">>> [DEBUG] AI分析异常，使用本地解析: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print(f">>> [DEBUG] 未配置API密钥或平台，使用本地解析")
            
            # 本地解析
            print(f">>> [DEBUG] 使用本地解析")
            result = self.local_parse_content(content, platform, url)
            return result
            
        except Exception as e:
            print(f">>> [ERROR] 解析链接失败: {e}")
            import traceback
            traceback.print_exc()
            return {
                "title": "解析失败",
                "content": f"解析链接时发生错误: {str(e)}",
                "tags": ["错误"],
                "category_path": "未分类",
                "platform": "unknown",
                "is_local_parse": True,
                "mindmap": None
            }

    async def fetch_content_via_jina(self, url: str) -> str:
        """通过Jina API获取网页内容"""
        try:
            jina_url = f"https://r.jina.ai/{url}"
            print(f">>> [DEBUG] 请求Jina API: {jina_url}")
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(jina_url, headers={
                    'Accept': 'text/plain'
                })
                
                if response.status_code == 200:
                    content = response.text
                    print(f">>> [DEBUG] Jina API返回内容长度: {len(content)} 字符")
                    # 清理Jina添加的元数据
                    content = self._clean_jina_content(content)
                    return content
                else:
                    print(f">>> [DEBUG] Jina API失败: {response.status_code}")
                    return ""
        except Exception as e:
            print(f">>> [DEBUG] Jina API错误: {e}")
            return ""
    
    def _clean_jina_content(self, content: str) -> str:
        """清理Jina API返回内容中的元数据"""
        # 移除 Title: xxx - Source 格式
        content = re.sub(r'^Title:\s*', '', content)
        # 移除 URL Source: xxx 行
        content = re.sub(r'\n?URL Source:\s*[^\n]+\n?', '\n', content)
        # 移除 Markdown Content: 行
        content = re.sub(r'\n?Markdown Content:\s*\n?', '\n', content)
        # 移除末尾的 - 豆包, - 知乎 等来源标记
        content = re.sub(r'\s+-\s+\w+\s*$', '', content)
        return content.strip()

    async def fetch_content_directly(self, url: str) -> str:
        """直接获取网页内容"""
        try:
            print(f">>> [DEBUG] 尝试直接获取: {url}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                
                if response.status_code == 200:
                    content = response.text
                    # 简单提取文本
                    content = re.sub(r'<[^>]+>', '', content)
                    content = re.sub(r'\s+', ' ', content).strip()
                    print(f">>> [DEBUG] 直接获取内容长度: {len(content)} 字符")
                    return content[:5000]  # 限制长度
                else:
                    print(f">>> [DEBUG] 直接获取失败: {response.status_code}")
                    return ""
        except httpx.ConnectError as e:
            logger.error(f">>> 直接获取连接失败: {e}")
            return ""
        except Exception as e:
            print(f">>> [DEBUG direct] 错误: {e}")
            return ""

    async def analyze_content_with_ai(self, content: str, platform: str, api_key: str = None, url: str = None, existing_folders: List[str] = None, ai_platform: str = None, ai_model: str = None) -> Dict[str, Any]:
        """使用AI大模型分析内容 - 客户端分类"""
        try:
            # 构建已有文件夹提示
            folder_hint = ""
            if existing_folders and len(existing_folders) > 0:
                folder_hint = f"""
【已有文件分类目录】以下是用户现有的文件夹结构，请优先匹配：
{chr(10).join(f'  - {f}' for f in existing_folders[:30])}

如果内容能够完美匹配已有目录，请直接返回该路径。如果内容属于新知识点，请根据你的专业背景生成新的标准路径。"""

            # system 消息：角色定义和规则
            # 使用 replace 而不是 format 来避免 JSON 花括号被误解析
            system_prompt = SYSTEM_PROMPT.replace('{folder_hint}', folder_hint)
            # 转义其他可能的花括号
            system_prompt = system_prompt.replace('{{', '{').replace('}}', '}')
            
            # user 消息：网页内容（限制长度以加快AI响应）
            # 截取前8000字符，通常足够提取关键信息
            truncated_content = content[:8000] if len(content) > 8000 else content
            user_content = f"""【网页内容】---
{truncated_content}
---

请严格按照上述规则，返回JSON格式的分析结果。"""

            ai_response = await self.call_ai_api(system_prompt, user_content, api_key, platform=ai_platform, model=ai_model)
            
            if ai_response:
                print(f">>> [DEBUG] AI返回内容长度: {len(ai_response)}")
                print(f">>> [DEBUG] AI返回内容前200字符: {ai_response[:200]}")
                
                # 使用一键修复函数处理 AI 返回的 JSON，传入平台信息以便针对性处理
                result = self.fix_json_from_ai(ai_response, platform=ai_platform)
                
                if result and isinstance(result, dict):
                    print(f">>> [DEBUG] JSON解析成功，字段: {list(result.keys())}")
                    # 验证必要字段（title必须有）
                    if 'title' in result:
                        print(f">>> [DEBUG] AI分析结果标题: {result['title']}")
                        
                        # 处理不同命名格式的字段（支持多种AI返回格式）
                        # content字段：支持 content, content_markdown, 正文
                        result_content = (result.get('content_markdown', '') or 
                                         result.get('content', '') or 
                                         result.get('正文', ''))
                        
                        # 关键：将转义的 \n 还原为实际换行符，让 Markdown 能正确渲染
                        if result_content:
                            result_content = result_content.replace('\\n', '\n')
                            # 解码 Unicode 转义字符（如 \u901f\u67e5 → 速查）
                            result_content = self._decode_unicode_escapes(result_content)
                            
                            # 智谱AI特殊处理：删除 content_markdown 中与 title 重复的部分
                            if ai_platform == 'zhipuai' and result_title:
                                # 如果 content 以 # 开头，可能包含重复的标题
                                result_content = self._remove_duplicate_title_from_content(result_content, result_title)
                            
                            # OpenRouter特殊处理：清理 content 中的思考过程
                            if ai_platform == 'openrouter':
                                result_content = self._clean_openrouter_thinking(result_content)
                        
                        # 解码 title 中的 Unicode 转义字符
                        result_title = result.get('title', '')
                        if result_title:
                            result_title = self._decode_unicode_escapes(result_title)
                        
                        # category字段：支持 category, category_path, filePath, 分类路径
                        category_path = (result.get('category', '') or 
                                        result.get('category_path') or 
                                        result.get('filePath') or 
                                        result.get('分类路径') or 
                                        '未分类')
                        
                        # tags字段
                        tags = result.get('tags', [])
                        
                        # summary字段：AI生成的摘要
                        summary = result.get('summary', '')
                        if summary:
                            summary = self._decode_unicode_escapes(summary)
                        
                        print(f">>> [DEBUG] AI分析结果分类: {category_path}")
                        
                        # 如果没有content，使用原始内容
                        if not result_content:
                            result_content = content[:5000]
                        
                        return {
                            'title': result_title,
                            'content': result_content,
                            'tags': tags,
                            'summary': summary,
                            'category_path': category_path,
                            'platform': platform,
                            'is_local_parse': False,
                            'mindmap': None
                        }
            
            if ai_response:
                print(f">>> [DEBUG] AI返回内容无法解析: {ai_response[:200]}...")
            else:
                print(f">>> [DEBUG] AI返回内容为空")
            return None
            
        except Exception as e:
            print(f">>> [ERROR] AI分析失败: {e}")
            import traceback
            traceback.print_exc()
            return None

    def fix_truncated_json(self, json_str: str) -> Optional[str]:
        """修复被截断的JSON"""
        try:
            # 尝试直接解析
            json.loads(json_str)
            return json_str
        except json.JSONDecodeError:
            # 尝试修复
            try:
                # 补全括号
                open_braces = json_str.count('{')
                close_braces = json_str.count('}')
                if open_braces > close_braces:
                    json_str += '}' * (open_braces - close_braces)
                
                # 补全引号
                open_quotes = json_str.count('"')
                if open_quotes % 2 != 0:
                    json_str += '"'
                
                # 尝试再次解析
                json.loads(json_str)
                return json_str
            except Exception:
                return None

    def clean_tags(self, tags: List[str]) -> List[str]:
        """清理标签 - 去除Emoji前缀, 保留纯文字"""
        cleaned = []
        for tag in tags:
            # 去除Emoji前缀（如果有的话）
            clean_tag = re.sub(r'^[\U0001F300-\U0001F9FF]\s*', '', tag)
            # 去除其他常见Emoji和特殊符号
            clean_tag = re.sub(r'^[🍁🍂🍃📝💡🔍✅❌⚠️📌✨⭐📊📈📉\s]+', '', clean_tag)
            clean_tag = clean_tag.strip()
            if clean_tag and len(clean_tag) >= 2 and len(clean_tag) <= 10:
                cleaned.append(clean_tag)
        return cleaned[:5] if cleaned else ['总结']

    def local_parse_content(self, content: str, platform: str, url: str = None) -> Dict[str, Any]:
        """增强型本地解析 - 默认降级方案"""
        # 从.jina.ai返回的内容中提取标题 - 改进版
        title = None
        
        # 1. 首先尝试匹配一级标题 # 
        jina_title_match = re.search(r'^#\s*(.+)', content, re.MULTILINE)
        if jina_title_match:
            title = jina_title_match.group(1).strip()
        else:
            # 2. 尝试匹配二级标题 ## 
            jina_title_match = re.search(r'^##\s*(.+)', content, re.MULTILINE)
            if jina_title_match:
                title = jina_title_match.group(1).strip()
            else:
                # 3. 尝试匹配粗体标题 **标题**
                jina_title_match = re.search(r'\*\*(.+?)\*\*', content)
                if jina_title_match:
                    title = jina_title_match.group(1).strip()
                else:
                    # 4. 尝试匹配第一行非空文本（去除URL等）
                    lines = content.split('\n')
                    for line in lines:
                        line = line.strip()
                        # 跳过空行、URL、标记行
                        if not line or line.startswith('http') or line.startswith('URL') or line.startswith('Markdown'):
                            continue
                        # 跳过过短的行
                        if len(line) >= 5:
                            title = line
                            break
                    
                    # 5. 如果都没找到，取前50个字符
                    if not title:
                        title = content[:50].strip().replace('\n', ' ')
        
        # 清理标题中的各种后缀和标记
        # 移除Jina添加的 "- 豆包"、"- 知乎" 等后缀
        title = re.sub(r'\s*-\s*\w+$', '', title)
        # 移除 "｜" 后面的内容
        title = re.sub(r'\s*｜\s*.*$', '', title)
        # 移除 URL Source 标记
        title = re.sub(r'\s*URL Source:.*$', '', title, flags=re.MULTILINE | re.IGNORECASE)
        # 移除 Markdown Content 标记
        title = re.sub(r'\s*Markdown Content:.*$', '', title, flags=re.MULTILINE | re.IGNORECASE)
        # 保留 Markdown 格式标记（**、*、`），不移除
        title = title.strip()
        
        # 限制标题长度，避免过长
        if len(title) > 15:
            # 尝试在标点符号处截断
            truncate_pos = -1
            for punct in ['。', '，', '；', '！', '？', '.', ',', ';', '!', '?']:
                pos = title[:15].rfind(punct)
                if pos > truncate_pos:
                    truncate_pos = pos
            
            if truncate_pos > 10:  # 至少保留10个字符
                title = title[:truncate_pos + 1]
            else:
                title = title[:15] + '...'
        
        # 提取标签
        tags = self.extract_tags_from_content(content)
        
        # 生成分类路径
        category_path = self.recommend_category(content, platform)
        
        # 格式化内容 - 添加结构化的标题
        formatted_content = self._format_local_content(content, title)
        
        return {
            'title': title,
            'content': formatted_content,
            'tags': tags,
            'category_path': category_path,
            'platform': platform,
            'is_local_parse': True,
            'mindmap': None
        }
    
    def _format_local_content(self, content: str, title: str) -> str:
        """格式化本地解析的内容，添加结构化标题"""
        # 清理 Jina 添加的元数据
        content = self._clean_jina_content(content)
        
        # 如果内容已经有 # 标题，直接返回
        if content.strip().startswith('#'):
            return content
        
        # 分析内容结构，提取主要章节
        lines = content.split('\n')
        
        # 查找可能的章节标题（粗体、数字编号等）
        sections = []
        current_section = []
        
        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                continue
                
            # 检测章节标题模式
            is_heading = False
            
            # 模式1: **标题** 格式
            if re.match(r'^\*\*[^*]+\*\*$', line_stripped):
                is_heading = True
            # 模式2: 数字编号 + 标题（如 "1. 标题"、"一、标题"）
            elif re.match(r'^[\d一二三四五六七八九十]+[\.、\s]+', line_stripped):
                is_heading = True
            # 模式3: 包含"速算"、"公式"、"技巧"等关键词的短行
            elif len(line_stripped) < 30 and any(kw in line_stripped for kw in ['速算', '公式', '技巧', '方法', '口诀', '结论']):
                is_heading = True
            
            if is_heading and current_section:
                # 保存当前章节
                sections.append('\n'.join(current_section))
                current_section = [line_stripped]
            else:
                current_section.append(line)
        
        # 添加最后一个章节
        if current_section:
            sections.append('\n'.join(current_section))
        
        # 构建格式化内容
        formatted_lines = []
        
        # 添加主标题
        if not content.strip().startswith('#'):
            formatted_lines.append(f"# {title}")
            formatted_lines.append('')
        
        # 添加速览部分
        formatted_lines.append('# 🍁速览')
        formatted_lines.append('')
        
        # 提取核心要点（前3-5个关键信息）
        key_points = self._extract_key_points(content)
        for point in key_points[:5]:
            formatted_lines.append(f"- {point}")
        
        formatted_lines.append('')
        formatted_lines.append('# 🍂核心要点')
        formatted_lines.append('')
        
        # 添加章节内容
        for i, section in enumerate(sections[:10], 1):  # 最多10个章节
            section_lines = section.split('\n')
            if section_lines:
                first_line = section_lines[0].strip()
                # 如果是标题行，使用 ## 格式
                if first_line.startswith('**') and first_line.endswith('**'):
                    heading = first_line[2:-2].strip()
                    formatted_lines.append(f"## {heading}")
                elif re.match(r'^[\d一二三四五六七八九十]+[\.、\s]+', first_line):
                    # 移除数字编号，保留标题
                    heading = re.sub(r'^[\d一二三四五六七八九十]+[\.、\s]+', '', first_line)
                    formatted_lines.append(f"## {heading}")
                else:
                    formatted_lines.append(f"## 要点 {i}")
                
                # 添加内容行
                for line in section_lines[1:]:
                    if line.strip():
                        formatted_lines.append(line)
                formatted_lines.append('')
        
        # 添加详细正文
        formatted_lines.append('# 🍃详细正文')
        formatted_lines.append('')
        formatted_lines.append(content[:3000])  # 保留原始内容的前3000字符
        
        return '\n'.join(formatted_lines)
    
    def _extract_key_points(self, content: str) -> List[str]:
        """从内容中提取关键要点"""
        points = []
        
        # 查找公式
        formula_matches = re.findall(r'[\u4e00-\u9fa5]+\s*[=＝]\s*[^\n]+', content)
        for match in formula_matches[:3]:
            points.append(match.strip())
        
        # 查找口诀
        koujue_matches = re.findall(r'口诀[：:]\s*([^\n]+)', content)
        for match in koujue_matches[:2]:
            points.append(f"口诀：{match.strip()}")
        
        # 查找速算方法
        susuan_matches = re.findall(r'(?:速算|技巧)[：:]\s*([^\n]+)', content)
        for match in susuan_matches[:2]:
            points.append(f"速算：{match.strip()}")
        
        # 如果要点太少，添加一些粗体内容
        if len(points) < 3:
            bold_matches = re.findall(r'\*\*([^*]+)\*\*', content)
            for match in bold_matches[:3]:
                if len(match) > 5 and len(match) < 50:
                    points.append(match.strip())
        
        return points if points else ['核心知识点整理']

    async def call_ai_api(self, system_prompt: str, user_content: str, api_key: str = None, platform: str = None, model: str = None, retry_count: int = 1) -> Optional[str]:
        """调用AI大模型API - 统一参数配置器"""
        max_retries = 3  # 增加重试次数，应对速率限制
        import asyncio
        
        if api_key is not None:
            api_key = api_key.strip()
        
        if api_key is None or api_key == '':
            logger.warning("未配置API Key，跳过AI分析")
            print(f">>> [DEBUG] 未配置API Key，跳过AI分析")
            return None
        
        platform = platform or 'siliconflow'
        config = API_CONFIGS.get(platform, API_CONFIGS['siliconflow'])
        use_model = model or config['default_model']
        
        print(f">>> [DEBUG] ========== 统一API调用 ==========")
        print(f">>> [DEBUG] 平台: {config['name']}")
        print(f">>> [DEBUG] 模型: {use_model}")
        print(f">>> [DEBUG] API Key前15位: {api_key[:15]}...")
        
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    print(f">>> [DEBUG] 重试 {attempt}/{max_retries-1}")
                
                headers = config['headers'](api_key)
                
                # 根据平台调整参数
                print(f">>> [DEBUG] 平台参数: {platform}, 模型: {use_model}")
                # 根据平台调整系统提示词
                platform_adjustment = PLATFORM_PROMPT_ADJUSTMENTS.get(platform, "")
                adjusted_prompt = system_prompt + platform_adjustment
                
                if platform == 'modelscope':
                    # ModelScope 特定参数
                    print(f">>> [DEBUG] 使用ModelScope特定参数")
                    payload = {
                        "model": use_model,
                        "messages": [
                            {"role": "system", "content": adjusted_prompt[:2000]},  # 限制system prompt长度
                            {"role": "user", "content": user_content[:6000]}  # 增加user content长度
                        ],
                        "temperature": 0.7,
                        "max_tokens": 4096,  # 合理的输出长度
                        "stream": False
                    }
                elif platform == 'openrouter':
                    # OpenRouter 免费模型
                    print(f">>> [DEBUG] 使用OpenRouter特定参数")
                    payload = {
                        "model": use_model,
                        "messages": [
                            {"role": "system", "content": adjusted_prompt},
                            {"role": "user", "content": user_content[:4000]}  # 限制输入长度
                        ],
                        "temperature": 0.3,
                        "max_tokens": 4096,  # 合理的输出长度
                        "stream": False
                    }
                elif platform == 'zhipuai':
                    # 智谱AI特定参数
                    print(f">>> [DEBUG] 使用智谱AI特定参数")
                    payload = {
                        "model": use_model,
                        "messages": [
                            {"role": "system", "content": adjusted_prompt},
                            {"role": "user", "content": user_content[:6000]}
                        ],
                        "temperature": 0.5,  # 稍高的温度，避免重复
                        "max_tokens": 4096,  # 合理的输出长度
                        "stream": False
                    }
                else:
                    payload = {
                        "model": use_model,
                        "messages": [
                            {"role": "system", "content": adjusted_prompt},
                            {"role": "user", "content": user_content}
                        ],
                        "temperature": 0.3,
                        "max_tokens": 4096,  # 合理的输出长度
                        "stream": False
                    }
                
                print(f">>> [DEBUG] 调用API: {config['base_url']}")
                print(f">>> [DEBUG] 请求内容长度: {len(user_content)} 字符")
                
                # 设置60秒超时
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(config['base_url'], headers=headers, json=payload)
                    
                    print(f">>> [DEBUG] API响应状态: {response.status_code}")
                    
                    if response.status_code == 200:
                        result = response.json()
                        print(f">>> [DEBUG] API返回结果: {str(result)[:200]}...")
                        if 'choices' in result and len(result['choices']) > 0:
                            choice = result['choices'][0]
                            print(f">>> [DEBUG] Choice: {str(choice)[:200]}...")
                            message = choice.get('message', {})
                            print(f">>> [DEBUG] Message: {str(message)[:200]}...")
                            content = message.get('content')
                            
                            # 检查 finish_reason
                            finish_reason = choice.get('finish_reason') or choice.get('native_finish_reason')
                            if finish_reason == 'length':
                                print(f">>> [DEBUG] API返回内容被截断 (finish_reason: length)")
                            
                            # 有些模型把内容放在 reasoning 字段
                            if not content:
                                reasoning = message.get('reasoning')
                                if reasoning:
                                    print(f">>> [DEBUG] 从 reasoning 字段获取内容，长度: {len(reasoning)}")
                                    content = reasoning
                            
                            if content:
                                print(f">>> [DEBUG] API调用成功，返回内容长度: {len(content)}")
                                return content
                            else:
                                print(f">>> [DEBUG] API返回内容为空")
                                # 避免打印包含emoji的完整响应，防止Windows终端编码错误
                                try:
                                    print(f">>> [DEBUG] 完整响应: {str(result)[:500]}...")
                                except:
                                    print(f">>> [DEBUG] 完整响应: (包含无法编码的字符)")
                    else:
                        error_text = response.text[:500]
                        print(f">>> [DEBUG] API错误: {response.status_code} - {error_text}")
                        print(f">>> [DEBUG] 请求URL: {config['base_url']}")
                        print(f">>> [DEBUG] 请求模型: {use_model}")
                        
                        # 429 错误：等待后重试
                        if response.status_code == 429:
                            wait_time = 2 * (attempt + 1)  # 递增等待时间：2s, 4s, 6s
                            print(f">>> [DEBUG] 遇到速率限制，等待 {wait_time} 秒后重试...")
                            await asyncio.sleep(wait_time)
                            continue
                        
            except httpx.TimeoutException:
                print(f">>> [DEBUG] API超时")
            except Exception as e:
                print(f">>> [DEBUG] API调用错误: {e}")
                import traceback
                traceback.print_exc()
        
        print(f">>> [DEBUG] API调用失败，已达到最大重试次数")
        return None

    def get_recommended_platforms(self, current_platform: str) -> str:
        """获取推荐的平台列表 (排除当前平台)"""
        platform_order = ['siliconflow', 'modelscope', 'zhipuai', 'openrouter']
        recommended = []
        
        for platform in platform_order:
            if platform != current_platform:
                config = API_CONFIGS.get(platform)
                if config:
                    recommended.append(config['name'])
        
        return '、'.join(recommended[:2])  # 只推荐前2个    

    async def test_api_connection(self, platform: str, api_key: str, model: str = None) -> Dict[str, Any]:
        """测试API连接是否有效"""
        try:
            print(f">>> [DEBUG] ========== 测试API连接 ==========")
            print(f">>> [DEBUG] 平台: {platform}")
            print(f">>> [DEBUG] 模型: {model}")
            print(f">>> [DEBUG] API Key前15位: {api_key[:15] if api_key else 'None'}...")
            
            # 构建简单的测试提示词
            system_prompt = """你是一个AI助手, 请简单回答'连接成功'四个字."""
            user_content = "请回答'连接成功'."
            
            # 调用API
            response = await self.call_ai_api(system_prompt, user_content, api_key, platform, model)
            
            if response:
                print(f">>> [DEBUG] API返回内容: {response[:100]}...")
                # 只要有返回内容就算成功，不强制要求包含"连接成功"
                if len(response) > 0:
                    print(f">>> [DEBUG] API连接测试成功")
                    return {
                        "success": True,
                        "message": f"{API_CONFIGS.get(platform, {}).get('name', platform)} 连接成功",
                        "platform": platform,
                        "model": model
                    }
                else:
                    print(f">>> [DEBUG] API返回内容为空")
                    return {
                        "success": False,
                        "message": f"{API_CONFIGS.get(platform, {}).get('name', platform)} 连接失败, 返回内容为空",
                        "error": "返回内容为空"
                    }
            else:
                print(f">>> [DEBUG] API返回内容为空: {response}")
                return {
                    "success": False,
                    "message": f"{API_CONFIGS.get(platform, {}).get('name', platform)} 连接失败, 无响应内容",
                    "error": "无响应内容"
                }
                
        except Exception as e:
            error_msg = str(e)
            print(f">>> [DEBUG] API连接测试失败: {error_msg}")
            
            # 解析错误类型
            if "401" in error_msg or "密钥无效" in error_msg:
                message = f"{API_CONFIGS.get(platform, {}).get('name', platform)} API密钥无效"
            elif "402" in error_msg or "余额不足" in error_msg:
                message = f"{API_CONFIGS.get(platform, {}).get('name', platform)} 余额不足"
            elif "429" in error_msg or "频繁" in error_msg:
                message = f"{API_CONFIGS.get(platform, {}).get('name', platform)} 请求过于频繁"
            elif "timeout" in error_msg or "超时" in error_msg:
                message = f"{API_CONFIGS.get(platform, {}).get('name', platform)} 连接超时"
            else:
                message = f"{API_CONFIGS.get(platform, {}).get('name', platform)} 连接失败"
            
            return {
                "success": False,
                "message": message,
                "error": error_msg
            }

    def detect_platform(self, url: str) -> str:
        """检测链接平台"""
        platforms = {
            'zhihu': r'zhihu\.com',
            'bilibili': r'bilibili\.com',
            'youtube': r'youtube\.com',
            'twitter': r'twitter\.com',
            'github': r'github\.com',
            'medium': r'medium\.com',
            'blog': r'blog\.|\.blog',
            'news': r'news\.|\.news',
            'wiki': r'wiki\.|wiki',
            'doc': r'\.(pdf|doc|docx|md|txt)$'
        }
        
        for platform, pattern in platforms.items():
            if re.search(pattern, url, re.IGNORECASE):
                return platform
        
        return 'unknown'

    def recommend_category(self, content: str, platform: str) -> str:
        """推荐分类 - 基于内容关键词智能分类"""
        content_lower = content.lower()
        
        # 定义分类规则（按优先级排序，越具体的规则越靠前）
        category_rules = [
            # 公考/行测类
            {
                'path': '公考/行测/资料分析',
                'keywords': ['公考', '行测', '资料分析', '速算', '现期', '基期', '增长率', '比重', '倍数', '平均数', '截位直除', '百化分']
            },
            {
                'path': '公考/行测/数量关系',
                'keywords': ['数量关系', '数学运算', '行程问题', '工程问题', '排列组合', '概率']
            },
            {
                'path': '公考/申论',
                'keywords': ['申论', '公文写作', '综合分析', '对策建议', '大作文']
            },
            {
                'path': '公考/面试',
                'keywords': ['公务员面试', '结构化面试', '无领导小组', '面试技巧', '答题思路']
            },
            # 技术开发类
            {
                'path': '技术/前端开发/React',
                'keywords': ['react', 'reactjs', 'hooks', 'jsx', '组件', 'virtual dom']
            },
            {
                'path': '技术/前端开发/Vue',
                'keywords': ['vue', 'vuejs', 'vue3', 'composition api', 'pinia', 'vuex']
            },
            {
                'path': '技术/前端开发/基础',
                'keywords': ['html', 'css', 'javascript', 'js', 'es6', 'typescript', 'ts', '前端']
            },
            {
                'path': '技术/后端开发/Python',
                'keywords': ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy']
            },
            {
                'path': '技术/后端开发/Java',
                'keywords': ['java', 'spring', 'springboot', 'mybatis', 'maven', 'gradle']
            },
            {
                'path': '技术/数据库',
                'keywords': ['sql', 'mysql', 'postgresql', 'mongodb', 'redis', '数据库']
            },
            {
                'path': '技术/运维/DevOps',
                'keywords': ['docker', 'kubernetes', 'k8s', 'linux', 'nginx', 'git', 'ci/cd', 'devops']
            },
            # 人工智能类
            {
                'path': '人工智能/机器学习',
                'keywords': ['机器学习', 'machine learning', '深度学习', 'deep learning', '神经网络', 'tensorflow', 'pytorch']
            },
            {
                'path': '人工智能/大模型',
                'keywords': ['大模型', 'llm', 'gpt', 'chatgpt', 'claude', 'prompt', '提示词', 'rag']
            },
            # 教育学习类
            {
                'path': '教育/语言学习/英语',
                'keywords': ['英语', '雅思', '托福', 'gre', '四六级', '考研英语']
            },
            {
                'path': '教育/考研',
                'keywords': ['考研', '研究生', '考研数学', '考研政治', '专业课']
            },
            {
                'path': '教育/学习方法',
                'keywords': ['学习方法', '记忆技巧', '笔记方法', '高效学习', '时间管理']
            },
            # 职场工作类
            {
                'path': '职场/求职面试',
                'keywords': ['简历', '面试', '求职', '跳槽', 'offer', 'hr']
            },
            {
                'path': '职场/技能提升',
                'keywords': ['ppt', 'excel', 'word', '办公技能', '沟通技巧', '演讲']
            },
            {
                'path': '职场/管理',
                'keywords': ['管理', '领导力', '团队', '项目管理', '敏捷']
            },
            # 生活健康类
            {
                'path': '生活/健康/运动健身',
                'keywords': ['健身', '运动', '跑步', '瑜伽', '减肥', '增肌']
            },
            {
                'path': '生活/健康/饮食营养',
                'keywords': ['营养', '饮食', '健康', '食谱', '减脂餐']
            },
            {
                'path': '生活/理财投资',
                'keywords': ['理财', '投资', '基金', '股票', '保险', '财务自由']
            },
            # 内容平台类
            {
                'path': '知识/知乎',
                'keywords': ['知乎'],
                'platforms': ['zhihu']
            },
            {
                'path': '视频/B站',
                'keywords': ['b站', 'bilibili', '弹幕'],
                'platforms': ['bilibili']
            },
            {
                'path': '代码/GitHub',
                'keywords': ['github', '开源', 'repository'],
                'platforms': ['github']
            },
        ]
        
        # 计算每个分类的匹配分数
        category_scores = {}
        for rule in category_rules:
            score = 0
            # 关键词匹配
            for keyword in rule['keywords']:
                if keyword.lower() in content_lower:
                    score += 1
            # 平台匹配（额外加分）
            if 'platforms' in rule and platform in rule['platforms']:
                score += 2
            
            if score > 0:
                category_scores[rule['path']] = score
        
        # 返回匹配分数最高的分类
        if category_scores:
            best_category = max(category_scores.items(), key=lambda x: x[1])
            return best_category[0]
        
        # 根据平台默认分类
        platform_defaults = {
            'zhihu': '知识/知乎',
            'bilibili': '视频/B站',
            'github': '代码/GitHub',
            'youtube': '视频/YouTube',
            'twitter': '社交/Twitter',
            'medium': '写作/Medium',
        }
        
        if platform in platform_defaults:
            return platform_defaults[platform]
        
        return "其他/未分类"

    def extract_tags_from_content(self, content: str) -> List[str]:
        """从内容中提取标签"""
        # 简单的标签提取逻辑
        words = re.findall(r'\b\w{2,10}\b', content)
        # 统计词频
        word_count = {}
        for word in words:
            if len(word) >= 2:
                word_count[word] = word_count.get(word, 0) + 1
        # 按词频排序，取前5个
        sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)
        tags = [word for word, _ in sorted_words[:5]]
        
        # 如果没有提取到标签，返回默认标签
        if not tags:
            tags = ['总结', 'AI']
        
        # 清理标签
        tags = self.clean_tags(tags)
        
        print(f">>> [DEBUG] 提取的标签: {tags}")
        return tags

    def _generate_mindmap_local(self, content: str, title: str = "") -> Dict[str, Any]:
        """万能解析标准 - 适配所有文章结构，自动适配无标题/多格式/嵌套"""
        lines = content.split('\n')
        nodes = []
        node_counter = 1
        
        root_text = title if title else "中心主题"
        root_id = "root"
        root_node = {
            "id": root_id,
            "label": root_text,
            "parent": None
        }
        nodes.append(root_node)
        node_counter += 1

        # 万能权重系统 - 从高到低
        WEIGHT = {
            'H1': 1,        # # 一级标题
            'H2': 2,        # ## 二级标题
            'H3': 3,        # ### 三级标题
            'H4': 4,        # #### 四级标题
            'H5': 5,        # ##### 五级标题
            'H6': 6,        # ###### 六级标题
            'CHINESE_NUM': 7, # 一、二、三、
            'BOLD_LINE': 8, # **独立独占一行的加粗短句**
            'ARABIC_NUM': 9,  # 1. 2. 3.
            'PAREN_NUM': 10,  # (1) (2)
            'LIST_0': 11,     # 无缩进列表
            'LIST_1': 12,     # 1级缩进（2空格）
            'LIST_2': 13,     # 2级缩进（4空格）
            'LIST_3': 14,     # 3级缩进（6空格）
            'CONTENT': 15,    # 普通正文段落
        }

        def strip_markdown_formatting(text: str) -> str:
            """去除 Markdown 格式标记，保留纯文本"""
            text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
            text = re.sub(r'__(.+?)__', r'\1', text)
            text = re.sub(r'\*(.+?)\*', r'\1', text)
            text = re.sub(r'_(.+?)_', r'\1', text)
            text = re.sub(r'~~(.+?)~~', r'\1', text)
            text = re.sub(r'`(.+?)`', r'\1', text)
            text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)
            text = re.sub(r'!\[(.*?)\]\(.+?\)', r'\1', text)
            return text.strip()

        def is_table_row(line: str) -> bool:
            """检查是否是表格行"""
            return bool(re.match(r'^\s*\|?[-:]+\|', line)) or bool(re.match(r'^\s*\|[^|]+\|', line))

        def get_indent_level(line: str) -> int:
            """计算缩进级别（每2空格=1级）"""
            match = re.match(r'^(\s*)', line)
            spaces = len(match.group(1)) if match else 0
            return spaces // 2

        def get_line_info(line: str) -> dict:
            """分析每行，返回权重、层级、文本、类型"""
            trimmed = line.strip()
            if not trimmed or is_table_row(trimmed):
                return None
            
            indent_level = get_indent_level(line)
            
            # # 标题
            h_match = re.match(r'^(#{1,6})\s+(.+)', trimmed)
            if h_match:
                level = len(h_match.group(1))
                text = strip_markdown_formatting(h_match.group(2))
                if not text:
                    return None
                return {
                    'weight': WEIGHT[f'H{level}'],
                    'level': level,
                    'text': text,
                    'type': f'h{level}'
                }
            
            # **独立加粗短句**（独占一行）
            if re.match(r'^\*\*(.+?)\*\*$', trimmed):
                text = strip_markdown_formatting(trimmed)
                if text:
                    return {
                        'weight': WEIGHT['BOLD_LINE'],
                        'level': 0,
                        'text': text,
                        'type': 'bold'
                    }
            
            # 中文数字：一、二、三、
            match = re.match(r'^([一二三四五六七八九十]+)[、.．]\s*(.+)', trimmed)
            if match:
                text = strip_markdown_formatting(match.group(2))
                if text:
                    return {
                        'weight': WEIGHT['CHINESE_NUM'],
                        'level': 1,
                        'text': text,
                        'type': 'chinese'
                    }
            
            # 阿拉伯数字：1. 2. 3.
            match = re.match(r'^(\d+)[、.．]\s*(.+)', trimmed)
            if match:
                text = strip_markdown_formatting(match.group(2))
                if text:
                    return {
                        'weight': WEIGHT['ARABIC_NUM'],
                        'level': 2,
                        'text': text,
                        'type': 'arabic'
                    }
            
            # 括号数字：(1) (2)
            match = re.match(r'^[（(](\d+)[)）]\s*(.+)', trimmed)
            if match:
                text = strip_markdown_formatting(match.group(2))
                if text:
                    return {
                        'weight': WEIGHT['PAREN_NUM'],
                        'level': 3,
                        'text': text,
                        'type': 'paren'
                    }
            
            # 列表项 - 根据缩进判断级别
            match = re.match(r'^[-*+]\s+(.+)', trimmed)
            if match:
                text = strip_markdown_formatting(match.group(1))
                if text:
                    if indent_level == 0:
                        weight = WEIGHT['LIST_0']
                        level = 0
                    elif indent_level == 1:
                        weight = WEIGHT['LIST_1']
                        level = 1
                    elif indent_level == 2:
                        weight = WEIGHT['LIST_2']
                        level = 2
                    else:
                        weight = WEIGHT['LIST_3']
                        level = 3
                    return {
                        'weight': weight,
                        'level': level,
                        'text': text,
                        'type': 'list'
                    }
            
            # 普通正文段落（有意义的短句）
            if len(trimmed) >= 5 and len(trimmed) < 100:
                if '：' in trimmed or ':' in trimmed or any(kw in trimmed for kw in ['规律', '原则', '方法', '技巧', '公式', '口诀', '重点', '关键']):
                    text = strip_markdown_formatting(trimmed)
                    if text:
                        return {
                            'weight': WEIGHT['CONTENT'],
                            'level': 0,
                            'text': text,
                            'type': 'content'
                        }
            
            return None

        # 解析所有行
        parsed_lines = []
        for line in lines:
            info = get_line_info(line)
            if info:
                parsed_lines.append(info)

        # 根据权重构建树
        stack = [None]  # 栈：root 在 index 0
        node_map = {root_id: root_node}  # node_id -> node

        for parsed in parsed_lines:
            node_id = f"node_{node_counter}"
            node_counter += 1
            
            # 限制文本长度
            text = parsed['text']
            if len(text) > 50:
                text = text[:47] + '...'
            
            # 确定父节点
            parent = None
            if parsed['type'] == 'h1':
                # # 一级 -> root 的子节点
                parent = root_node
                root_node['children'].append(node_id) if 'children' in root_node else None
                stack = [root_node, {"id": node_id}]
            elif parsed['type'] == 'h2':
                # ## 二级 -> # 的子节点
                parent = stack[1] if len(stack) > 1 and stack[1] else root_node
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(node_id)
                stack = [root_node, stack[1] if len(stack) > 1 else None, {"id": node_id}]
            elif parsed['type'] == 'h3':
                # h3 应该挂载到 h2 或 h1 下
                # 连续的 h3 应该是同级关系
                parent = stack[2] if len(stack) > 2 and stack[2] else (stack[1] if len(stack) > 1 and stack[1] else root_node)
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(node_id)
                # 重置 stack，确保连续的 h3 有相同的父节点
                # stack 结构: [root, h1, h2, current_h3]
                new_stack = [root_node]
                if len(stack) > 1 and stack[1]:
                    new_stack.append(stack[1])  # h1
                if len(stack) > 2 and stack[2]:
                    new_stack.append(stack[2])  # h2
                new_stack.append({"id": node_id})  # current h3
                stack = new_stack
            elif parsed['type'] == 'h4':
                parent = stack[3] if len(stack) > 3 and stack[3] else (stack[2] if len(stack) > 2 and stack[2] else root_node)
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(node_id)
                stack.append({"id": node_id})
            elif parsed['type'] in ['h5', 'h6']:
                parent = stack[-1] if stack[-1] else root_node
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(node_id)
                stack.append({"id": node_id})
            elif parsed['type'] == 'bold':
                # 独立加粗 -> 挂载到最近的父亲
                parent = stack[-1] if stack[-1] else root_node
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(node_id)
                stack.append({"id": node_id})
            elif parsed['type'] == 'chinese':
                # 中文数字 -> 挂载到 # 或 ##
                parent = stack[1] if len(stack) > 1 and stack[1] else root_node
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(node_id)
                stack.append({"id": node_id})
            elif parsed['type'] == 'arabic':
                # 阿拉伯数字 -> 挂载到 # 或 ## 下
                parent = stack[2] if len(stack) > 2 and stack[2] else (stack[1] if len(stack) > 1 and stack[1] else root_node)
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(node_id)
                stack.append({"id": node_id})
            elif parsed['type'] == 'paren':
                # 括号数字 -> 挂载到上一级
                parent = stack[-1] if stack[-1] else root_node
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(node_id)
                stack.append({"id": node_id})
            elif parsed['type'] == 'list':
                # 列表项：挂载到 stack 中最后一个节点（即最近的标题）
                # 列表项之间是平级关系，不应该互相挂载
                parent = stack[-1] if stack[-1] else root_node
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(node_id)
                # 列表项不加入stack，避免后续列表项挂载到它上面
            else:
                # content -> 挂载到最近的父亲
                parent = stack[-1] if stack[-1] else root_node
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(node_id)

            # 创建节点
            node = {
                "id": node_id,
                "label": text,
                "parent": parent['id'] if parent else root_id
            }
            nodes.append(node)
            node_map[node_id] = node

        # 转换为前端期望的格式（只有 label 和 parent）
        result_nodes = []
        for node in nodes:
            result_nodes.append({
                "id": node["id"],
                "label": node["label"],
                "parent": node.get("parent")
            })

        # 如果没有解析出任何子节点，使用备用方案
        if len(result_nodes) <= 1:
            key_sentences = []
            keywords = ['总结', '方法', '原理', '核心', '重点', '关键', '步骤', '注意', '公式', '口诀']
            
            for line in lines:
                line = line.strip()
                if line and len(line) > 5 and len(line) < 60:
                    if any(keyword in line for keyword in keywords):
                        key_sentences.append(line)
                    elif '：' in line and len(line) < 40:
                        key_sentences.append(line.split('：')[0])
            
            for i, sentence in enumerate(key_sentences[:10], 2):
                result_nodes.append({
                    "id": f"node_{i}",
                    "label": sentence[:40] + ('...' if len(sentence) > 40 else ''),
                    "parent": root_id
                })

        return {
            "nodes": result_nodes
        }

    def _convert_ai_mindmap_to_nodes(self, ai_data: Dict[str, Any], parent_id: str = None) -> Dict[str, Any]:
        """将AI生成的思维导图JSON转换为前端期望的节点格式（使用label和parent）"""
        nodes = []
        node_counter = 1
        
        # 需要过滤掉的节点名称（速览、核心要点等）
        filtered_keywords = ['速览', '核心要点', '🍁', '🍂', '概览', '要点总结']
        
        def should_filter_node(topic: str) -> bool:
            """检查节点是否应该被过滤"""
            if not topic:
                return False
            topic_lower = topic.lower()
            return any(keyword in topic_lower for keyword in filtered_keywords)
        
        def process_node(node_data: Dict[str, Any], parent: str = None):
            nonlocal nodes, node_counter
            
            topic = node_data.get('topic', '无标题')
            
            # 过滤掉速览、核心要点等节点及其子节点
            if should_filter_node(topic):
                return None
            
            node_id = f"node_{node_counter}"
            node_counter += 1
            
            # 长度限制
            if len(topic) > 40:
                topic = topic[:37] + '...'
            
            nodes.append({
                "id": node_id,
                "label": topic,
                "parent": parent
            })
            
            # 递归处理子节点
            children = node_data.get('children', [])
            for child in children:
                process_node(child, node_id)
            
            return node_id
        
        # 检查根节点的子节点，如果包含速览/核心要点/详细正文结构，只保留详细正文
        root_topic = ai_data.get('topic', '无标题')
        root_children = ai_data.get('children', [])
        
        # 检查是否是速览-核心要点-详细正文结构（更宽松的条件）
        has_overview = any(should_filter_node(child.get('topic', '')) for child in root_children)
        has_detail = any('详细' in child.get('topic', '') or '🍃' in child.get('topic', '') for child in root_children)
        
        # 创建根节点
        root_id = f"node_{node_counter}"
        node_counter += 1
        nodes.append({
            "id": root_id,
            "label": root_topic[:40] if len(root_topic) <= 40 else root_topic[:37] + '...',
            "parent": None
        })
        
        # 如果包含速览或核心要点，说明AI没有按要求生成，需要过滤
        if has_overview or has_detail:
            # 查找详细正文分支
            detail_child = None
            for child in root_children:
                child_topic = child.get('topic', '')
                if '详细' in child_topic or '🍃' in child_topic:
                    detail_child = child
                    break
            
            if detail_child:
                # 只保留详细正文分支的子节点
                detail_children = detail_child.get('children', [])
                for child in detail_children:
                    process_node(child, root_id)
            else:
                # 如果没有找到详细正文分支，过滤掉速览和核心要点后处理
                filtered_children = [
                    child for child in root_children 
                    if not should_filter_node(child.get('topic', ''))
                ]
                for child in filtered_children:
                    process_node(child, root_id)
        else:
            # 直接处理所有子节点
            for child in root_children:
                process_node(child, root_id)
        
        return {
            "nodes": nodes
        }
