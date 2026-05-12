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
      '/api/v1/public/articles/latest': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 latest published article feed',
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
      '/api/v1/public/articles': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 published article feed with category, city, and cursor filters',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 200 },
            },
            {
              name: 'category',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'city',
              in: 'query',
              schema: { type: 'string' },
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
            '200': { description: 'Standard API envelope with items and pagination metadata' },
          },
        },
      },
      '/api/v1/public/home-feed': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 grouped public home feed',
          responses: {
            '200': {
              description:
                'Grouped home feed sections for reader website and mobile app clients',
            },
          },
        },
      },
      '/api/v1/public/categories': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 public category list for navigation and filters',
          responses: {
            '200': { description: 'Standard API envelope with category items' },
          },
        },
      },
      '/api/v1/public/cities': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 public city list for e-paper and local filters',
          responses: {
            '200': { description: 'Standard API envelope with city items' },
          },
        },
      },
      '/api/v1/public/articles/{slug}': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 public article detail by slug or ID',
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Published article detail response' },
            '404': { description: 'Article not found' },
          },
        },
      },
      '/api/v1/public/stories/latest': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 latest visual stories feed',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 5, maximum: 100 },
            },
          ],
          responses: {
            '200': { description: 'Latest stories response' },
          },
        },
      },
      '/api/v1/public/videos/latest': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 latest videos feed',
          responses: {
            '200': { description: 'Paged latest videos response' },
          },
        },
      },
      '/api/v1/public/videos': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 public videos feed alias',
          responses: {
            '200': { description: 'Paged latest videos response' },
          },
        },
      },
      '/api/v1/public/shorts/latest': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 latest shorts feed',
          responses: {
            '200': { description: 'Paged latest shorts response' },
          },
        },
      },
      '/api/v1/public/shorts': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 public shorts feed alias',
          responses: {
            '200': { description: 'Paged latest shorts response' },
          },
        },
      },
      '/api/v1/public/epapers/latest': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 latest published e-paper feed',
          responses: {
            '200': { description: 'Paged latest e-paper response' },
          },
        },
      },
      '/api/v1/public/epapers': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 published e-paper list',
          responses: {
            '200': { description: 'Published e-paper list response' },
          },
        },
      },
      '/api/v1/public/breaking': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 breaking news ticker feed',
          responses: {
            '200': { description: 'Breaking news response' },
          },
        },
      },
      '/api/v1/public/search': {
        get: {
          tags: ['Public Content'],
          summary: 'API v1 public article search',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: true,
              schema: { type: 'string', minLength: 2 },
            },
            {
              name: 'category',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'city',
              in: 'query',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Standard API envelope with search results' },
            '422': { description: 'Search query is missing or too short' },
          },
        },
      },
      '/api/articles/{id}/tts': {
        post: {
          tags: ['TTS'],
          summary: 'Get manually uploaded article listen-mode audio',
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
              description: 'Manual audio is ready',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TtsStatusResponse' },
                },
              },
            },
            '404': {
              description: 'Manual audio has not been uploaded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
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
