/// <reference lib="webworker" />

// Check if a number is prime
function isPrime(num: number): boolean {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;

  let i = 5;
  while (i * i <= num) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
    i += 6;
  }
  return true;
}

// Compute the value of a + b*i + c*j + d*k for given i, j, k
function computeValue(a: number, b: number, c: number, d: number, i: number, j: number, k: number): number {
  return a + b * i + c * j + d * k;
}

// Compute all 27 values in the 3x3x3 cube for a given solution
function computeCube(solution: { a: number, b: number, c: number, d: number }) {
  const { a, b, c, d } = solution;
  const primes: number[] = [];

  // Compute all 27 values in the cube
  for (let i = 0; i <= 2; i++) {
    for (let j = 0; j <= 2; j++) {
      for (let k = 0; k <= 2; k++) {
        const value = computeValue(a, b, c, d, i, j, k);
        if (isPrime(value)) {
          primes.push(value);
        }
      }
    }
  }

  // Check if all primes in the cube are unique
  const uniquePrimes = new Set(primes);
  const isUnique = uniquePrimes.size === primes.length;

  // Find duplicates if any
  const duplicates: number[] = [];
  if (!isUnique) {
    const counts = new Map<number, number>();
    primes.forEach(prime => {
      counts.set(prime, (counts.get(prime) || 0) + 1);
    });

    counts.forEach((count, prime) => {
      if (count > 1) {
        duplicates.push(prime);
      }
    });
  }

  return { primes, isUnique, duplicates };
}

addEventListener('message', ({ data }) => {
  const { solutions, type } = data;

  if (type === 'computeCubes') {
    const results = solutions.map((solution: any) => {
      // Extract parameters from parameterCombination or use defaults
      const a = solution.parameterCombination?.a || 0;
      const b = solution.parameterCombination?.b || 0;
      const c = solution.parameterCombination?.c || 0;
      const d = solution.parameterCombination?.d || 0;
      const solutionKey = `${a},${b},${c},${d}`;
      const cubeData = computeCube({a, b, c, d});
      return { solutionKey, cubeData };
    });

    postMessage({ type: 'cubesComputed', results });
  }
});
