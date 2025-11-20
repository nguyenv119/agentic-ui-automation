/**
 * Cleans response by removing markdown code blocks and whitespace.
 * Handles patterns like ```json ... ``` or ``` ... ```
 * @param content - Raw content from OpenAI response
 * @returns Cleaned JSON string ready for parsing
 */
export function cleanJsonResponse(content: string): string {
    if (!content) return "{}";
    
    let cleaned = content.trim();
    
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
    cleaned = cleaned.replace(/\n?```\s*$/i, "");
    cleaned = cleaned.trim();
    
    return cleaned;
  }