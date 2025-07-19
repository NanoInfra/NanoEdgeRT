import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { LRUCache } from "./LRU.ts";

Deno.test("LRUCache - basic operations", () => {
  const cache = new LRUCache<string, number>(3);

  // Test put and get
  assertEquals(cache.put("a", 1), null);
  assertEquals(cache.put("b", 2), null);
  assertEquals(cache.put("c", 3), null);
  assertEquals(cache.size(), 3);

  assertEquals(cache.get("a"), 1);
  assertEquals(cache.get("b"), 2);
  assertEquals(cache.get("c"), 3);
  assertEquals(cache.get("d"), undefined);
});

Deno.test("LRUCache - capacity exceeded with eviction", () => {
  const cache = new LRUCache<string, number>(2);

  // Fill cache to capacity
  assertEquals(cache.put("a", 1), null);
  assertEquals(cache.put("b", 2), null);
  assertEquals(cache.size(), 2);

  // Exceed capacity - should evict "a" (least recently used)
  const deleted = cache.put("c", 3);
  assertEquals(deleted, { key: "a", value: 1 });
  assertEquals(cache.size(), 2);

  // Verify "a" is gone, "b" and "c" remain
  assertEquals(cache.get("a"), undefined);
  assertEquals(cache.get("b"), 2);
  assertEquals(cache.get("c"), 3);
});

Deno.test("LRUCache - LRU order with get operations", () => {
  const cache = new LRUCache<string, number>(2);

  cache.put("a", 1);
  cache.put("b", 2);

  // Access "a" to make it recently used
  cache.get("a");

  // Add "c" - should evict "b" (least recently used)
  const deleted = cache.put("c", 3);
  assertEquals(deleted, { key: "b", value: 2 });

  assertEquals(cache.get("a"), 1);
  assertEquals(cache.get("b"), undefined);
  assertEquals(cache.get("c"), 3);
});

Deno.test("LRUCache - update existing key", () => {
  const cache = new LRUCache<string, number>(2);

  cache.put("a", 1);
  cache.put("b", 2);

  // Update existing key - should not evict anything
  const deleted = cache.put("a", 10);
  assertEquals(deleted, null);
  assertEquals(cache.size(), 2);

  assertEquals(cache.get("a"), 10);
  assertEquals(cache.get("b"), 2);
});

Deno.test("LRUCache - delete operation", () => {
  const cache = new LRUCache<string, number>(3);

  cache.put("a", 1);
  cache.put("b", 2);
  cache.put("c", 3);

  assertEquals(cache.delete("b"), true);
  assertEquals(cache.size(), 2);
  assertEquals(cache.get("b"), undefined);

  assertEquals(cache.delete("d"), false);
  assertEquals(cache.size(), 2);
});

Deno.test("LRUCache - clear operation", () => {
  const cache = new LRUCache<string, number>(3);

  cache.put("a", 1);
  cache.put("b", 2);
  cache.put("c", 3);
  assertEquals(cache.size(), 3);

  cache.clear();
  assertEquals(cache.size(), 0);
  assertEquals(cache.get("a"), undefined);
  assertEquals(cache.get("b"), undefined);
  assertEquals(cache.get("c"), undefined);
});

Deno.test("LRUCache - capacity of 1", () => {
  const cache = new LRUCache<string, number>(1);

  assertEquals(cache.put("a", 1), null);
  assertEquals(cache.size(), 1);

  const deleted = cache.put("b", 2);
  assertEquals(deleted, { key: "a", value: 1 });
  assertEquals(cache.size(), 1);
  assertEquals(cache.get("a"), undefined);
  assertEquals(cache.get("b"), 2);
});

Deno.test("LRUCache - complex LRU behavior", () => {
  const cache = new LRUCache<string, number>(3);

  // Fill cache
  cache.put("a", 1);
  cache.put("b", 2);
  cache.put("c", 3);

  // Access in order: c, a, b (making b most recently used)
  cache.get("c");
  cache.get("a");
  cache.get("b");

  // Add new item - should evict "c" (least recently used)
  const deleted = cache.put("d", 4);
  assertEquals(deleted, { key: "c", value: 3 });

  assertEquals(cache.get("c"), undefined);
  assertEquals(cache.get("a"), 1);
  assertEquals(cache.get("b"), 2);
  assertEquals(cache.get("d"), 4);
});

Deno.test("LRUCache - generic types", () => {
  const cache = new LRUCache<number, string>(2);

  cache.put(1, "one");
  cache.put(2, "two");

  assertEquals(cache.get(1), "one");
  assertEquals(cache.get(2), "two");

  const deleted = cache.put(3, "three");
  assertEquals(deleted, { key: 1, value: "one" });
});
