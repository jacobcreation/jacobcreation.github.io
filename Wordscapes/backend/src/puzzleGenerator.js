export async function generatePuzzle(ai, seedWord = null) {
  // 1. AI Word Generation
  const prompt = seedWord 
    ? `Generate a Wordscapes puzzle for the seed word "${seedWord}".` 
    : "Pick a common 6 or 7 letter English word and generate a Wordscapes puzzle from it.";

  const aiResponse = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { 
        role: "system", 
        content: "You are a Wordscapes puzzle generator. Return a JSON object with 'seedWord' and 'words'." 
      },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "puzzle",
        schema: {
          type: "object",
          properties: {
            seedWord: { type: "string" },
            words: { type: "array", items: { type: "string" } }
          },
          required: ["seedWord", "words"]
        }
      }
    }
  });

  // Handle various ways Workers AI might return the JSON
  let data = aiResponse;
  
  // If the response is a string, parse it
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) {}
  }
  
  // If it's wrapped in a .response property (common in some Worker versions)
  if (data && data.response && typeof data.response === 'string') {
    try { data = JSON.parse(data.response); } catch (e) {}
  } else if (data && data.response) {
    data = data.response;
  }

  const finalSeed = data?.seedWord;
  const words = data?.words;
  
  if (!finalSeed || !words || !Array.isArray(words)) {
    throw new Error(`Invalid AI response format. Received: ${JSON.stringify(aiResponse).substring(0, 100)}`);
  }
  
  // 2. Grid Layout Algorithm (Simple Greedy Backtracking)
  const layout = generateLayout(words);
  
  return {
    seedWord: finalSeed,
    letters: finalSeed.toUpperCase().split('').sort(() => Math.random() - 0.5),
    words: layout.placedWords,
    gridSize: layout.gridSize,
  };
}

function generateLayout(words) {
  words = words.map(w => w.toUpperCase()).sort((a, b) => b.length - a.length);
  const placedWords = [];
  const grid = {}; // key: "x,y", value: letter

  function canPlace(word, x, y, direction) {
    let hasIntersection = placedWords.length === 0;
    for (let i = 0; i < word.length; i++) {
      const curX = direction === 'H' ? x + i : x;
      const curY = direction === 'V' ? y + i : y;
      const char = word[i];
      const existing = grid[`${curX},${curY}`];
      
      if (existing) {
        if (existing !== char) return false;
        hasIntersection = true;
      } else {
        // Check neighbors to avoid accidental word creation
        const neighbors = direction === 'H' 
          ? [[0, 1], [0, -1], [i===0?-1:0, 0], [i===word.length-1?1:0, 0]]
          : [[1, 0], [-1, 0], [0, i===0?-1:0], [0, i===word.length-1?1:0]];
          
        for (const [dx, dy] of neighbors) {
          if (dx === 0 && dy === 0) continue;
          if (grid[`${curX + dx},${curY + dy}`]) return false;
        }
      }
    }
    return hasIntersection;
  }

  function place(word, x, y, direction) {
    for (let i = 0; i < word.length; i++) {
      const curX = direction === 'H' ? x + i : x;
      const curY = direction === 'V' ? y + i : y;
      grid[`${curX},${curY}`] = word[i];
    }
    placedWords.push({ word, x, y, direction });
  }

  // Place first word at 0,0
  place(words[0], 0, 0, 'H');

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    let found = false;
    
    // Try to find an intersection with already placed words
    search: for (const placed of placedWords) {
      for (let j = 0; j < placed.word.length; j++) {
        for (let k = 0; k < word.length; k++) {
          if (placed.word[j] === word[k]) {
            const direction = placed.direction === 'H' ? 'V' : 'H';
            const startX = direction === 'H' ? placed.x + j - k : placed.x + j;
            const startY = direction === 'V' ? placed.y + j - k : placed.y + j;
            
            if (canPlace(word, startX, startY, direction)) {
              place(word, startX, startY, direction);
              found = true;
              break search;
            }
          }
        }
      }
    }
  }

  // Normalize coordinates to start from 0,0
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  placedWords.forEach(pw => {
    minX = Math.min(minX, pw.x);
    minY = Math.min(minY, pw.y);
  });
  
  placedWords.forEach(pw => {
    pw.x -= minX;
    pw.y -= minY;
    maxX = Math.max(maxX, pw.x + (pw.direction === 'H' ? pw.word.length : 1));
    maxY = Math.max(maxY, pw.y + (pw.direction === 'V' ? pw.word.length : 1));
  });

  return { placedWords, gridSize: { cols: maxX, rows: maxY } };
}
