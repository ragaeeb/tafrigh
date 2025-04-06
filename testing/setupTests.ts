import { vi } from 'vitest';

vi.mock('@/utils/logger', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));
