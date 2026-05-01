const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../proto/analytics.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const analyticsProto = grpc.loadPackageDefinition(packageDefinition).analytics;

const client = new analyticsProto.AnalyticsService(
  process.env.ANALYTICS_GRPC_URL || 'analytics-service:50051',
  grpc.credentials.createInsecure()
);

function getRecommendations(date, limit = 5) {
  return new Promise((resolve, reject) => {
    client.GetRecommendations({ date, limit }, (err, response) => {
      if (err) {
        console.error('[gRPC Client] Error:', err);
        return reject(err);
      }
      resolve(response.recommendations);
    });
  });
}

module.exports = {
  getRecommendations
};
