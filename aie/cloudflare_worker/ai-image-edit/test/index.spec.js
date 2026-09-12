import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";

describe("ai image edit worker", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses Pollinations Kontext as the primary image editor", async () => {
		const pollinationsFetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({ data: [{ b64_json: "cG9sbHluYXRpb25zLWltYWdl" }] }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
		);
		vi.stubGlobal("fetch", pollinationsFetch);
		const aiRun = vi.fn(async () => ({ image: "ZWRpdGVkLWltYWdl" }));

		const formData = new FormData();
		formData.set(
			"image",
			new File(["source-image"], "source.png", { type: "image/png" }),
		);
		formData.set("prompt", "make the sky sunset orange");
		formData.set("model", "zsky");

		const response = await worker.fetch(
			new Request("https://worker.example", { method: "POST", body: formData }),
			{ AI: { run: aiRun }, POLLINATIONS_API_KEY: "test-key" },
		);

		expect(response.status).toBe(200);
		expect(aiRun).not.toHaveBeenCalled();
		expect(pollinationsFetch).toHaveBeenCalledOnce();
		const [url, input] = pollinationsFetch.mock.calls[0];
		expect(url).toBe("https://gen.pollinations.ai/v1/images/edits");
		expect(input.headers.Authorization).toBe("Bearer test-key");
		const payload = await new Request(url, input).formData();
		expect(payload.get("prompt")).toBe("make the sky sunset orange");
		expect(payload.get("model")).toBe("kontext");
		expect(await payload.get("image").text()).toBe("source-image");

		const data = await response.json();
		expect(data).toMatchObject({
			data: [
				{
					b64_json: "cG9sbHluYXRpb25zLWltYWdl",
					model: "kontext",
					provider: "pollinations",
				},
			],
			limit: 1,
		});
		expect(Date.parse(data.resetAt)).not.toBeNaN();
	});

	it("falls back to Cloudflare Workers AI when Pollinations fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("upstream unavailable");
			}),
		);
		const aiRun = vi.fn(async () => ({ image: "Y2xvdWRmbGFyZS1pbWFnZQ==" }));
		const formData = new FormData();
		formData.set(
			"image",
			new File(["source-image"], "source.png", { type: "image/png" }),
		);
		formData.set("prompt", "change only the sky");

		const response = await worker.fetch(
			new Request("https://worker.example", { method: "POST", body: formData }),
			{ AI: { run: aiRun }, POLLINATIONS_API_KEY: "test-key" },
		);

		expect(response.status).toBe(200);
		expect(aiRun).toHaveBeenCalledOnce();
		const [model, input] = aiRun.mock.calls[0];
		expect(model).toBe("@cf/black-forest-labs/flux-2-klein-9b");
		expect(input.multipart.contentType).toContain("multipart/form-data");
		await expect(response.json()).resolves.toMatchObject({
			data: [{ provider: "cloudflare-workers-ai" }],
		});
	});

	it("requires an image and prompt", async () => {
		const response = await worker.fetch(
			new Request("https://worker.example", {
				method: "POST",
				body: new FormData(),
			}),
			{ AI: { run: vi.fn() } },
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: "Missing image or prompt",
		});
	});

	it("rejects non-form requests before parsing the body", async () => {
		const response = await worker.fetch(
			new Request("https://worker.example", { method: "POST" }),
			{ AI: { run: vi.fn() } },
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: "Missing image or prompt",
		});
	});

	it("blocks users after one image edit per UTC day", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const formData = new FormData();
		formData.set(
			"image",
			new File(["source-image"], "source.png", { type: "image/png" }),
		);
		formData.set("prompt", "make the sky sunset orange");

		const response = await worker.fetch(
			new Request("https://worker.example", {
				method: "POST",
				body: formData,
				headers: { "X-AIE-Client-ID": "test-client" },
			}),
			{
				AI: { run: fetchMock },
				IMAGE_EDIT_DAILY_LIMIT: {
					get: vi.fn(async () => "1"),
					put: vi.fn(),
					delete: vi.fn(),
				},
			},
		);

		expect(response.status).toBe(429);
		expect(fetchMock).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toMatchObject({
			error: "Daily image edit limit reached. Try again tomorrow.",
			code: "daily_limit_reached",
			limit: 1,
		});
	});
});
