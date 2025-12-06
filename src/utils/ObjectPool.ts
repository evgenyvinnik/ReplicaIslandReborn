/**
 * Generic object pool for reducing garbage collection
 * Ported from: Original/src/com/replica/replicaisland/ObjectPool.java
 * 
 * The original game heavily uses object pools to avoid GC pauses.
 * This is equally important in JavaScript where GC can cause frame drops.
 */

export interface Poolable {
  reset(): void;
}

export class ObjectPool<T extends Poolable> {
  private pool: T[] = [];
  private allocated: T[] = [];
  private factory: () => T;
  private maxSize: number;

  constructor(factory: () => T, initialSize: number = 10, maxSize: number = 100) {
    this.factory = factory;
    this.maxSize = maxSize;

    // Pre-allocate objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  /**
   * Get an object from the pool
   */
  allocate(): T {
    let obj: T;

    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      obj = this.factory();
    }

    obj.reset();
    this.allocated.push(obj);
    return obj;
  }

  /**
   * Return an object to the pool
   */
  release(obj: T): void {
    const index = this.allocated.indexOf(obj);
    if (index !== -1) {
      this.allocated.splice(index, 1);

      if (this.pool.length < this.maxSize) {
        obj.reset();
        this.pool.push(obj);
      }
    }
  }

  /**
   * Release all allocated objects back to the pool
   */
  releaseAll(): void {
    while (this.allocated.length > 0) {
      const obj = this.allocated.pop()!;
      if (this.pool.length < this.maxSize) {
        obj.reset();
        this.pool.push(obj);
      }
    }
  }

  /**
   * Get the number of available objects
   */
  getAvailable(): number {
    return this.pool.length;
  }

  /**
   * Get the number of allocated objects
   */
  getAllocated(): number {
    return this.allocated.length;
  }

  /**
   * Get total pool capacity
   */
  getTotal(): number {
    return this.pool.length + this.allocated.length;
  }

  /**
   * Clear the pool completely
   */
  clear(): void {
    this.pool = [];
    this.allocated = [];
  }
}

/**
 * Fixed-size array pool for performance-critical operations
 * Avoids array creation/destruction during gameplay
 */
export class FixedSizeArray<T> {
  private items: (T | null)[];
  private count: number = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.items = new Array(capacity).fill(null);
  }

  add(item: T): boolean {
    if (this.count < this.capacity) {
      this.items[this.count] = item;
      this.count++;
      return true;
    }
    return false;
  }

  remove(item: T): boolean {
    for (let i = 0; i < this.count; i++) {
      if (this.items[i] === item) {
        // Move last item to fill the gap
        this.items[i] = this.items[this.count - 1];
        this.items[this.count - 1] = null;
        this.count--;
        return true;
      }
    }
    return false;
  }

  removeAt(index: number): T | null {
    if (index >= 0 && index < this.count) {
      const item = this.items[index];
      this.items[index] = this.items[this.count - 1];
      this.items[this.count - 1] = null;
      this.count--;
      return item;
    }
    return null;
  }

  get(index: number): T | null {
    if (index >= 0 && index < this.count) {
      return this.items[index];
    }
    return null;
  }

  getCount(): number {
    return this.count;
  }

  getCapacity(): number {
    return this.capacity;
  }

  clear(): void {
    for (let i = 0; i < this.count; i++) {
      this.items[i] = null;
    }
    this.count = 0;
  }

  forEach(callback: (item: T, index: number) => void): void {
    for (let i = 0; i < this.count; i++) {
      const item = this.items[i];
      if (item !== null) {
        callback(item, i);
      }
    }
  }

  find(predicate: (item: T) => boolean): T | null {
    for (let i = 0; i < this.count; i++) {
      const item = this.items[i];
      if (item !== null && predicate(item)) {
        return item;
      }
    }
    return null;
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const item = this.items[i];
      if (item !== null) {
        result.push(item);
      }
    }
    return result;
  }
}
