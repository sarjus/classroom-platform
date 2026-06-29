import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url || url.includes("localhost") || url.includes("127.0.0.1")) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[redis] REDIS_URL not configured for production — queue features disabled");
      return null;
    }
  }

  try {
    const client = new Redis(url ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 500, 2000);
      },
    });

    client.on("error", (err) => {
      console.warn("[redis] connection error:", err.message);
    });

    return client;
  } catch (err) {
    console.warn("[redis] failed to create client:", err);
    return null;
  }
}

export const redis: Redis | null =
  globalForRedis.redis ??
  createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis ?? undefined;
}

export default redis;
