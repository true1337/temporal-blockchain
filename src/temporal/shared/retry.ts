/**
 * Options for Retry decorator
 */
export type RetryOptions = {
  /** Maximum number of attempts (default 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default 1000) */
  initialDelayMs?: number;
  /** Exponential delay coefficient (default 2) */
  backoffCoefficient?: number;
  /** Maximum delay in milliseconds (optional) */
  maxDelayMs?: number;
  /** Function to check if retry is needed for given error */
  shouldRetry?: (error: any) => boolean;
  /** Custom logging (optional) */
  onRetry?: (attempt: number, maxAttempts: number, error: any, delayMs: number) => void;
};

/**
 * Decorator for automatic retry of function calls with exponential delay
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @Retry({ maxAttempts: 5, initialDelayMs: 500 })
 *   async fetchData() {
 *     return await someApiCall();
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // For regular functions
 * const fetchData = Retry({ maxAttempts: 3 })(async () => {
 *   return await someApiCall();
 * });
 * ```
 */
export function Retry(options: RetryOptions = {}) {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    backoffCoefficient = 2,
    maxDelayMs,
    shouldRetry = () => true, // By default retry on any error
    onRetry = (attempt, maxAttempts, error, delayMs) => {
      console.warn(`⚠️  Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms:`, error.message);
    },
  } = options;

  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> | void {
    // If this is a class method decorator
    if (descriptor && typeof descriptor.value === 'function') {
      const originalMethod = descriptor.value;

      descriptor.value = (async function (this: any, ...args: any[]) {
        let lastError: any;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await originalMethod.apply(this, args);
          } catch (error: any) {
            lastError = error;

            // Check if we should retry on this error
            if (!shouldRetry(error)) {
              throw error;
            }

            // If this is the last attempt, throw error
            if (attempt === maxAttempts) {
              throw error;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
              initialDelayMs * Math.pow(backoffCoefficient, attempt - 1),
              maxDelayMs || Infinity
            );

            // Call custom logging
            onRetry(attempt, maxAttempts, error, delay);

            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        throw lastError;
      }) as T;

      return descriptor;
    }

    // If this is a decorator for regular function (not class method)
    // Return wrapper function
    return undefined;
  } as any;
}

/**
 * Wrapper for functions with retry logic (for use without decorators)
 * 
 * @example
 * ```typescript
 * const fetchData = withRetry(
 *   async () => await someApiCall(),
 *   { maxAttempts: 5, initialDelayMs: 500 }
 * );
 * ```
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    backoffCoefficient = 2,
    maxDelayMs,
    shouldRetry = () => true,
    onRetry = (attempt, maxAttempts, error, delayMs) => {
      console.warn(`⚠️  Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms:`, error.message);
    },
  } = options;

  return (async function (...args: Parameters<T>): Promise<ReturnType<T>> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(...args);
      } catch (error: any) {
        lastError = error;

        // Check if we should retry on this error
        if (!shouldRetry(error)) {
          throw error;
        }

        // If this is the last attempt, throw error
        if (attempt === maxAttempts) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelayMs * Math.pow(backoffCoefficient, attempt - 1),
          maxDelayMs || Infinity
        );

        // Call custom logging
        onRetry(attempt, maxAttempts, error, delay);

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }) as T;
}

/**
 * Helper function for creating retry wrapper with preset options
 * 
 * @example
 * ```typescript
 * const retryRpc = createRetryWrapper({ maxAttempts: 5, initialDelayMs: 500 });
 * 
 * const result = await retryRpc(() => publicClient.getBlock({ blockNumber: 123 }));
 * ```
 */
export function createRetryWrapper(options: RetryOptions = {}) {
  return <T>(fn: () => Promise<T>): Promise<T> => {
    return withRetry(fn, options)();
  };
}

