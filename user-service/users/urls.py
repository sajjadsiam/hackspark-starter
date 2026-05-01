from django.urls import path
from .views import StatusView, RegisterView, LoginView, MeView, DiscountView, AdminUsersView

urlpatterns = [
    path('status', StatusView.as_view()),
    path('users/register', RegisterView.as_view()),
    path('users/login', LoginView.as_view()),
    path('users/me', MeView.as_view()),
    path('users/<int:user_id>/discount', DiscountView.as_view()),
    path('users/admin/users', AdminUsersView.as_view()),
    path('admin/users', AdminUsersView.as_view()),
]
