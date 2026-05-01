import grpc
from concurrent import futures
import time
import os
import sys

# Add the stubs directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + '/grpc_stubs')

import analytics_pb2
import analytics_pb2_grpc

# We need to be able to call Django views or logic from here.
# Since we are in the same process (or at least same container), 
# we can import the view logic.
# However, to keep it simple and follow Django patterns, 
# we'll use a standalone script that can be run by manage.py
# or just import the necessary parts if we setup django environment.

class AnalyticsServiceServicer(analytics_pb2_grpc.AnalyticsServiceServicer):
    def GetRecommendations(self, request, context):
        print(f"[gRPC] Received GetRecommendations request for date: {request.date}, limit: {request.limit}")
        
        # In a real scenario, we'd call the PeakWindowView or RecommendationsView logic.
        # For this bonus, we will proxy the request to the local HTTP endpoint 
        # or call the internal helper to satisfy the "grounding call" requirement.
        
        import requests
        try:
            # Call the internal HTTP endpoint to get the data
            resp = requests.get(f"http://localhost:8003/analytics/recommendations?date={request.date}&limit={request.limit}")
            data = resp.json()
            
            recs = []
            for item in data.get('recommendations', []):
                recs.append(analytics_pb2.Recommendation(
                    id=item.get('id', 0),
                    name=item.get('name', 'Unknown'),
                    category=item.get('category', 'Unknown'),
                    score=float(item.get('score', 0.0)),
                    reason=item.get('reason', '')
                ))
            return analytics_pb2.RecommendationsResponse(recommendations=recs)
        except Exception as e:
            print(f"[gRPC] Error fetching recommendations: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Internal error: {str(e)}")
            return analytics_pb2.RecommendationsResponse()

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    analytics_pb2_grpc.add_AnalyticsServiceServicer_to_server(AnalyticsServiceServicer(), server)
    server.add_insecure_port('[::]:50051')
    print("[gRPC] Analytics Server starting on port 50051...")
    server.start()
    try:
        while True:
            time.sleep(86400)
    except KeyboardInterrupt:
        server.stop(0)

if __name__ == '__main__':
    serve()
