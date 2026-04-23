from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from firebase_admin import firestore, auth as firebase_auth
from .authentication import FirebaseAuthentication, RequiresActiveOrg
from .services import process_with_gemini, find_best_volunteers
import base64
import re # For aggressive string matching
from google.cloud.firestore_v1.base_query import FieldFilter # To fix the Django warning
import hashlib

db = firestore.client()

# --- Auth & Org Scope ---

@api_view(['GET'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def get_user_orgs(request):
    """
    Fetches all organizations the user belongs to via the WorkspaceMembers bridge table.
    """
    uid = request.user.username
    
    # 1. Query the bridge table for memberships
    memberships = db.collection('workspace_members').where('uid', '==', uid).stream()
    
    orgs = []
    for membership in memberships:
        data = membership.to_dict()
        org_id = data.get('org_id')
        role = data.get('role')
        
        # 2. Fetch the actual Organization detail
        org_doc = db.collection('organizations').document(org_id).get()
        if org_doc.exists:
            org_data = org_doc.to_dict()
            orgs.append({
                'org_id': org_id,
                'name': org_data.get('name'),
                'slug': org_data.get('slug'),
                'role': role
            })
            
    return Response(orgs)

from django.utils.text import slugify
import uuid
import datetime

@api_view(['POST'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def create_workspace(request):
    """
    Finalized logic for creating an NGO workspace using a Bridge Table.
    """
    uid = request.user.username 
    org_name = request.data.get('name')

    if not org_name:
        return Response({"error": "Organization name is required"}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Generate IDs and Slug
    org_id = str(uuid.uuid4())
    slug = slugify(org_name)
    membership_id = str(uuid.uuid4())
    timestamp = datetime.datetime.utcnow().isoformat()

    # 2. Use a Firestore Batch for atomic writes
    batch = db.batch()

    # Organization Document
    org_ref = db.collection('organizations').document(org_id)
    batch.set(org_ref, {
        'org_id': org_id,
        'name': org_name,
        'slug': slug,
        'created_at': timestamp,
        'created_by': uid
    })

    # Bridge Table Document (Assigning 'admin' role)
    member_ref = db.collection('workspace_members').document(membership_id)
    batch.set(member_ref, {
        'membership_id': membership_id,
        'org_id': org_id,
        'uid': uid,
        'role': 'admin',
        'joined_at': timestamp
    })

    # Commit the batch
    batch.commit()

    return Response({
        "message": "Workspace created successfully",
        "org": {
            "org_id": org_id,
            "name": org_name,
            "slug": slug,
            "role": "admin"
        }
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def invite_member(request):
    # Only admins of the active org can invite
    if request.user_role != 'admin':
        return Response({'error': 'Only admins can invite members'}, status=status.HTTP_403_FORBIDDEN)
    
    email = request.data.get('email')
    role = request.data.get('role', 'volunteer')
    active_org_id = request.active_org_id

    # In a real app, send email. Here we just set up an invitation entry or auto-provision
    # We'll provision a placeholder user doc for now if they don't exist
    try:
        # Check if user exists in Firebase Auth
        try:
            fb_user = firebase_auth.get_user_by_email(email)
            target_uid = fb_user.uid
        except firebase_auth.UserNotFoundError:
            # Create new user
            new_fb_user = firebase_auth.create_user(email=email, password='DefaultPassword123!')
            target_uid = new_fb_user.uid
            
        target_ref = db.collection('users').document(target_uid)
        target_doc = target_ref.get()
        
        affiliated = []
        if target_doc.exists:
            affiliated = target_doc.to_dict().get('affiliated_orgs', [])
        
        # Check if already in org
        if any(o.get('org_id') == active_org_id for o in affiliated):
            return Response({'message': 'User already in organization'})

        affiliated.append({'org_id': active_org_id, 'role': role})
        target_ref.set({'affiliated_orgs': affiliated, 'email': email}, merge=True)
        
        return Response({'message': 'Invitation successful'})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- Data & Tasks (Scoped) ---

@api_view(['POST'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def ingest_data(request):
    active_org_id = request.active_org_id
    file_b64 = request.data.get('file') 
    mime_type = request.data.get('mime_type', 'image/jpeg')
    file_url = request.data.get('file_url') 
    file_size = int(request.data.get('file_size', 0))
    file_name = request.data.get('file_name', 'Unknown Document') # NEW: Capture File Name
    
    if not file_b64:
        return Response({'error': 'No file data provided'}, status=status.HTTP_400_BAD_REQUEST)

    # Check Organization Storage Limits
    ORG_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024 
    org_ref = db.collection('organizations').document(active_org_id)
    org_doc = org_ref.get()
    if org_doc.exists:
        current_storage = org_doc.to_dict().get('storage_used_bytes', 0)
        if current_storage + file_size > ORG_STORAGE_LIMIT_BYTES:
            return Response({'error': 'Organization storage limit reached (50MB).'}, status=status.HTTP_403_FORBIDDEN)

    file_bytes = base64.b64decode(file_b64)
    
    # NEW: Generate a foolproof SHA-256 hash of the file
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    
    # NEW: Check if this EXACT file has already been uploaded to this Org
    duplicate_check = db.collection('field_reports')\
        .where(filter=FieldFilter('org_id', '==', active_org_id))\
        .where(filter=FieldFilter('file_hash', '==', file_hash))\
        .limit(1)\
        .stream()
        
    existing_reports = list(duplicate_check)
    is_duplicate = len(existing_reports) > 0

    # If it's a duplicate, we can skip burning Gemini API credits!
    if is_duplicate:
        ai_data = {
            "category": existing_reports[0].to_dict().get('category'),
            "urgency": existing_reports[0].to_dict().get('urgency'),
            "location": existing_reports[0].to_dict().get('location'),
            "summary": "Exact file match detected.",
            "keywords": existing_reports[0].to_dict().get('keywords', [])
        }
        location_standardized = existing_reports[0].to_dict().get('location_standardized')
    else:
        # Only process with Gemini if it is a brand new file
        ai_data = process_with_gemini(file_bytes, mime_type)
        if 'error' in ai_data:
            return Response(ai_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        raw_location = str(ai_data.get('location', 'Unknown'))
        location_standardized = re.sub(r'[^a-zA-Z0-9]', '', raw_location).lower()

    # Save Report
    category = ai_data.get('category', 'General').lower()
    
    report_data = {
        'org_id': active_org_id,
        'category': category,
        'urgency': ai_data.get('urgency', 'medium').lower(),
        'location': ai_data.get('location', 'Unknown'),
        'location_standardized': location_standardized,
        'summary': ai_data.get('summary', 'No summary available.'),
        'keywords': ai_data.get('keywords', []), 
        'file_url': file_url, 
        'file_size': file_size,
        'file_name': file_name, # NEW
        'mime_type': mime_type, # NEW
        'file_hash': file_hash, # NEW
        'is_duplicate': is_duplicate,
        'created_at': firestore.SERVER_TIMESTAMP
    }
    
    _, report_ref = db.collection('field_reports').add(report_data)
    
    # Update Org Storage usage only if it's a new file taking up space
    if not is_duplicate:
        org_ref.update({'storage_used_bytes': firestore.Increment(file_size)})
    
    return Response({
        'message': 'Report analyzed', 
        'is_duplicate': is_duplicate, 
        'data': ai_data
    }, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def get_intelligence_feed(request):
    """
    Fetches all reports, separates out duplicates, and groups by category.
    """
    active_org_id = request.active_org_id
    reports_ref = db.collection('field_reports')\
                    .where('org_id', '==', active_org_id)\
                    .order_by('created_at', direction=firestore.Query.DESCENDING)\
                    .stream()
    

    feed = {
        'unique_reports': [],
        'duplicates': []
    }
    
    for r in reports_ref:
        data = r.to_dict()
        data['id'] = r.id
        # Firebase timestamps need to be converted to strings for JSON
        data['created_at'] = data['created_at'].isoformat() if data.get('created_at') else None 
        
        if data.get('is_duplicate'):
            feed['duplicates'].append(data)
        else:
            feed['unique_reports'].append(data)
            
    return Response(feed)

@api_view(['GET'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def get_tasks(request):
    active_org_id = request.active_org_id
    print(active_org_id)
    urgency = request.query_params.get('urgency')
    status_filter = request.query_params.get('status')
    
    query = db.collection('tasks').where('org_id', '==', active_org_id)
    
    if urgency:
        query = query.where('urgency', '==', urgency)
    if status_filter:
        query = query.where('status', '==', status_filter)
        
    tasks = [{'id': doc.id, **doc.to_dict()} for doc in query.stream()]
    return Response(tasks)

@api_view(['PATCH'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def patch_task(request, task_id):
    active_org_id = request.active_org_id
    task_ref = db.collection('tasks').document(task_id)
    task_doc = task_ref.get()
    
    if not task_doc.exists or task_doc.to_dict().get('org_id') != active_org_id:
        return Response({'error': 'Task not found in this organization'}, status=status.HTTP_404_NOT_FOUND)
    
    task_ref.update(request.data)
    return Response({'message': 'Task updated'})

# --- Matching & Assignment ---

@api_view(['GET'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def match_volunteers(request, task_id):
    active_org_id = request.active_org_id
    
    # FIX 1: Point to 'tasks' collection
    task_doc = db.collection('tasks').document(task_id).get()
    
    if not task_doc.exists or task_doc.to_dict().get('org_id') != active_org_id:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Assuming find_best_volunteers is defined elsewhere in your file
    matches = find_best_volunteers(task_doc.to_dict(), active_org_id)
    return Response(matches)

@api_view(['POST'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def assign_task(request, task_id):
    active_org_id = request.active_org_id
    volunteer_uid = request.data.get('volunteer_uid')
    
    # FIX 1: Point to 'tasks' collection
    task_ref = db.collection('tasks').document(task_id)
    task_doc = task_ref.get()
    
    if not task_doc.exists or task_doc.to_dict().get('org_id') != active_org_id:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # FIX 2: Verify volunteer using the new Bridge Table
    membership_ref = db.collection('workspace_members').where('uid', '==', volunteer_uid).where('org_id', '==', active_org_id).limit(1).stream()
    
    # If the stream returns an empty list, they aren't in the workspace
    if not list(membership_ref):
        return Response({'error': 'Volunteer is not in this organization'}, status=status.HTTP_400_BAD_REQUEST)

    # Success! Update the task.
    task_ref.update({'assigned_to_uid': volunteer_uid, 'status': 'assigned'})
    return Response({'message': f'Task assigned to {volunteer_uid}'})

# --- Collaboration & Analytics ---

@api_view(['GET', 'POST'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def task_comments(request, task_id):
    active_org_id = request.active_org_id
    task_doc = db.collection('processed_tasks').document(task_id).get()
    
    if not task_doc.exists or task_doc.to_dict().get('org_id') != active_org_id:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
        
    comments_ref = db.collection('comments').where('task_id', '==', task_id)
    
    if request.method == 'GET':
        comments = [{'id': doc.id, **doc.to_dict()} for doc in comments_ref.stream()]
        return Response(comments)
    
    if request.method == 'POST':
        text = request.data.get('text')
        if not text:
            return Response({'error': 'Comment text required'}, status=status.HTTP_400_BAD_REQUEST)
            
        _, comment_ref = db.collection('comments').add({
            'task_id': task_id,
            'user_id': request.user.username,
            'text': text,
            'timestamp': firestore.SERVER_TIMESTAMP
        })
        return Response({'message': 'Comment added', 'id': comment_ref.id})

@api_view(['GET'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def org_analytics(request):
    active_org_id = request.active_org_id
    
    # Simple real-time aggregation (In production, use counters or BigQuery)
    tasks = db.collection('processed_tasks').where('org_id', '==', active_org_id).stream()
    total_tasks = 0
    completed_tasks = 0
    
    for doc in tasks:
        total_tasks += 1
        if doc.to_dict().get('status') == 'completed':
            completed_tasks += 1
            
    # Count volunteers
    # This is expensive in Firestore for many users, but fine for MVP
    users = db.collection('users').stream()
    active_volunteers = 0
    for doc in users:
        data = doc.to_dict()
        affiliated = next((o for o in data.get('affiliated_orgs', []) if o.get('org_id') == active_org_id), None)
        if affiliated and affiliated.get('role') == 'volunteer':
            active_volunteers += 1
            
    return Response({
        'total_tasks': total_tasks,
        'completed_tasks': completed_tasks,
        'active_volunteers': active_volunteers
    })
# ==========================================
# Restored Dashboard Functions
# ==========================================

@api_view(['GET'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def get_org_data(request):
    active_org_id = request.active_org_id
    
    org_doc = db.collection('organizations').document(active_org_id).get()
    if not org_doc.exists:
        return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)
        
    return Response({'id': org_doc.id, **org_doc.to_dict()})

@api_view(['GET'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def get_org_members(request):
    active_org_id = request.active_org_id
    
    # 1. Query the bridge table for everyone in THIS specific workspace
    memberships = db.collection('workspace_members').where('org_id', '==', active_org_id).stream()
    
    members = []
    
    for membership in memberships:
        membership_data = membership.to_dict()
        uid = membership_data.get('uid')
        role = membership_data.get('role', 'volunteer')
        
        # 2. Fetch the actual user profile data for each member
        user_doc = db.collection('users').document(uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            members.append({
                'uid': uid,
                'name': user_data.get('name', 'Unknown Volunteer'),
                'email': user_data.get('email', 'No Email Provided'),
                'location': user_data.get('location', ''),
                'skills': user_data.get('skills', []),
                'role': role
            })
            
    return Response(members)

from rest_framework import status

@api_view(['POST'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def create_task(request):
    """Manually creates a task scoped to the active org."""
    active_org_id = request.active_org_id
    data = request.data
    
    # Add organization context and metadata
    data.update({
        'org_id': active_org_id,
        'status': 'pending',
        'created_at': firestore.SERVER_TIMESTAMP,
        'created_by': request.user.username
    })
    
    # Save to Firestore
    doc_ref = db.collection('tasks').add(data)
    return Response({'id': doc_ref[1].id, 'message': 'Task created'}, status=201)

@api_view(['DELETE'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def delete_task(request, task_id):
    """Deletes a specific task."""
    # Logic check: Ensure task belongs to this org before deleting
    task_ref = db.collection('tasks').document(task_id)
    task_doc = task_ref.get()
    
    if not task_doc.exists or task_doc.to_dict().get('org_id') != request.active_org_id:
        return Response({'error': 'Task not found or unauthorized'}, status=404)
        
    task_ref.delete()
    return Response({'message': 'Task deleted'}, status=200)

@api_view(['POST'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def add_org_member(request):
    """
    MVP Invite: Directly adds an existing user to the organization by email.
    """
    # 1. Enforce Admin Only
    if request.user_role != 'admin':
        return Response({'error': 'Only admins can add new members.'}, status=403)
    
    email = request.data.get('email')
    role = request.data.get('role', 'volunteer')
    active_org_id = request.active_org_id

    if not email:
        return Response({'error': 'Email is required.'}, status=400)

    # 2. Find the user by email in the general users collection
    users_ref = db.collection('users').where('email', '==', email).limit(1).stream()
    users_list = list(users_ref)
    
    if not users_list:
        return Response({'error': 'User not found. They must create an AidFlow account first.'}, status=404)
    
    target_uid = users_list[0].id
    
    # 3. Check if they are already in the bridge table for this org
    members_ref = db.collection('workspace_members').where('uid', '==', target_uid).where('org_id', '==', active_org_id).limit(1).stream()
    if list(members_ref):
        return Response({'error': 'This user is already a member of this organization.'}, status=400)
        
    # 4. Create the bridge table record!
    db.collection('workspace_members').add({
        'uid': target_uid,
        'org_id': active_org_id,
        'role': role
    })
    
    return Response({'success': True, 'message': 'Member added successfully!'})


@api_view(['PUT'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated, RequiresActiveOrg])
def edit_org_member(request):
    """
    Allows admins to promote/demote users (e.g., volunteer -> admin).
    """
    if request.user_role != 'admin':
        return Response({'error': 'Only admins can edit member roles.'}, status=403)
    
    target_uid = request.data.get('uid')
    new_role = request.data.get('role')
    active_org_id = request.active_org_id

    if not target_uid or not new_role:
        return Response({'error': 'UID and new role are required.'}, status=400)

    # Prevent admin from accidentally demoting themselves
    if target_uid == request.user.username and new_role != 'admin':
        return Response({'error': 'You cannot demote yourself. Another admin must do it.'}, status=400)

    # Find their specific bridge document
    members_ref = db.collection('workspace_members').where('uid', '==', target_uid).where('org_id', '==', active_org_id).limit(1).stream()
    members_list = list(members_ref)
    
    if not members_list:
        return Response({'error': 'Membership record not found.'}, status=404)
        
    # Update the document
    doc_id = members_list[0].id
    db.collection('workspace_members').document(doc_id).update({
        'role': new_role
    })
    
    return Response({'success': True, 'message': 'Member role updated.'})