import requests
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User
from .serializers import RegisterSerializer, LoginSerializer, UserProfileSerializer


def get_tokens_for_user(user):
    """Generate JWT token pair for a user."""
    refresh = RefreshToken()
    refresh['user_id'] = user.id
    refresh['email'] = user.email
    refresh['name'] = user.name
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class StatusView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"service": "user-service", "status": "OK"})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            # Check for duplicate email specifically
            if 'email' in serializer.errors:
                errors = serializer.errors['email']
                for err in errors:
                    if 'already registered' in str(err):
                        return Response(
                            {"error": "Email already registered."},
                            status=status.HTTP_409_CONFLICT
                        )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        tokens = get_tokens_for_user(user)
        return Response({
            "message": "User registered successfully.",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
            },
            "jwt": tokens['access'],
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(password):
            return Response(
                {"error": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        tokens = get_tokens_for_user(user)
        return Response({
            "message": "Login successful.",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
            },
            "jwt": tokens['access'],
        })


class MeView(APIView):
    permission_classes = [AllowAny]  # JWT validated manually below

    def get(self, request):
        # Manually validate JWT
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        token_str = auth_header.split(' ', 1)[1]
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            token = AccessToken(token_str)
            user_id = token.get('user_id')
            user = User.objects.get(id=user_id)
        except Exception:
            return Response({"error": "Invalid or expired token."}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at,
        })


class DiscountView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        central_url = settings.CENTRAL_API_URL
        central_token = settings.CENTRAL_API_TOKEN

        try:
            resp = requests.get(
                f"{central_url}/api/data/users/{user_id}",
                headers={"Authorization": f"Bearer {central_token}"},
                timeout=15
            )
        except requests.RequestException as e:
            return Response({"error": "Central API unreachable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if resp.status_code == 404:
            return Response({"error": f"User {user_id} not found."}, status=status.HTTP_404_NOT_FOUND)

        if resp.status_code == 429:
            return Response({"error": "Rate limit exceeded. Please try again later."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        if not resp.ok:
            return Response({"error": "Central API error."}, status=status.HTTP_502_BAD_GATEWAY)

        data = resp.json()
        security_score = data.get('securityScore', 0)

        # Compute discount tier
        if security_score >= 80:
            discount = 20
        elif security_score >= 60:
            discount = 15
        elif security_score >= 40:
            discount = 10
        elif security_score >= 20:
            discount = 5
        else:
            discount = 0

        return Response({
            "userId": user_id,
            "securityScore": security_score,
            "discountPercent": discount,
        })


class AdminUsersView(APIView):
    permission_classes = [AllowAny] # In a real app we would protect this

    def get(self, request):
        users = User.objects.all().order_by('-created_at')
        data = [{
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "created_at": u.created_at
        } for u in users]
        return Response({
            "total": users.count(),
            "users": data
        })
