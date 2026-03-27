// 分析localStorage结构的脚本
// 在浏览器控制台中运行此脚本以查看localStorage数据结构

console.log('=== 分析localStorage结构 ===');

// 定义存储键
const STORAGE_KEYS = {
  FOLDERS: 'ai-notes-folders',
  NOTES: 'ai-notes-notes',
  CONNECTIONS: 'ai-notes-connections',
  AI_SETTINGS: 'ai-notes-ai-settings',
};

// 分析每个存储项
Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
  console.log(`\n--- 分析 ${key} (${storageKey}) ---`);
  
  try {
    const storedData = localStorage.getItem(storageKey);
    if (storedData) {
      const data = JSON.parse(storedData);
      console.log(`数据类型: ${Array.isArray(data) ? '数组' : typeof data}`);
      console.log(`数据长度: ${Array.isArray(data) ? data.length : 'N/A'}`);
      
      if (Array.isArray(data) && data.length > 0) {
        console.log('第一个元素结构:');
        console.log(data[0]);
        
        // 分析字段类型
        console.log('字段类型分析:');
        Object.entries(data[0]).forEach(([field, value]) => {
          console.log(`  ${field}: ${typeof value}`);
        });
      } else if (typeof data === 'object' && data !== null) {
        console.log('对象结构:');
        console.log(data);
        
        // 分析字段类型
        console.log('字段类型分析:');
        Object.entries(data).forEach(([field, value]) => {
          console.log(`  ${field}: ${typeof value}`);
        });
      }
    } else {
      console.log('无数据');
    }
  } catch (error) {
    console.error(`分析${key}时出错:`, error);
  }
});

console.log('\n=== 分析完成 ===');
