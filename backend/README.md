# AI笔记 - 后端服务

## 技术栈
- FastAPI (Python)
- Supabase (PostgreSQL + 认证)
- httpx (异步HTTP请求)
- Pydantic (数据验证)

## 安装步骤

1. **安装Python依赖**
   ```bash
   pip install -r requirements.txt
   ```

2. **配置环境变量**
   - 编辑 `.env` 文件，设置以下配置：
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

3. **启动后端服务**
   ```bash
   python main.py
   ```
   服务将运行在 http://localhost:8000

## API文档
启动服务后，可访问以下地址查看API文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 主要API端点

### 链接解析
- `POST /api/parse-link-new` - 解析链接并AI分析内容
  - 支持通过Jina AI获取网页内容
  - 支持多种AI平台(OpenRouter、SiliconFlow等)
  - 自动生成标题、标签、分类、思维导图

### AI知识助手
- `POST /api/ai/knowledge-chat` - AI知识问答
  - 基于用户笔记内容回答问题
  - 支持上下文感知（当前笔记/文件夹/全部）
  - 返回Markdown格式回答

- `POST /api/ai/summarize-note` - 笔记自动摘要
  - 为笔记生成AI摘要
  - 提取核心概念和前置知识

### AI设置管理
- `GET /api/ai/settings/load` - 加载AI设置
- `POST /api/ai/settings/save` - 保存AI设置
- `POST /api/test-api-connection` - 测试API连接

### 文件夹管理
- `GET /api/folders` - 获取所有文件夹
- `POST /api/folders` - 创建文件夹
- `PUT /api/folders/{folder_id}` - 更新文件夹
- `DELETE /api/folders/{folder_id}` - 删除文件夹

### 笔记管理
- `GET /api/notes` - 获取笔记列表
- `GET /api/notes/{note_id}` - 获取单个笔记
- `POST /api/notes` - 创建笔记
- `PUT /api/notes/{note_id}` - 更新笔记
- `DELETE /api/notes/{note_id}` - 删除笔记

### 连接管理
- `GET /api/connections` - 获取连接列表
- `POST /api/connections` - 创建连接
- `DELETE /api/connections/{connection_id}` - 删除连接

### 思维导图生成
- `POST /api/generate-mindmap` - 生成思维导图

## 支持的AI平台

### OpenRouter
- 支持多种模型(nvidia/nemotron-3-super-120b-a12b:free等)
- 需要API Key

### SiliconFlow
- 默认使用Qwen/Qwen2.5-7B-Instruct
- 需要API Key

### DeepSeek
- 使用DeepSeek-V3
- 需要API Key

### 智谱AI (ZhipuAI)
- 使用GLM-4模型
- 需要API Key

### ModelScope
- 使用Qwen系列模型
- 需要API Key

## 核心功能说明

### 链接解析流程
1. 通过Jina AI获取网页内容
2. 清理元数据(Title、URL Source等)
3. 调用AI分析内容(标题、标签、分类、思维导图)
4. 返回结构化数据给前端

### AI知识助手流程
1. 接收用户问题和上下文（笔记/文件夹/全部）
2. 检索相关笔记内容
3. 构建系统提示词（包含笔记上下文）
4. 调用AI生成Markdown格式回答
5. 返回给前端显示

### 思维导图生成规范
- **记忆类/干货型**: 必须4-5层深度，每个要点详细展开
- **知识类**: 3-4层深度，突出结构与核心关系
- **操作类**: 4-5层深度，完整展开每个步骤

### 笔记摘要生成
- 提取笔记核心内容
- 识别前置知识需求
- 提取关键概念
- 生成学习建议

### 内容优化
- 减少AI请求超时时间(30秒)
- 减少重试次数(1次)
- 限制发送内容长度(4000字符)
- 减少max_tokens(2000)

## 最近更新

### 2024-03-26
- ✨ 新增 `/api/ai/knowledge-chat` 端点，支持AI知识问答
- ✨ 新增 `/api/ai/summarize-note` 端点，支持笔记自动摘要
- ✨ 新增AI提示词模板，优化知识问答质量
- 🔧 优化AI响应格式，统一返回Markdown
