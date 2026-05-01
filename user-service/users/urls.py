from django.urls import path
from .views import StatusView, RegisterView, LoginView, MeView, DiscountView, AdminUsersView

urlpatterns = [
    # Status
    path('status', StatusView.as_view()),
    path('users/status', StatusView.as_view()),
    
    # Registration & Login
    path('register', RegisterView.as_view()),
    path('users/register', RegisterView.as_view()),
    path('login', LoginView.as_view()),
    path('users/login', LoginView.as_view()),
    
    # Profile & Discounts
    path('me', MeView.as_view()),
    path('users/me', MeView.as_view()),
    path('<int:user_id>/discount', DiscountView.as_view()),
    path('users/<int:user_id>/discount', DiscountView.as_view()),
    
    # Admin
    path('admin/users', AdminUsersView.as_view()),
    path('users/admin/users', AdminUsersView.as_view()),
]
