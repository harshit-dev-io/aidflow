from rest_framework import serializers
from core.models import Task, Volunteer, Assignment

class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = '__all__'

class VolunteerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Volunteer
        fields = '__all__'

class AssignmentSerializer(serializers.ModelSerializer):
    volunteer_name = serializers.CharField(source='volunteer.name', read_only=True)
    task_issue_type = serializers.CharField(source='task.issue_type', read_only=True)

    class Meta:
        model = Assignment
        fields = ['id', 'task', 'volunteer', 'assigned_at', 'status', 'volunteer_name', 'task_issue_type']
