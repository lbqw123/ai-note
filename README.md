# AI笔记 - 智能知识管理系统

一个基于 AI 的智能笔记应用，支持链接解析、自动分类、思维导图生成、知识图谱可视化和 AI 知识助手。

> 设计原型：[Figma 设计稿](https://www.figma.com/design/B9veExWd2p7zepuk1MN5w9/AI%E9%93%BE%E6%8E%A5%E6%99%BA%E8%83%BD%E7%AC%94%E8%AE%B0%E7%B3%BB%E7%BB%9F%E8%AE%BE%E8%AE%A1)

## 功能特性

### 核心功能
- **链接智能解析**：粘贴链接自动提取内容，AI 生成结构化笔记
- **自动分类系统**：基于内容自动分类到知识库文件夹结构
- **多视图展示**：支持笔记视图、思维导图、知识星链、关系图谱四种视图
- **AI 思维导图**：从详细正文自动生成层级分明的思维导图
- **知识关联**：笔记间建立连接，形成知识网络
- **文件夹管理**：无限层级文件夹，支持拖拽移动

### AI 知识助手
- **智能问答**：基于你的笔记内容回答问题
- **学习推荐**：根据笔记分析推荐下一步学习内容
- **进度总结**：按文件夹/学科分析学习进度
- **上下文感知**：自动识别当前笔记或文件夹范围
- **Markdown 弹窗**：AI 回答以精美弹窗展示，支持表格、粗体等格式

### AI 功能
- 支持多个 AI 平台：OpenRouter、SiliconFlow、智谱 AI、ModelScope
- 自定义 API 密钥和模型选择
- 智能内容分析和标签提取
- 自动分类路径生成
- 笔记自动摘要生成

### 学习属性（新功能）
- **难度等级**：1-5 星评级
- **学习状态**：新学/进行中/已掌握
- **云端同步**：学习属性保存到 Supabase，多设备同步

### 数据管理
- 本地存储：localStorage 保存数据
- 云端同步：Supabase 后端支持，登录后自动同步
- 文件夹管理：支持拖拽移动、层级结构
- 数据加密：API 密钥加密存储
- 删除同步：删除笔记后云端同步删除，防止恢复

## 技术栈

### 前端
- **框架**：React 18 + TypeScript
- **构建工具**：Vite 6
- **样式**：Tailwind CSS 4
- **UI 组件**：Radix UI + shadcn/ui
- **状态管理**：React Context + useState/useCallback
- **Markdown 渲染**：react-markdown + remark-gfm
- **拖拽**：HTML5 Drag and Drop API

### 后端
- **框架**：FastAPI (Python)
- **数据库**：Supabase (PostgreSQL)
- **AI 服务**：支持多平台 API 调用
- **部署**：支持本地和云端部署

### 主要依赖
```json
{
  "@supabase/supabase-js": "^2.99.3",
  "react-markdown": "^10.1.0",
  "remark-gfm": "^4.0.1",
  "lucide-react": "0.487.0",
  "recharts": "2.15.2",
  "canvas-confetti": "1.9.4"
}
```

## 项目结构

```
AI笔记/
├── src/
│   ├── app/
│   │   ├── App.tsx                 # 主应用组件
│   │   ├── store/
│   │   │   └── noteStore.tsx       # 全局状态管理
│   │   ├── components/
│   │   │   ├── Sidebar.tsx         # 侧边栏文件夹树
│   │   │   ├── NoteEditor.tsx      # 笔记编辑器
│   │   │   ├── MindMapView.tsx     # 思维导图视图
│   │   │   ├── KnowledgeGraphView.tsx  # 知识图谱
│   │   │   ├── AIAssistantPanel.tsx    # AI 知识助手
│   │   │   ├── NoteMetadataEditor.tsx  # 学习属性编辑器
│   │   │   ├── LinkParseModal.tsx  # 链接解析弹窗
│   │   │   ├── AISettingsModal.tsx # AI 设置弹窗
│   │   │   ├── AuthModal.tsx       # 登录/注册弹窗
│   │   │   └── TopNav.tsx          # 顶部导航
│   │   └── utils/
│   │       └── aiService.ts        # AI 服务工具
│   ├── lib/
│   │   └── supabase.ts             # Supabase 客户端
│   └── main.tsx                    # 入口文件
├── backend/
│   ├── main.py                     # FastAPI 主服务
│   └── ai_service.py               # AI 服务逻辑
├── public/                         # 静态资源
└── package.json
```

## 快速开始

### 环境要求
- Node.js 18+
- Python 3.9+ (后端)
- pnpm 或 npm

### 安装依赖

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd backend
pip install -r requirements.txt
```

### 配置环境变量

前端 `.env`：
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

后端 `.env`：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 启动开发服务器

```bash
# 启动前端
npm run dev

# 启动后端
cd backend
python main.py
```

## 最近更新

### 2024-03-26
- ✨ 新增 AI 知识助手，支持智能问答和学习推荐
- ✨ 新增学习属性（难度、学习状态）云端同步
- ✨ 新增 AI 回答 Markdown 弹窗，支持表格、粗体等格式
- 🐛 修复删除笔记后刷新恢复的问题
- 🐛 修复 AI 返回 JSON 格式显示问题
- 💄 优化 AI 助手对话框空状态显示

## 更多文档

- [Supabase 集成指南](./SUPABASE_INTEGRATION.md)
- [后端 API 文档](./backend/README.md)
