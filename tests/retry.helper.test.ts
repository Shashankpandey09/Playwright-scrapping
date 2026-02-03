import { retryWithBackoff } from '../src/helpers/retry.helper';

describe('retryWithBackoff', () => {

    it('should return result on first successful attempt', async () => {
        const mockFn = jest.fn().mockResolvedValue('success');

        const result = await retryWithBackoff(mockFn, 3, 'TEST123', 'Test');

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
        const mockFn = jest.fn()
            .mockRejectedValueOnce(new Error('fail 1'))
            .mockRejectedValueOnce(new Error('fail 2'))
            .mockResolvedValue('success on third');

        const result = await retryWithBackoff(mockFn, 3, 'TEST123', 'Test');

        expect(result).toBe('success on third');
        expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries exceeded', async () => {
        const mockFn = jest.fn().mockRejectedValue(new Error('always fails'));

        await expect(
            retryWithBackoff(mockFn, 2, 'TEST123', 'Test')
        ).rejects.toThrow('always fails');

        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should use default retries when not specified', async () => {
        const mockFn = jest.fn().mockResolvedValue('ok');

        await retryWithBackoff(mockFn);

        expect(mockFn).toHaveBeenCalled();
    });
});
