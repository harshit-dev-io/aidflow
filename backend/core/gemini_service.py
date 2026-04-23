import google.generativeai as genai
import json
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=API_KEY)

def process_unstructured_data(raw_text):
    # Depending on model access, gemini-1.5-pro or gemini-1.5-flash since we are building an MVP
    try:
        model = genai.GenerativeModel('gemini-1.5-pro')
    except Exception:
        # Fallback if pro is unavailable in configuration
        model = genai.GenerativeModel('gemini-pro')

    prompt = f"""
    You are an emergency triage AI for an NGO.
    Analyze the following raw field report and extract the details into strict JSON format.
    
    RULES:
    1. Output ONLY valid JSON, nothing else. No markdown wrappers like ```json. 
    2. "issue_type" MUST be exactly one of: water, food, health, education, emergency. Pick the closest match.
    3. "urgency_level" MUST be exactly one of: low, medium, high, critical. Pick the closest match.
    
    RAW DATA:
    {raw_text}
    
    OUTPUT SCHEMA:
    {{
      "issue_type": "string",
      "urgency_level": "string",
      "location": "string",
      "summary": "string",
      "required_volunteers": integer,
      "skills_needed": ["list", "of", "skills"]
    }}
    """

    try:
        response = model.generate_content(prompt)
        
        # Strip potential markdown formatting from Gemini response
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(clean_json)
        return data
    except json.JSONDecodeError:
        # Fallback error handling
        return {"error": "Failed to parse JSON from AI response."}
    except Exception as e:
        return {"error": str(e)}
