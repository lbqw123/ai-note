# Supabase 集成指南

## 项目概述

本指南将帮助您将 Supabase 集成到 AI 笔记项目中，实现以下功能：

- 邮箱登录/注册功能
- 数据库存储（笔记、文件夹、连接、AI设置）
- 行级安全（RLS）权限配置
- API密钥加密存储
- 学习属性云端同步
- 完整的 CRUD 操作

## 安装和配置

### 1. 配置环境变量

在前端项目根目录创建 `.env` 文件，并添加以下内容：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

在后端项目目录创建 `.env` 文件，并添加以下内容：

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

> 请将 `your-project` 和 `your-anon-key` 替换为您的 Supabase 项目实际值。

### 2. 安装依赖

前端：
```bash
npm install @supabase/supabase-js
```

后端：
```bash
pip install supabase
```

## 功能集成

### 1. 认证功能

前端使用方法：

```tsx
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, loading, error, signUp, signIn, signOut } = useAuth();

  // 注册
  const handleSignUp = async (email, password, username) => {
    try {
      await signUp(email, password, username);
    } catch (err) {
      console.error(err);
    }
  };

  // 登录
  const handleSignIn = async (email, password) => {
    try {
      await signIn(email, password);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      {user ? (
        <p>欢迎, {user.email}</p>
      ) : (
        <button onClick={() => handleSignIn(email, password)}>登录</button>
      )}
    </div>
  );
}
```

### 2. 数据库表结构

#### folders - 文件夹表
```sql
CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES folders(id),
    is_expanded BOOLEAN DEFAULT true,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### notes - 笔记表（包含metadata字段）
```sql
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    folder_id TEXT REFERENCES folders(id),
    tags TEXT[] DEFAULT '{}',
    source_url TEXT,
    source_platform TEXT,
    mindmap JSONB,
    mindmap_markdown TEXT,
    metadata JSONB DEFAULT '{}',  -- 新增：学习属性（难度、学习状态、摘要等）
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- metadata字段索引
CREATE INDEX idx_notes_metadata ON notes USING gin (metadata);
```

**metadata字段说明：**
```json
{
  "difficulty": 3,              // 难度等级 1-5
  "learningStatus": "learning", // 学习状态：new/learning/mastered
  "summary": "笔记摘要",         // AI生成的摘要
  "prerequisites": ["前置知识1"], // 前置知识列表
  "keyConcepts": ["核心概念1"],  // 核心概念列表
  "firstLearnedAt": "2024-03-26T10:00:00Z",
  "lastReviewedAt": "2024-03-26T10:00:00Z",
  "reviewCount": 5
}
```

#### connections - 连接表
```sql
CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    from_id TEXT REFERENCES notes(id),
    to_id TEXT REFERENCES notes(id),
    type TEXT DEFAULT 'related',
    label TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### api_keys - API密钥表（加密存储）
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    platform TEXT NOT NULL,
    key_token TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    iv TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### ai_settings - AI设置表
```sql
CREATE TABLE ai_settings (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    platform TEXT,
    model TEXT,
    api_key_token TEXT,
    settings_json TEXT,  -- 存储额外的JSON设置
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3. RLS 权限配置

为所有表启用行级安全：

```sql
-- folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own folders" ON folders
    FOR ALL USING (auth.uid() = user_id);

-- notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own notes" ON notes
    FOR ALL USING (auth.uid() = user_id);

-- connections
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own connections" ON connections
    FOR ALL USING (auth.uid() = user_id);

-- api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own api_keys" ON api_keys
    FOR ALL USING (auth.uid() = user_id);

-- ai_settings
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own ai_settings" ON ai_settings
    FOR ALL USING (auth.uid() = user_id);
```

### 4. 后端API集成

后端使用Supabase客户端进行数据库操作：

```python
from supabase import create_client
import os

# 初始化Supabase客户端
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")
supabase = create_client(supabase_url, supabase_key)

# 示例：获取用户的API密钥
def get_user_api_keys(user_id: str):
    result = supabase.table("api_keys").select("*").eq("user_id", user_id).execute()
    return result.data

# 示例：保存笔记（包含metadata）
def save_note(note_data: dict):
    result = supabase.table("notes").insert(note_data).execute()
    return result.data

# 示例：更新笔记metadata
def update_note_metadata(note_id: str, metadata: dict):
    result = supabase.table("notes").update({
        "metadata": metadata,
        "updated_at": "now()"
    }).eq("id", note_id).execute()
    return result.data
```

### 5. API密钥加密存储

后端提供API密钥加密功能：

```python
from cryptography.fernet import Fernet
import base64

