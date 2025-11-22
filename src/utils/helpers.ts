/**
 * Cleans response by removing markdown code blocks, whitespace, and JSON comments.
 * Handles patterns like ```json ... ``` or ``` ... ```
 * Removes single-line comments (// ...) that OpenAI sometimes includes
 * @param content - Raw content from OpenAI response
 * @returns Cleaned JSON string ready for parsing
 */
export function cleanJsonResponse(content: string): string {
    if (!content) return "{}";
    
    let cleaned = content.trim();
    
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
    cleaned = cleaned.replace(/\n?```\s*$/i, "");
    cleaned = cleaned.trim();
    
    cleaned = cleaned.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) {
        return '';
      }
      let inString = false;
      let escapeNext = false;
      let result = '';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (escapeNext) {
          result += char;
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          result += char;
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          result += char;
          continue;
        }
        
        if (char === '/' && i + 1 < line.length && line[i + 1] === '/' && !inString) {
          break;
        }
        
        result += char;
      }
      
      return result;
    }).filter(line => line.trim().length > 0).join('\n');
    
    cleaned = cleaned.trim();
    
    return cleaned;
  }