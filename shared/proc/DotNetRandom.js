const MBIG = 2147483647;
const MSEED = 161803398;

export class DotNetRandom {
  constructor(seed) {
    this._inext = 0;
    this._inextp = 21;
    this._seedArray = new Array(56).fill(0);

    let subtraction = Math.abs(seed | 0);
    if (subtraction === -2147483648) subtraction = 2147483647;

    let mj = (MSEED - subtraction) | 0;
    if (mj < 0) mj += MBIG;
    this._seedArray[55] = mj;
    let mk = 1;

    for (let i = 1; i < 55; i++) {
      const ii = (21 * i) % 55;
      this._seedArray[ii] = mk;
      mk = (mj - mk) | 0;
      if (mk < 0) mk += MBIG;
      mj = this._seedArray[ii];
    }

    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        const n = (i + 30) % 55;
        this._seedArray[i] = (this._seedArray[i] - this._seedArray[1 + n]) | 0;
        if (this._seedArray[i] < 0) this._seedArray[i] += MBIG;
      }
    }
  }

  _internalSample() {
    let locINext = this._inext + 1;
    if (locINext >= 56) locINext = 1;
    let locINextp = this._inextp + 1;
    if (locINextp >= 56) locINextp = 1;

    let retVal = (this._seedArray[locINext] - this._seedArray[locINextp]) | 0;
    if (retVal === MBIG) retVal -= 1;
    if (retVal < 0) retVal += MBIG;
    this._seedArray[locINext] = retVal;
    this._inext = locINext;
    this._inextp = locINextp;
    return retVal;
  }

  sample() {
    return this._internalSample() * (1.0 / MBIG);
  }

  nextDouble() {
    return this.sample();
  }

  nextMax(maxValue) {
    if (maxValue <= 0) return 0;
    return Math.floor(this.sample() * maxValue);
  }

  nextRange(minValue, maxValue) {
    if (minValue > maxValue) {
      const t = minValue;
      minValue = maxValue;
      maxValue = t;
    }
    const range = maxValue - minValue;
    if (range <= 0) return minValue;
    return minValue + this.nextMax(range);
  }
}
