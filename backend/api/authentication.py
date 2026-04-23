import firebase_admin
from firebase_admin import auth, credentials, firestore
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
import os
from dotenv import load_dotenv
from django.contrib.auth.models import User

load_dotenv()

if not firebase_admin._apps:
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if service_account_path and os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)

class FirebaseAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        
        if not auth_header:
            return None 

        try:
            token = auth_header.split(' ')[1]
            decoded_token = auth.verify_id_token(token)
            uid = decoded_token.get('uid')
            email = decoded_token.get('email', '') 
        except Exception:
            raise AuthenticationFailed('Invalid or expired Firebase token')

        user, _ = User.objects.get_or_create(
            username=uid, 
            defaults={'email': email}
        )

        return (user, token)

class RequiresActiveOrg(BasePermission):
    """
    Enforces that X-Active-Org-Id header is present and valid for the user.
    Sets request.active_org_id on the request object.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        active_org_id = request.headers.get('X-Active-Org-Id')
        if not active_org_id:
            raise PermissionDenied('Missing X-Active-Org-Id header')

        uid = request.user.username
        db = firestore.client()
        
        # 1. Query the NEW workspace_members bridge table
        memberships_ref = db.collection('workspace_members')
        query = memberships_ref.where('uid', '==', uid).where('org_id', '==', active_org_id).limit(1)
        
        # Stream the results and convert to a list
        results = list(query.stream())

        # 2. If the list is empty, they don't have access to this org
        if not results:
            print(f"DEBUG: Denied! No workspace_members record found for UID {uid} and ORG {active_org_id}")
            raise PermissionDenied('User is not affiliated with this organization')

        # 3. Extract the role from the bridge record
        membership_data = results[0].to_dict()

        # Attach active org context to request for the view to use
        request.active_org_id = active_org_id
        request.user_role = membership_data.get('role', 'volunteer') # Default to volunteer if not set
        
        return True