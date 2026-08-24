import script from '../src/script.mjs';
import { SGNL_USER_AGENT } from '@sgnl-actions/utils';

describe('HashiCorp Boundary Remove User from Group Script', () => {
  const mockContext = {
    environment: {
      ADDRESS: 'https://boundary.example.com'
    },
    secrets: {
      BASIC_USERNAME: 'testuser',
      BASIC_PASSWORD: 'testpass'
    },
    outputs: {}
  };

  beforeEach(() => {
    // Mock console to avoid noise in tests
    global.console.log = () => {};
    global.console.error = () => {};
  });

  describe('invoke handler', () => {
    test('should throw error for missing groupId', async () => {
      const params = {
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing groupId parameter');
    });

    test('should throw error for missing userId', async () => {
      const params = {
        groupId: 'g_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing userId parameter');
    });

    test('should throw error for missing authMethodId', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing authMethodId parameter');
    });

    test('should throw error for missing BASIC_USERNAME', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      const contextWithoutUsername = {
        ...mockContext,
        secrets: {
          BASIC_PASSWORD: 'testpass'
        }
      };

      await expect(script.invoke(params, contextWithoutUsername))
        .rejects.toThrow('Missing required secrets: BASIC_USERNAME and BASIC_PASSWORD');
    });

    test('should throw error for missing BASIC_PASSWORD', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      const contextWithoutPassword = {
        ...mockContext,
        secrets: {
          BASIC_USERNAME: 'testuser'
        }
      };

      await expect(script.invoke(params, contextWithoutPassword))
        .rejects.toThrow('Missing required secrets: BASIC_USERNAME and BASIC_PASSWORD');
    });

    test('should throw error for missing ADDRESS', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      const contextWithoutBaseUrl = {
        ...mockContext,
        environment: {},
        secrets: {
          BASIC_USERNAME: 'testuser',
          BASIC_PASSWORD: 'testpass'
        }
      };

      await expect(script.invoke(params, contextWithoutBaseUrl))
        .rejects.toThrow('No URL specified. Provide address parameter or ADDRESS environment variable');
    });

    test('should validate empty groupId', async () => {
      const params = {
        groupId: '   ',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing groupId parameter');
    });

    test('should validate empty userId', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: '   ',
        authMethodId: 'ampw_1234567890'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing userId parameter');
    });

    test('should validate empty authMethodId', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: '   '
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing authMethodId parameter');
    });

    test('should include User-Agent header in all API calls', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      const capturedRequests = [];
      global.fetch = async (url, options) => {
        capturedRequests.push({ url, options });

        // Auth call
        if (url.includes(':authenticate')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ attributes: { token: 'mock-token' } })
          };
        }

        // Get group call
        if (url.includes('/v1/groups/') && options.method === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ version: 1, member_ids: ['u_1234567890'] })
          };
        }

        // Remove member call
        return {
          ok: true,
          status: 200,
          json: async () => ({})
        };
      };

      await script.invoke(params, mockContext);

      expect(capturedRequests.length).toBe(3);
      for (const req of capturedRequests) {
        expect(req.options.headers['User-Agent']).toBe(SGNL_USER_AGENT);
      }
    });

    test('should skip remove and return userRemoved=false when user is not a member', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      let removeMemberCalled = false;
      global.fetch = async (url, options) => {
        if (url.includes(':authenticate')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ attributes: { token: 'mock-token' } })
          };
        }

        if (url.includes('/v1/groups/') && options.method === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ version: 1, member_ids: [] })
          };
        }

        removeMemberCalled = true;
        return { ok: true, status: 200, json: async () => ({}) };
      };

      const result = await script.invoke(params, mockContext);

      expect(removeMemberCalled).toBe(false);
      expect(result.userRemoved).toBe(false);
      expect(result.groupId).toBe('g_1234567890');
      expect(result.userId).toBe('u_1234567890');
      expect(result.removedAt).toBeDefined();
    });

    test('should remove user and return userRemoved=true when user is a member', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      global.fetch = async (url, options) => {
        if (url.includes(':authenticate')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ attributes: { token: 'mock-token' } })
          };
        }

        if (url.includes('/v1/groups/') && options.method === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ version: 2, member_ids: ['u_1234567890', 'u_other0000001'] })
          };
        }

        return { ok: true, status: 200, json: async () => ({}) };
      };

      const result = await script.invoke(params, mockContext);

      expect(result.userRemoved).toBe(true);
      expect(result.groupId).toBe('g_1234567890');
      expect(result.userId).toBe('u_1234567890');
      expect(result.removedAt).toBeDefined();
    });

    test('should skip remove and return userRemoved=false when group has no member_ids field', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      global.fetch = async (url, options) => {
        if (url.includes(':authenticate')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ attributes: { token: 'mock-token' } })
          };
        }

        if (url.includes('/v1/groups/') && options.method === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ version: 1 })
          };
        }

        return { ok: true, status: 200, json: async () => ({}) };
      };

      const result = await script.invoke(params, mockContext);

      expect(result.userRemoved).toBe(false);
    });

    describe('authenticate error handling', () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      function mockAuthFetch(status, body) {
        global.fetch = async () => ({
          ok: false, status, statusText: 'Error', text: async () => body || 'error'
        });
      }

      test('should throw RetryableError on 429 from authenticate', async () => {
        mockAuthFetch(429);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toBe('Boundary API rate limit exceeded');
        expect(err.retryable).toBe(true);
      });

      test('should throw FatalError on 401 from authenticate', async () => {
        mockAuthFetch(401);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toBe('Invalid username or password');
        expect(err.retryable).toBe(false);
      });

      test('should throw FatalError on 403 from authenticate', async () => {
        mockAuthFetch(403);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toBe('Invalid username or password');
        expect(err.retryable).toBe(false);
      });

      test('should throw RetryableError on 500 from authenticate', async () => {
        mockAuthFetch(500);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toContain('Boundary API server error: 500');
        expect(err.retryable).toBe(true);
      });

      test('should throw FatalError on unexpected status from authenticate', async () => {
        mockAuthFetch(400, 'bad request');
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toContain('Failed to authenticate');
        expect(err.retryable).toBe(false);
      });

      test('should throw FatalError when no token in authenticate response', async () => {
        global.fetch = async () => ({
          ok: true, status: 200, json: async () => ({ attributes: {} })
        });
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toBe('No token returned from authentication');
        expect(err.retryable).toBe(false);
      });
    });

    describe('getGroup error handling', () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      function mockGetGroupFetch(status, body) {
        global.fetch = async (url) => {
          if (url.includes(':authenticate')) {
            return { ok: true, status: 200, json: async () => ({ attributes: { token: 'mock-token' } }) };
          }
          return { ok: false, status, statusText: 'Error', text: async () => body || 'error' };
        };
      }

      test('should throw RetryableError on 429 from getGroup', async () => {
        mockGetGroupFetch(429);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toBe('Boundary API rate limit exceeded');
        expect(err.retryable).toBe(true);
      });

      test('should throw FatalError on 401 from getGroup', async () => {
        mockGetGroupFetch(401);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toBe('Invalid or expired authentication token');
        expect(err.retryable).toBe(false);
      });

      test('should throw FatalError on 404 from getGroup', async () => {
        mockGetGroupFetch(404);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toContain('Group not found');
        expect(err.retryable).toBe(false);
      });

      test('should throw RetryableError on 500 from getGroup', async () => {
        mockGetGroupFetch(500);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toContain('Boundary API server error: 500');
        expect(err.retryable).toBe(true);
      });

      test('should throw FatalError on unexpected status from getGroup', async () => {
        mockGetGroupFetch(400, 'bad request');
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toContain('Failed to get group');
        expect(err.retryable).toBe(false);
      });

      test('should throw FatalError when no version in getGroup response', async () => {
        global.fetch = async (url) => {
          if (url.includes(':authenticate')) {
            return { ok: true, status: 200, json: async () => ({ attributes: { token: 'mock-token' } }) };
          }
          return { ok: true, status: 200, json: async () => ({}) };
        };
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toBe('No version returned from group');
        expect(err.retryable).toBe(false);
      });
    });

    describe('removeUserFromGroup error handling', () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      function mockRemoveMemberFetch(status, body) {
        global.fetch = async (url, options) => {
          if (url.includes(':authenticate')) {
            return { ok: true, status: 200, json: async () => ({ attributes: { token: 'mock-token' } }) };
          }
          if (url.includes('/v1/groups/') && options.method === 'GET') {
            return { ok: true, status: 200, json: async () => ({ version: 1, member_ids: ['u_1234567890'] }) };
          }
          return { ok: false, status, statusText: 'Error', text: async () => body || 'error' };
        };
      }

      test('should throw RetryableError on 429 from removeUserFromGroup', async () => {
        mockRemoveMemberFetch(429);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toBe('Boundary API rate limit exceeded');
        expect(err.retryable).toBe(true);
      });

      test('should throw FatalError on 401 from removeUserFromGroup', async () => {
        mockRemoveMemberFetch(401);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toBe('Invalid or expired authentication token');
        expect(err.retryable).toBe(false);
      });

      test('should throw FatalError on 404 from removeUserFromGroup', async () => {
        mockRemoveMemberFetch(404);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toContain('Group or user not found');
        expect(err.retryable).toBe(false);
      });

      test('should throw RetryableError on 409 from removeUserFromGroup', async () => {
        mockRemoveMemberFetch(409);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toContain('Conflict while removing user from group');
        expect(err.retryable).toBe(true);
      });

      test('should throw RetryableError on 500 from removeUserFromGroup', async () => {
        mockRemoveMemberFetch(500);
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toContain('Boundary API server error: 500');
        expect(err.retryable).toBe(true);
      });

      test('should throw FatalError on unexpected status from removeUserFromGroup', async () => {
        mockRemoveMemberFetch(400, 'bad request');
        const err = await script.invoke(params, mockContext).catch(e => e);
        expect(err.message).toContain('Failed to remove user from group');
        expect(err.retryable).toBe(false);
      });
    });

    // Note: Testing actual Boundary API calls would require mocking fetch
    // or integration tests with real Boundary credentials
  });

  describe('error handler', () => {
    test('should re-throw error for framework to handle', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890',
        error: new Error('Network timeout')
      };

      await expect(script.error(params, mockContext))
        .rejects.toThrow('Network timeout');
    });
  });

  describe('halt handler', () => {
    test('should handle graceful shutdown', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890',
        reason: 'timeout'
      };

      const result = await script.halt(params, mockContext);

      expect(result.groupId).toBe('g_1234567890');
      expect(result.userId).toBe('u_1234567890');
      expect(result.authMethodId).toBe('ampw_1234567890');
      expect(result.reason).toBe('timeout');
      expect(result.haltedAt).toBeDefined();
      expect(result.cleanupCompleted).toBe(true);
    });

    test('should handle halt with missing params', async () => {
      const params = {
        reason: 'system_shutdown'
      };

      const result = await script.halt(params, mockContext);

      expect(result.groupId).toBe('unknown');
      expect(result.userId).toBe('unknown');
      expect(result.authMethodId).toBe('unknown');
      expect(result.reason).toBe('system_shutdown');
      expect(result.cleanupCompleted).toBe(true);
    });
  });
});