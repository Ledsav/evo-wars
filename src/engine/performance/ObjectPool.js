/**
 * ObjectPool - Reusable object pool to reduce garbage collection
 * Dramatically reduces GC pauses by reusing objects instead of creating/destroying
 */
export class ObjectPool {
  constructor(factory, reset, initialSize = 100) {
    this.factory = factory; // Function to create new objects
    this.reset = reset; // Function to reset object to default state
    this.available = [];
    this.inUse = new Set();

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.factory());
    }
  }

  /**
   * Get an object from the pool
   */
  acquire() {
    let obj;

    if (this.available.length > 0) {
      obj = this.available.pop();
    } else {
      // Pool exhausted, create new object
      obj = this.factory();
    }

    this.inUse.add(obj);
    return obj;
  }

  /**
   * Return an object to the pool
   */
  release(obj) {
    if (!this.inUse.has(obj)) {
      return; // Object not from this pool
    }

    this.inUse.delete(obj);
    this.reset(obj); // Reset to default state
    this.available.push(obj);
  }

  /**
   * Release multiple objects at once
   */
  releaseAll(objects) {
    for (const obj of objects) {
      this.release(obj);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size
    };
  }

  /**
   * Clear the entire pool
   */
  clear() {
    this.available = [];
    this.inUse.clear();
  }
}
