# 检查文件中的语法错误
def check_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        print(f"文件包含 {len(lines)} 行")
        
        # 检查三引号字符串
        triple_quote_count = 0
        in_triple_quote = False
        
        for i, line in enumerate(lines, 1):
            # 计算三引号的数量
            quote_count = line.count('"""') + line.count("'''")
            triple_quote_count += quote_count
            
            # 检查是否在三引号字符串内
            if quote_count % 2 == 1:
                in_triple_quote = not in_triple_quote
            
            # 检查全角字符
            for char in line:
                if '\uff00' <= char <= '\uffef':
                    print(f"第 {i} 行包含全角字符: {char}")
            
            # 检查无效字符
            for char in line:
                if (0 <= ord(char) <= 31) or (127 <= ord(char) <= 159):
                    print(f"第 {i} 行包含无效字符: {repr(char)}")
        
        if triple_quote_count % 2 != 0:
            print("文件中存在未闭合的三引号字符串")
        else:
            print("文件中的三引号字符串都已闭合")
            
    except Exception as e:
        print(f"检查文件时出错: {e}")

if __name__ == "__main__":
    file_path = "ai_service.py"
    check_file(file_path)
