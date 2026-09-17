import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src';

describe('video generator worker', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('rejects non-POST requests', async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(new Request('http://example.com'), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Only POST method allowed' });
  });
  it('requires a prompt', async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(new Request('http://example.com', { method: 'POST', body: JSON.stringify({ prompt: '   ' }) }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Prompt is required' });
  });
  it('submits to Pixazo, polls, and returns the generated video', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ request_id: 'ltx-video_test', status: 'QUEUED' }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ request_id: 'ltx-video_test', status: 'COMPLETED', output: { media_url: ['https://cdn.example/video.mp4'] } })))
      .mockResolvedValueOnce(new Response('fake mp4', { headers: { 'Content-Type': 'video/mp4' } }));
    vi.stubGlobal('fetch', fetchMock);
    const ctx = createExecutionContext();
    const response = await worker.fetch(new Request('http://example.com', { method: 'POST', body: JSON.stringify({ prompt: 'a calm test video' }) }), { ...env, PIXAZO_API_KEY: 'test-key' }, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
    expect(await response.text()).toBe('fake mp4');
    expect(fetchMock.mock.calls[0][0]).toBe('https://gateway.pixazo.ai/ltx-video/v1/text-to-video');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ prompt: 'a calm test video' });
  }, 15000);
});
