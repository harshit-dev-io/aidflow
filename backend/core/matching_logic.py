def score_volunteer(volunteer, task):
    score = 0
    # 1. Broad Category Match (highest weight)
    # Volunteer category vs Task issue_type
    if volunteer.category.lower() == task.issue_type.lower():
        score += 50
        
    # 2. Skill Match (medium weight)
    v_skills = set([s.lower() for s in volunteer.skills])
    t_skills = set([s.lower() for s in task.skills_needed])
    matched_skills = v_skills.intersection(t_skills)
    score += len(matched_skills) * 10
    
    # 3. Location/Proximity Match (basic string match for MVP)
    if volunteer.location.lower() == task.location.lower():
        score += 20
        
    # 4. Availability
    if volunteer.is_available:
        score += 10
    else:
        score -= 100 # Drop unavailable heavily

    return score

def get_best_volunteers(task, all_volunteers):
    scored_volunteers = []
    for v in all_volunteers:
        score = score_volunteer(v, task)
        if score > 0:
            scored_volunteers.append({'volunteer': v, 'score': score})
            
    # Sort by score descending
    return sorted(scored_volunteers, key=lambda x: x['score'], reverse=True)
