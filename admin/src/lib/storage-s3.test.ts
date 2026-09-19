import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Exercises the S3 adapter against a real S3-compatible endpoint.
 *
 * Skipped unless STORAGE_S3_TEST_ENDPOINT is set, so `npm test` needs no
 * object store. To run it locally:
 *
 *   docker run -d --rm --name minio -p 9100:9000 \
 *     -e MINIO_ROOT_USER=testkey -e MINIO_ROOT_PASSWORD=testsecret123 \
 *     quay.io/minio/minio server /data
 *   STORAGE_S3_TEST_ENDPOINT=http://localhost:9100 \
 *   STORAGE_S3_TEST_KEY=testkey STORAGE_S3_TEST_SECRET=testsecret123 npm test
 */
const endpoint = process.env.STORAGE_S3_TEST_ENDPOINT;

describe("S3 storage adapter", { skip: !endpoint && "STORAGE_S3_TEST_ENDPOINT not set" }, () => {
  it("round-trips objects and honours the key guard", async () => {
    process.env.STORAGE_DRIVER = "s3";
    process.env.STORAGE_S3_BUCKET = process.env.STORAGE_S3_TEST_BUCKET ?? "bass-test";
    process.env.STORAGE_S3_ENDPOINT = endpoint;
    process.env.STORAGE_S3_ACCESS_KEY_ID = process.env.STORAGE_S3_TEST_KEY ?? "testkey";
    process.env.STORAGE_S3_SECRET_ACCESS_KEY = process.env.STORAGE_S3_TEST_SECRET ?? "testsecret123";

    const { S3Client, CreateBucketCommand } = await import("@aws-sdk/client-s3");
    const raw = new S3Client({
      region: "auto",
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY!,
      },
    });
    await raw.send(new CreateBucketCommand({ Bucket: process.env.STORAGE_S3_BUCKET })).catch(() => {});

    const { storage } = await import("./storage");
    const body = Buffer.from("s3 adapter test " + "x".repeat(4096));
    const key = `seed/test-${Date.now()}.txt`;

    assert.equal(storage.name, "s3");
    assert.equal(await storage.exists(key), false);

    const stored = await storage.put(key, body, "text/plain");
    assert.deepEqual(stored, { key, size: body.byteLength });
    assert.equal(await storage.exists(key), true);
    assert.equal(await storage.size(key), body.byteLength);
    assert.ok((await storage.get(key)).equals(body));

    const chunks: Buffer[] = [];
    for await (const chunk of await storage.stream(key)) chunks.push(Buffer.from(chunk));
    assert.ok(Buffer.concat(chunks).equals(body));

    await storage.delete(key);
    assert.equal(await storage.exists(key), false, "deleted objects must not exist");
    assert.equal(await storage.exists("seed/never-existed.bin"), false, "a missing key is false, not an error");

    await assert.rejects(storage.put("../escape.txt", body, "text/plain"), /Unsafe storage key/);
  });
});
