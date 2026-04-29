export function getOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Lokswami API',
      version: '1.0.0',
      description:
        'Public reader and protected admin APIs for Lokswami newsroom workflows.',
    },
    servers: [
      {
        url: '/',
        description: 'Current deployment',
      },
    ],
    tags: [
      { name: 'Public Content' },
      { name: 'Admin' },
      { name: 'TTS' },
      { name: 'Security' },
    ],
    components: {
      schemas: {
        ApiError: {
          type: 'object',
          required: ['success', 'error', 'code'],
          properties: {
            success: { const: false },
            error: { type: 'string' },
            code: { type: 'string' },
            requestId: { type: 'string' },
          },
        },
        TtsStatusResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { const: true },
            data: {
              type: 'object',
              required: ['status'],
              properties: {
                status: {
                  type: 'string',
                  enum: ['ready', 'queued', 'processing', 'failed'],
                },
                audioUrl: { type: 'string' },
                jobId: { type: 'string' },
                retryAfterSeconds: { type: 'number' },
              },
            },
          },
        },
      },
      securitySchemes: {
        AdminSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'next-auth.session-token',
          description: 'NextAuth admin session cookie.',
        },
      },
    },
    paths: {
      '/api/articles/latest': {
        get: {
          tags: ['Public Content'],
          summary: 'List latest published articles',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 5, maximum: 200 },
            },
            {
              name: 'cursorPublishedAt',
              in: 'query',
              schema: { type: 'string', format: 'date-time' },
            },
            {
              name: 'cursorId',
              in: 'query',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Paged latest feed response' },
          },
        },
      },
      '/api/articles/{id}/tts': {
        post: {
          tags: ['TTS'],
          summary: 'Get or queue article listen-mode audio',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Audio is ready',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TtsStatusResponse' },
                },
              },
            },
            '202': {
              description: 'Audio generation is queued or processing',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TtsStatusResponse' },
                },
              },
            },
          },
        },
      },
      '/api/admin/team': {
        get: {
          tags: ['Admin'],
          security: [{ AdminSession: [] }],
          summary: 'List admin-side team members',
          responses: { '200': { description: 'Team list' } },
        },
        post: {
          tags: ['Admin'],
          security: [{ AdminSession: [] }],
          summary: 'Invite or promote a team member',
          responses: {
            '201': { description: 'Team member invited' },
            '400': { description: 'Validation failed' },
            '403': { description: 'Forbidden' },
          },
        },
      },
      '/api/security/csp-report': {
        post: {
          tags: ['Security'],
          summary: 'Receive browser CSP violation reports',
          responses: { '204': { description: 'Report accepted' } },
        },
      },
    },
  };
}

