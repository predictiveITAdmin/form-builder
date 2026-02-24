const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Predictive IT Automations API',
    description: 'API documentation for the backend services, including forms, workflows, analytics, and responses.',
    version: '1.0.0'
  },
  host: process.env.APP_BASE_URL ? process.env.APP_BASE_URL.replace(/^https?:\/\//, '') : 'automation.predictiveit.com',
  basePath: '/',
  schemes: ['https'],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [{ bearerAuth: [] }]
};

const outputFile = './swagger_output.json';
const routes = ['./index.js'];

const fs = require('fs');

swaggerAutogen(outputFile, routes, doc).then(() => {
  const swaggerDoc = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  
  for (const path in swaggerDoc.paths) {
    let tag = 'General';
    if (path.startsWith('/api/health') || path.startsWith('/api/verify')) {
      tag = 'System';
    } else {
      const parts = path.split('/');
      if (parts.length >= 3 && parts[1] === 'api') {
        const service = parts[2];
        tag = service.charAt(0).toUpperCase() + service.slice(1);
      }
    }
    
    for (const method in swaggerDoc.paths[path]) {
      swaggerDoc.paths[path][method].tags = [tag];
    }
  }
  
  fs.writeFileSync(outputFile, JSON.stringify(swaggerDoc, null, 2));
  console.log('Swagger documentation generated and tagged successfully!');
});