class APIKeyEncryption:
    def __init__(self, master_key: str):
        self.cipher = Fernet(base64.urlsafe_b64encode(master_key.encode()[:32].ljust(32, b'0')))
    
    def encrypt(self, api_key: str) -> tuple:
        """返回 (encrypted_key, iv)"""
        encrypted = self.cipher.encrypt(api_key.encode())
        return base64.b64encode(encrypted).decode(), ""
    
    def decrypt(self, encrypted_key: str, iv: str = None) -> str:
        """解密API密钥"""
        decrypted = self.cipher.decrypt(base64.b64decode(encrypted_key))
        return decrypted.decode()
```

## 前端与后端交互

### 链接解析流程

1. 前端发送链接到后端
```tsx
const parseLink = async (url: string) => {
  const response = await fetch('/api/parse-link-new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return await response.json();
};
```

2. 后端处理流程
   - 从请求中获取用户ID（通过JWT token）
   - 查询用户的AI设置和API密钥
   - 调用Jina AI获取网页内容
   - 调用AI分析内容
   - 返回结构化数据

3. 前端接收数据并展示
```tsx
const result = await parseLink(url);
// result包含: title, content, tags, category_path, mindmap
```

### AI知识助手流程

1. 前端发送问题到后端
```tsx
const askAI = async (question: string, context: any) => {
  const response = await fetch('/api/ai/knowledge-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context })
  });
  return await response.json();
};
```

2. 后端处理
   - 检索用户相关笔记
   - 构建系统提示词
   - 调用AI生成回答
   - 返回Markdown格式回答

### 学习属性同步

前端自动同步学习属性到云端：

```tsx
// 更新学习状态
const updateLearningStatus = async (noteId: string, status: string) => {
  const metadata = { learningStatus: status };
  await supabase
    .from('notes')
    .update({ metadata })
    .eq('id', noteId);
};

// 更新难度
const updateDifficulty = async (noteId: string, difficulty: number) => {
  const metadata = { difficulty };
  await supabase
    .from('notes')
    .update({ metadata })
    .eq('id', noteId);
};
```

## 数据库操作示例

### 文件夹操作

```tsx
// 获取文件夹列表
const { data: folders } = await supabase
  .from('folders')
  .select('*')
  .eq('user_id', user.id);

// 创建文件夹
await supabase.from('folders').insert({
  id: generateId(),
  name: '新文件夹',
  parent_id: null,
  user_id: user.id
});
```

### 笔记操作（包含metadata）

```tsx
// 获取笔记列表
const { data: notes } = await supabase
  .from('notes')
  .select('*')
  .eq('user_id', user.id)
  .eq('folder_id', folderId);

// 创建笔记
await supabase.from('notes').insert({
  id: generateId(),
  title: '笔记标题',
  content: '笔记内容',
  folder_id: folderId,
  tags: ['标签1', '标签2'],
  metadata: {
    difficulty: 3,
    learningStatus: 'new',
    summary: ''
  },
  user_id: user.id
});

// 更新笔记metadata
await supabase.from('notes').update({
  metadata: {
    difficulty: 4,
    learningStatus: 'learning',
    summary: 'AI生成的摘要...'
  }
}).eq('id', noteId);
```

### 连接操作

```tsx
// 创建连接
await supabase.from('connections').insert({
  id: generateId(),
  from_id: note1Id,
  to_id: note2Id,
  type: 'related',
  label: '相关',
  user_id: user.id
});
```

## 数据同步策略

### 删除同步机制

为防止删除的笔记刷新后恢复，实现了删除ID记录：

```tsx
// 删除笔记时记录ID
const deleteNote = async (noteId: string) => {
  // 1. 从Supabase删除
  await supabase.from('notes').delete().eq('id', noteId);
  
  // 2. 记录删除ID
  const deletedIds = JSON.parse(localStorage.getItem('deleted_note_ids') || '[]');
  deletedIds.push({ id: noteId, deletedAt: new Date().toISOString() });
  localStorage.setItem('deleted_note_ids', JSON.stringify(deletedIds));
};

// 加载数据时过滤已删除
const loadNotes = async () => {
  const deletedIds = JSON.parse(localStorage.getItem('deleted_note_ids') || '[]');
  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id);
  
  // 过滤掉已删除的
  return notes.filter(n => !deletedIds.includes(n.id));
};
```

## 最近更新

### 2024-03-26
- ✨ 新增 `metadata` JSONB 字段到 notes 表
- ✨ 新增学习属性云端同步功能
- ✨ 新增删除同步机制，防止删除后恢复
- 🔧 优化数据加载策略，支持本地/云端合并
