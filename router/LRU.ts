// LRU.ts
class LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null = null;
  next: LRUNode<K, V> | null = null;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, LRUNode<K, V>>;
  private head: LRUNode<K, V>;
  private tail: LRUNode<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();

    // Create dummy head and tail nodes
    this.head = new LRUNode(null as any, null as any);
    this.tail = new LRUNode(null as any, null as any);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  private addToHead(node: LRUNode<K, V>): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: LRUNode<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToHead(node: LRUNode<K, V>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private removeTail(): LRUNode<K, V> {
    const lastNode = this.tail.prev!;
    this.removeNode(lastNode);
    return lastNode;
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (node) {
      this.moveToHead(node);
      return node.value;
    }
    return undefined;
  }

  put(key: K, value: V): { key: K; value: V } | null {
    const node = this.cache.get(key);

    if (node) {
      node.value = value;
      this.moveToHead(node);
      return null;
    } else {
      const newNode = new LRUNode(key, value);
      let deletedNode: { key: K; value: V } | null = null;

      if (this.cache.size >= this.capacity) {
        const tail = this.removeTail();
        this.cache.delete(tail.key);
        deletedNode = { key: tail.key, value: tail.value };
      }

      this.cache.set(key, newNode);
      this.addToHead(newNode);
      return deletedNode;
    }
  }

  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (node) {
      this.removeNode(node);
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }
}
