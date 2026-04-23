import google.generativeai as genai
import json
import os
from firebase_admin import firestore
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=API_KEY)

# Set a hackathon MVP storage limit (e.g., 50 MB)
ORG_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024 

def process_with_gemini(file_bytes, mime_type):
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # POINT 1, 4, & 6: Strict Categories, Short Summary, Keywords
    prompt = """
    Analyze this raw field data from an NGO operation.
    
    You MUST return ONLY a raw JSON object with this exact structure:
    {
        "category": "Must be exactly one of: [Water, Food, Medical, Shelter, Infrastructure, Rescue, General]",
        "urgency": "low, medium, high, or critical",
        "location": "Specific city, village, or area name.",
        "summary": "A strict ONE-SENTENCE summary of the situation.",
        "keywords": ["tag1", "tag2", "tag3"] // Provide 3-5 highly relevant, single-word search keywords based on the content
    }
    """
    
    try:
        response = model.generate_content([{'mime_type': mime_type, 'data': file_bytes}, prompt])
        clean_text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"Gemini Error: {e}")
        return {"error": "Failed to parse AI response."}

def find_best_volunteers(task_data, active_org_id):
    """
    Smart Matching Engine: Ranks volunteers based on skills and location using the Bridge Table.
    """
    db = firestore.client()
    
    # 1. Query the bridge table for volunteers specifically in this org
    # This is O(1) efficiency compared to streaming the entire users collection!
    members_ref = db.collection('workspace_members')\
                    .where('org_id', '==', active_org_id)\
                    .where('role', '==', 'volunteer')\
                    .stream()
    
    volunteers = []
    
    # Safely get task requirements
    task_skills = set(task_data.get('skills_needed', []))
    task_location = str(task_data.get('location', '')).strip().lower()
    
    for member in members_ref:
        uid = member.to_dict().get('uid')
        if not uid:
            continue
            
        # 2. Fetch the actual user profile for the matched volunteer
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists:
            continue
            
        data = user_doc.to_dict()
        score = 0
        user_skills = set(data.get('skills', []))
        
        # Skill scoring (+2 points per matching skill)
        skill_hits = user_skills.intersection(task_skills)
        score += len(skill_hits) * 2
        
        # Location scoring (+1 point for exact location match)
        user_location = str(data.get('location', '')).strip().lower()
        if user_location and user_location == task_location:
            score += 1
        
        volunteers.append({
            'uid': uid,
            'name': data.get('name', 'Unknown Volunteer'),
            'score': score,
            'skills': list(user_skills),
            'location': data.get('location', 'N/A')
        })
        
    # Sort by score descending
    volunteers.sort(key=lambda x: x['score'], reverse=True)
    return volunteers[:5] # Return top 5