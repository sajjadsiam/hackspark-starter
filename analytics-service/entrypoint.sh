#!/bin/sh

# Start gRPC server in background
python analytics/grpc_server.py &

# Start Gunicorn in foreground
exec gunicorn core.wsgi:application --bind 0.0.0.0:8003 --workers 2 --timeout 120
