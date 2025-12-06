/**
 * 2D Vector class for math operations
 * Ported from: Original/src/com/replica/replicaisland/Vector2.java
 */
export class Vector2 {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * Set vector values
   */
  set(x: number | Vector2, y?: number): this {
    if (x instanceof Vector2) {
      this.x = x.x;
      this.y = x.y;
    } else {
      this.x = x;
      this.y = y ?? 0;
    }
    return this;
  }

  /**
   * Reset vector to zero
   */
  zero(): this {
    this.x = 0;
    this.y = 0;
    return this;
  }

  /**
   * Clone this vector
   */
  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  /**
   * Add another vector
   */
  add(other: Vector2): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  /**
   * Add scalar values
   */
  addScalar(x: number, y: number): this {
    this.x += x;
    this.y += y;
    return this;
  }

  /**
   * Subtract another vector
   */
  subtract(other: Vector2): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  /**
   * Multiply by a scalar
   */
  multiply(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  /**
   * Multiply component-wise by another vector
   */
  multiplyVector(other: Vector2): this {
    this.x *= other.x;
    this.y *= other.y;
    return this;
  }

  /**
   * Divide by a scalar
   */
  divide(scalar: number): this {
    if (scalar !== 0) {
      this.x /= scalar;
      this.y /= scalar;
    }
    return this;
  }

  /**
   * Get the length (magnitude) of the vector
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Get the squared length of the vector (faster than length())
   */
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Normalize the vector to unit length
   */
  normalize(): this {
    const len = this.length();
    if (len > 0) {
      this.divide(len);
    }
    return this;
  }

  /**
   * Get the dot product with another vector
   */
  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  /**
   * Get the cross product (z component) with another vector
   */
  cross(other: Vector2): number {
    return this.x * other.y - this.y * other.x;
  }

  /**
   * Get the distance to another vector
   */
  distance(other: Vector2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get the squared distance to another vector
   */
  distanceSquared(other: Vector2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  /**
   * Linear interpolation to another vector
   */
  lerp(target: Vector2, t: number): this {
    this.x += (target.x - this.x) * t;
    this.y += (target.y - this.y) * t;
    return this;
  }

  /**
   * Flip the vector (negate both components)
   */
  flip(): this {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }

  /**
   * Check if vectors are equal within tolerance
   */
  equals(other: Vector2, tolerance: number = 0.0001): boolean {
    return (
      Math.abs(this.x - other.x) < tolerance &&
      Math.abs(this.y - other.y) < tolerance
    );
  }

  /**
   * Check if the vector is zero
   */
  isZero(): boolean {
    return this.x === 0 && this.y === 0;
  }

  /**
   * Rotate the vector by an angle (in radians)
   */
  rotate(angle: number): this {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const newX = this.x * cos - this.y * sin;
    const newY = this.x * sin + this.y * cos;
    this.x = newX;
    this.y = newY;
    return this;
  }

  /**
   * Get the angle of the vector (in radians)
   */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Reflect the vector off a surface normal
   */
  reflect(normal: Vector2): this {
    const dotProduct = 2 * this.dot(normal);
    this.x -= dotProduct * normal.x;
    this.y -= dotProduct * normal.y;
    return this;
  }

  /**
   * Project this vector onto another vector
   */
  project(onto: Vector2): this {
    const dotProduct = this.dot(onto);
    const lengthSquared = onto.lengthSquared();
    if (lengthSquared > 0) {
      const scalar = dotProduct / lengthSquared;
      this.x = onto.x * scalar;
      this.y = onto.y * scalar;
    }
    return this;
  }

  /**
   * Clamp the vector length to a maximum
   */
  clampLength(maxLength: number): this {
    const len = this.length();
    if (len > maxLength) {
      this.multiply(maxLength / len);
    }
    return this;
  }

  toString(): string {
    return `Vector2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }

  // Static factory methods
  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static one(): Vector2 {
    return new Vector2(1, 1);
  }

  static up(): Vector2 {
    return new Vector2(0, -1);
  }

  static down(): Vector2 {
    return new Vector2(0, 1);
  }

  static left(): Vector2 {
    return new Vector2(-1, 0);
  }

  static right(): Vector2 {
    return new Vector2(1, 0);
  }

  static fromAngle(angle: number, length: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }
}
