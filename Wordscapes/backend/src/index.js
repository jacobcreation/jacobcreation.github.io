import { generatePuzzle } from './puzzleGenerator';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Simple CORS handling
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/api/puzzle') {
      try {
        const seedWord = url.searchParams.get('seed');
        const puzzle = await generatePuzzle(env.AI, seedWord);
        
        return new Response(JSON.stringify(puzzle), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
