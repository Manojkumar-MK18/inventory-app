/**
 * Cached Mongoose connection. Netlify functions are stateless and may hold a warm
 * pool each, so we cache on globalThis and keep maxPoolSize small to stay under
 * Atlas Free's 500-connection limit.
 */
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");

interface Cache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// eslint-disable-next-line no-var
declare global {
  var _mongoose: Cache | undefined;
}

const cache: Cache = globalThis._mongoose ?? { conn: null, promise: null };
globalThis._mongoose = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI!, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
