from django.urls import path
from .views import StatusView, PeakWindowView, SurgeDaysView, RecommendationsView

urlpatterns = [
    path('status', StatusView.as_view()),
    path('analytics/peak-window', PeakWindowView.as_view()),
    path('analytics/surge-days', SurgeDaysView.as_view()),
    path('analytics/recommendations', RecommendationsView.as_view()),
]
