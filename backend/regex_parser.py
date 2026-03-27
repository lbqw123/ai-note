import re
import httpx
import html
import json
from typing import Dict, Any, List
from bs4 import BeautifulSoup

class DoubaoLinkParser:
    def __init__(self):
        self.content_patterns = [
            r'<div[^>]*class="[^"]*flow-markdown-body[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*message-item[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*mobile-content[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*message-list-root[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*markdown-body[^"]*"[^>]*>(.*?)</div>',
        ]
        
        self.script_patterns = [
            r'window\.__INITIAL_STATE__\s*=\s*({[^\n]*?"messages":\[.*?\]});',
            r'"messages"\s*:\s*(\[.*?\])\s*,\s*"conversation"',
            r'__NEXT_DATA__\s*=\s*({.*?"props":{.*?"pageProps":{.*?"data":{.*?}}}})'
        ]
        
        self.irrelevant_keywords = [
            '广告', '推广', '登录', '注册', '会员', '充值', '付费',
            '下载', '安装', 'APP', '应用', '游戏', '活动',
            '客服', '帮助', '反馈', '联系我们', '关于我们',
            '隐私政策', '用户协议', '条款', '版权'
        ]
    
    async def parse(self, url: str) -> Dict[str, Any]:
        """解析网页，提取标题、用户提问和AI回答"""
        try:
            is_valid, formatted_url = self.validate_url(url)
            if not is_valid:
                return {
                    'title': '',
                    'user_question': '',
                    'ai_answer': '',
                    'success': False,
                    'error': 'URL格式无效'
                }
            
            html_content = await self.get_dynamic_html(formatted_url)
            
            title = self._extract_title(html_content)
            user_question, ai_answer = self._extract_with_beautifulsoup(html_content)
            
            return {
                'title': title,
                'user_question': user_question,
                'ai_answer': ai_answer,
                'success': True
            }
        except Exception as e:
            return {
                'title': '',
                'user_question': '',
                'ai_answer': '',
                'success': False,
                'error': str(e)
            }
    
    def validate_url(self, url):
        """URL验证和格式化"""
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.scheme and parsed.netloc, url
        except:
            return False, url
    
    async def get_dynamic_html(self, url):
        """获取动态渲染后的完整HTML"""
        try:
            # 直接使用HTTP请求，避免Playwright的问题
            response = httpx.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }, timeout=30)
            return response.text
        except Exception as e:
            raise Exception(f"获取页面内容失败: {str(e)}")
    
    def _extract_title(self, html: str) -> str:
        """提取文章标题"""
        title_match = re.search(r'<title>(.*?)</title>', html, re.DOTALL | re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()
            title = re.sub(r'\s+', ' ', title)
            title = title.replace(' - 豆包', '').replace(' - Kimi', '').replace(' - 通义千问', '')
            return title.strip() if title else 'AI对话笔记'
        return 'AI对话笔记'
    
    def _extract_with_beautifulsoup(self, html: str) -> tuple:
        """使用BeautifulSoup提取用户提问和AI回答"""
        soup = BeautifulSoup(html, 'html.parser')
        
        user_question = ""
        ai_answer = ""
        
        # 方法1: 尝试查找data-testid属性
        send_message = soup.find('div', {'data-testid': 'send_message'})
        if send_message:
            message_text = send_message.find('div', {'data-testid': 'message_text_content'})
            if message_text:
                user_question = message_text.get_text(strip=True)
        
        receive_message = soup.find('div', {'data-testid': 'receive_message'})
        if receive_message:
            markdown_body = receive_message.find('div', class_=lambda x: x and 'flow-markdown-body' in x)
            if markdown_body:
                ai_answer = markdown_body.get_text(separator='\n', strip=True)
        
        # 方法2: 尝试查找class属性
        if not user_question or not ai_answer:
            # 查找用户提问
            user_messages = soup.find_all('div', class_=lambda x: x and ('user' in x or 'send' in x or 'message' in x))
            for msg in user_messages:
                text = msg.get_text(separator='\n', strip=True)
                if text and len(text) > 10:
                    user_question = text
                    break
            
            # 查找AI回答
            ai_messages = soup.find_all('div', class_=lambda x: x and ('ai' in x or 'receive' in x or 'markdown' in x or 'content' in x))
            for msg in ai_messages:
                text = msg.get_text(separator='\n', strip=True)
                if text and len(text) > 50:
                    ai_answer = text
                    break
        
        # 方法3: 查找所有段落和文本内容
        if not user_question or not ai_answer:
            all_texts = []
            for element in soup.find_all(['p', 'div', 'span']):
                text = element.get_text(separator='\n', strip=True)
                if text and len(text) > 20:
                    all_texts.append(text)
            
            if len(all_texts) >= 2:
                user_question = all_texts[0]
                ai_answer = '\n'.join(all_texts[1:])
            elif len(all_texts) >= 1:
                ai_answer = all_texts[0]
        
        return user_question, ai_answer
    
    def extract_content(self, html):
        """多层内容提取"""
        all_matches = []
        
        send_pattern = r'<div[^>]*data-testid="send_message"[^>]*class="[^"]*message-item[^"]*"[^>]*>.*?<div[^>]*data-testid="message_text_content"[^>]*>(.*?)</div>'
        send_matches = re.findall(send_pattern, html, re.DOTALL | re.IGNORECASE)
        
        receive_pattern = r'<div[^>]*data-testid="receive_message"[^>]*class="[^"]*message-item[^"]*"[^>]*>.*?<div[^>]*class="[^"]*flow-markdown-body[^"]*"[^>]*>(.*?)</div>'
        receive_matches = re.findall(receive_pattern, html, re.DOTALL | re.IGNORECASE)
        
        if send_matches:
            all_matches.extend(send_matches)
        if receive_matches:
            all_matches.extend(receive_matches)
        
        if not all_matches:
            for pattern in self.content_patterns:
                matches = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)
                if matches:
                    all_matches.extend(matches)
                    break
        
        if not all_matches:
            for pattern in self.script_patterns:
                script_matches = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
                if script_matches:
                    try:
                        json_str = script_matches.group(1)
                        json_str = json_str.replace('\\', '').replace('$$', '')
                        data = json.loads(json_str)
                        
                        if isinstance(data, list):
                            messages = data
                        else:
                            messages = data.get('messages', [])
                        
                        for msg in messages:
                            if 'content' in msg and msg['content']:
                                all_matches.append(msg['content'])
                    except:
                        continue
        
        if not all_matches:
            main_content = re.search(r'<main[^>]*>(.*?)</main>', html, re.DOTALL)
            if main_content:
                all_matches.append(main_content.group(1))
            else:
                article_content = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
                if article_content:
                    all_matches.append(article_content.group(1))
        
        return all_matches
    
    def clean_content(self, text):
        """内容清理和过滤"""
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = html.unescape(text)
        
        for keyword in self.irrelevant_keywords:
            text = text.replace(keyword, '')
        
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    def separate_qa(self, content_list):
        """智能分离用户提问和AI回答"""
        user_question = ""
        ai_answer = ""
        
        if content_list:
            clean_blocks = [self.clean_content(block) for block in content_list if self.clean_content(block)]
            
            if clean_blocks:
                if len(clean_blocks) >= 2:
                    user_question = clean_blocks[0]
                    ai_answer = '\n\n'.join(clean_blocks[1:])
                else:
                    if len(clean_blocks[0]) > 50:
                        ai_answer = clean_blocks[0]
                    else:
                        user_question = clean_blocks[0]
        
        return user_question, ai_answer

if __name__ == '__main__':
    import asyncio
    
    async def main():
        parser = DoubaoLinkParser()
        
        url = input('请输入要解析的网页URL: ')
        result = await parser.parse(url)
        
        if result['success']:
            print(f'标题: {result["title"]}')
            print(f'\n用户提问:\n{result["user_question"]}')
            print(f'\nAI回答:\n{result["ai_answer"]}')
        else:
            print(f'解析失败: {result["error"]}')
    
    asyncio.run(main())