from django.urls import path
from .views import (
    StatusView,
    ProductsListView,
    ProductDetailView,
    ProductAvailabilityView,
    KthBusiestDateView,
    TopCategoriesView,
    FreeStreakView,
    MergedFeedView,
)

urlpatterns = [
    path('status', StatusView.as_view()),
    path('rentals/products', ProductsListView.as_view()),
    path('rentals/products/<int:product_id>', ProductDetailView.as_view()),
    path('rentals/products/<int:product_id>/availability', ProductAvailabilityView.as_view()),
    path('rentals/products/<int:product_id>/free-streak', FreeStreakView.as_view()),
    path('rentals/kth-busiest-date', KthBusiestDateView.as_view()),
    path('rentals/users/<int:user_id>/top-categories', TopCategoriesView.as_view()),
    path('rentals/merged-feed', MergedFeedView.as_view()),
]
