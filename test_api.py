import httpx
import json

async def test_parse_link():
    url = 'https://www.doubao.com/thread/w8b608fe4f39b14d4'
    
    print(f"Testing parse-link-new with URL: {url}")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            'http://localhost:8000/api/parse-link-new',
            json={'url': url}
        )
        
        print(f"Status code: {response.status_code}")
        
        try:
            data = response.json()
            print(f"Success: {data.get('success')}")
            print(f"Note title: {data.get('note', {}).get('title')}")
            print(f"Mindmap exists: {'mindmap' in data}")
            
            if 'mindmap' in data:
                print(f"Mindmap type: {type(data['mindmap'])}")
                print(f"Mindmap content: {json.dumps(data['mindmap'], indent=2, ensure_ascii=False)}")
            else:
                print("Mindmap not found in response")
                
        except json.JSONDecodeError:
            print("Failed to decode JSON response")
            print(f"Response content: {response.text}")

if __name__ == '__main__':
    import asyncio
    asyncio.run(test_parse_link())