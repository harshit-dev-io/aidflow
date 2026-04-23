from django.urls import path
from . import views

urlpatterns = [
    # Auth & Org Scope
    path('user/orgs/', views.get_user_orgs, name='get_user_orgs'),
    path('org/create/', views.create_workspace, name='create_workspace'),
    path('org/invite/', views.invite_member, name='invite_member'),

    # Data & Tasks (Scoped)
    path('data/ingest/', views.ingest_data, name='ingest_data'),
    path('tasks/create/', views.create_task),
    path('tasks/<str:task_id>/delete/', views.delete_task),
    path('tasks/', views.get_tasks, name='get_tasks'),
    path('tasks/<str:task_id>/', views.patch_task, name='patch_task'),
    path('data/feed/', views.get_intelligence_feed),

    # Matching & Assignment
    path('tasks/<str:task_id>/match/', views.match_volunteers, name='match_volunteers'),
    path('tasks/<str:task_id>/assign/', views.assign_task, name='assign_task'),

    # Collaboration & Analytics
    path('tasks/<str:task_id>/comments/', views.task_comments, name='task_comments'),
    path('org/analytics/', views.org_analytics, name='org_analytics'),

    path('org/members/', views.get_org_members, name='get_member'),
    path('org/members/add/', views.add_org_member, name='add_member'),
    path('org/members/edit/', views.edit_org_member, name='edit_member'),
]
