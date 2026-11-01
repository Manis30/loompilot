import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudinaryStorage } from "../../src/integrations/storage/cloudinary-storage.js";
import { v2 as cloudinary } from "cloudinary";

vi.mock("cloudinary", () => {
  return {
    v2: {
      config: vi.fn(),
      uploader: {
        upload_stream: vi.fn(),
        destroy: vi.fn().mockResolvedValue({ result: "ok" }),
      },
      url: vi.fn().mockReturnValue("https://res.cloudinary.com/demo/image/upload/sample.jpg"),
    },
  };
});

describe("CloudinaryStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures cloudinary on initialization", () => {
    new CloudinaryStorage({
      cloudName: "test-cloud",
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: "test-cloud",
      api_key: "test-key",
      api_secret: "test-secret",
      secure: true,
    });
  });

  it("throws error if credentials are missing when saving file", async () => {
    const storage = new CloudinaryStorage({
      cloudName: "",
      apiKey: "",
      apiSecret: "",
    });

    await expect(
      storage.saveFile(
        {
          buffer: Buffer.from("test"),
          originalFilename: "spec.pdf",
          mimeType: "application/pdf",
        },
        {
          tenantId: "tenant_1",
          ownerType: "order",
          ownerId: "order_123",
          originalFilename: "spec.pdf",
          mimeType: "application/pdf",
          sizeBytes: 4,
        }
      )
    ).rejects.toThrow("Cloudinary credentials not configured");
  });

  it("uploads file successfully via stream and returns StoredFileResult", async () => {
    const fakeResult = {
      public_id: "loompilot/tenant_1/order/spec_12345",
      bytes: 1024,
      secure_url: "https://res.cloudinary.com/test-cloud/loompilot/tenant_1/order/spec_12345.pdf",
    };

    const mockEnd = vi.fn();
    (cloudinary.uploader.upload_stream as any).mockImplementation((options: any, callback: any) => {
      // simulate stream completion
      setTimeout(() => callback(null, fakeResult), 10);
      return { end: mockEnd };
    });

    const storage = new CloudinaryStorage({
      cloudName: "test-cloud",
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    const result = await storage.saveFile(
      {
        buffer: Buffer.from("hello world"),
        originalFilename: "spec.pdf",
        mimeType: "application/pdf",
      },
      {
        tenantId: "tenant_1",
        ownerType: "order",
        ownerId: "order_123",
        originalFilename: "spec.pdf",
        mimeType: "application/pdf",
        sizeBytes: 11,
      }
    );

    expect(mockEnd).toHaveBeenCalled();
    expect(result.storageKey).toBe(fakeResult.public_id);
    expect(result.sizeBytes).toBe(1024);
    expect(result.mimeType).toBe("application/pdf");
  });

  it("deletes file calling uploader.destroy", async () => {
    const storage = new CloudinaryStorage({
      cloudName: "test-cloud",
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    await storage.deleteFile("loompilot/tenant_1/order/spec_12345");

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("loompilot/tenant_1/order/spec_12345", {
      resource_type: "auto",
    });
  });
});

