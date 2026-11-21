export function handleMockRequest(request: Request): Promise<Response>;
export function issueToken(sub: string, ttl?: number): string;
export function verifyToken(token: string): {sub: string; exp: number; jti: string};
