from django.urls import path
from .views import StatusView, PeakWindowView, SurgeDaysView, RecommendationsView, KthBusiestView

urlpatterns = [
    # Status
    path('status', StatusView.as_view()),
    path('analytics/status', StatusView.as_view()),
    
    # Insights
    path('peak-window', PeakWindowView.as_view()),
    path('analytics/peak-window', PeakWindowView.as_view()),
    path('surge-days', SurgeDaysView.as_view()),
    path('analytics/surge-days', SurgeDaysView.as_view()),
    path('recommendations', RecommendationsView.as_view()),
    path('analytics/recommendations', RecommendationsView.as_view()),
    path('kth-busiest', KthBusiestView.as_view()),
    path('analytics/kth-busiest', KthBusiestView.as_view()),
]
