from django.db import models

class Task(models.Model):
    URGENCY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical')
    ]
    ISSUE_CHOICES = [
        ('water', 'Water'),
        ('food', 'Food'),
        ('health', 'Health'),
        ('education', 'Education'),
        ('emergency', 'Emergency')
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('assigned', 'Assigned'),
        ('in-progress', 'In-Progress'),
        ('completed', 'Completed')
    ]

    org_id = models.CharField(max_length=255, null=True, blank=True) # Added for Multi-Tenant scope
    issue_type = models.CharField(max_length=20, choices=ISSUE_CHOICES)
    urgency_level = models.CharField(max_length=20, choices=URGENCY_CHOICES)
    location = models.CharField(max_length=255)
    summary = models.TextField()
    required_volunteers = models.IntegerField(default=1)
    skills_needed = models.JSONField(default=list) 
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.issue_type.capitalize()} - {self.location} ({self.urgency_level})"


class Volunteer(models.Model):
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=50) 
    skills = models.JSONField(default=list)
    location = models.CharField(max_length=255)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.category}"


class Assignment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='assignments')
    volunteer = models.ForeignKey(Volunteer, on_delete=models.CASCADE, related_name='assignments')
    assigned_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='assigned')

    def __str__(self):
        return f"{self.volunteer.name} -> {self.task.issue_type} in {self.task.location}"
