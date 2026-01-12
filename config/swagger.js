import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '민원냠냠 Core Engine API',
      version: '1.0.0',
      description: '공공데이터 기반 Urban Comfort Index(UCI) 산출 및 우선순위 추천 API',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:8000',
        description: 'Development server'
      }
    ],
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Units', description: 'Spatial units management' },
      { name: 'Comfort Index', description: 'UCI calculation and retrieval' },
      { name: 'Priority Queue', description: 'Priority queue endpoints' },
      { name: 'Action Cards', description: 'Action cards generation' },
      { name: 'Interventions', description: 'Interventions and tracking' },
      { name: 'GeoJSON', description: 'GeoJSON endpoints for Mapbox' },
      { name: 'Data', description: 'Data upload and management' },
      { name: 'Dashboard', description: 'Dashboard data endpoints' },
      { name: 'Analytics', description: 'Data analysis and statistics endpoints' },
      { name: 'Anomaly Detection', description: 'AI-based anomaly detection endpoints' },
      { name: 'UCI Info', description: 'UCI calculation logic information' }
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'string',
              example: 'Error details'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Success message'
            }
          }
        }
      }
    }
  },
  apis: [
    './routes/*.js',
    './server.js',
    './config/swagger.js'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);

