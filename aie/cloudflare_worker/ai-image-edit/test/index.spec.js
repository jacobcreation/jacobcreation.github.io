import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";

describe("ai image edit worker", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("always sends image edits to the fixed Flux 2 Klein 4B Workers AI model", async () => {
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
			{ AI: { run: aiRun } },
		);

		expect(response.status).toBe(200);
		expect(aiRun).toHaveBeenCalledOnce();

		const [model, input] = aiRun.mock.calls[0];
		expect(model).toBe("@cf/black-forest-labs/flux-2-klein-4b");
		expect(input.multipart.contentType).toContain("multipart/form-data");

		const multipartRequest = new Request("https://multipart.example", {
			method: "POST",
			body: input.multipart.body,
			headers: { "Content-Type": input.multipart.contentType },
		});
		const payload = await multipartRequest.formData();
		expect(payload.get("prompt")).toBe("make the sky sunset orange");
		expect(payload.get("width")).toBe("1024");
		expect(payload.get("height")).toBe("1024");
		expect(payload.get("steps")).toBe("25");
		expect(await payload.get("input_image_0").text()).toBe("source-image");

		const data = await response.json();
		expect(data).toMatchObject({
			data: [
				{
					b64_json: "ZWRpdGVkLWltYWdl",
					model: "@cf/black-forest-labs/flux-2-klein-4b",
					provider: "cloudflare-workers-ai",
				},
			],
			limit: 1,
		});
		expect(Date.parse(data.resetAt)).not.toBeNaN();
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
