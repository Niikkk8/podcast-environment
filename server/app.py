from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = "AIzaSyDv5AsvRiDXJaY8MD1JdQAvU5pjjFK4Zzs"
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash')

def get_conversation_style(preferences):
    tone_map = {
        'casual': "Use a conversational, friendly tone with everyday language and relatable examples.",
        'professional': "Maintain a professional tone while being clear and accessible.",
        'academic': "Use academic language and technical terminology appropriately."
    }

    detail_map = {
        'overview': "Focus on high-level concepts and main takeaways.",
        'balanced': "Balance key concepts with supporting details.",
        'detailed': "Include specific details and technical aspects."
    }

    audience_map = {
        'general': "Explain concepts for an educated but non-expert audience.",
        'academic': "Use scholarly language and focus on research implications.",
        'industry': "Emphasize practical applications and industry relevance."
    }

    return f"""
    {tone_map[preferences['tone']]}
    {detail_map[preferences['detailLevel']]}
    {audience_map[preferences['targetAudience']]}
    """

def extract_topic_details(text):
    try:
        analysis_prompt = f"""Analyze the following text and extract:
        1. A suitable title for this topic
        2. The main field/area this topic belongs to
        Keep the response in simple format: "Title: [title]\nTopic: [topic]"
        
        Text: {text[:2000]}"""
        
        response = model.generate_content(analysis_prompt)
        analysis = response.text.strip()
        
        title_line = [line for line in analysis.split('\n') if line.startswith('Title:')]
        topic_line = [line for line in analysis.split('\n') if line.startswith('Topic:')]
        
        title = title_line[0].replace('Title:', '').strip() if title_line else "Discussion Topic"
        topic = topic_line[0].replace('Topic:', '').strip() if topic_line else "General Discussion"
        
        return title, topic
    except Exception as e:
        print(f"Error extracting topic details: {e}")
        return "Discussion Topic", "General Discussion"

def generate_conversation(text, preferences, title, topic):
    conversation = []
    style_instructions = get_conversation_style(preferences)
    
    # Introduction
    intro_prompt = f"""Generate a welcoming podcast introduction for a discussion about '{title}'.
    
    Guidelines:
    - Start with a general welcome
    - No personal references or specific host names
    - Focus on the topic and its importance
    - Use engaging but professional language
    
    {style_instructions}"""
    
    host_intro = model.generate_content(intro_prompt)
    conversation.append({"speaker": "Host", "message": host_intro.text.strip()})
    
    guest_intro = model.generate_content(f"""
    Generate an expert's opening response about the topic '{title}'.
    - Express enthusiasm about discussing this topic
    - Highlight why this topic is interesting or important
    - Use natural, conversational language
    
    {style_instructions}
    """)
    conversation.append({"speaker": "Guest", "message": guest_intro.text.strip()})
    
    # Main discussion points
    prompts = [
        (f"Ask about the main aspects or key points of this topic.\nContext: {text[:500]}", True),
        (f"Explain the fundamental concepts and their significance.\nContext: {text[:500]}", False),
        (f"Ask about practical applications or real-world implications.", True),
        (f"Discuss the practical implications and applications in detail.\nContext: {text[500:1000]}", False),
        (f"Ask about challenges or interesting aspects of this topic.", True),
        (f"Explain the challenges and interesting aspects.\nContext: {text[1000:1500]}", False),
        (f"Ask about future developments or potential impact.", True),
        (f"Discuss future possibilities and potential impact.\nContext: {text[1500:2000]}", False)
    ]
    
    for prompt in prompts:
        response = model.generate_content(f"{prompt[0]}\n{style_instructions}")
        conversation.append({
            "speaker": "Host" if prompt[1] else "Guest",
            "message": response.text.strip()
        })
    
    # Closing
    closing = model.generate_content(f"""Generate a concluding remark for the discussion about '{title}'.
    - Summarize key points
    - Thank the audience
    - End on an engaging note
    
    {style_instructions}""")
    conversation.append({"speaker": "Host", "message": closing.text.strip()})
    
    return conversation

@app.route('/api/generate-podcast', methods=['POST'])
def generate_podcast():
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400

        preferences = data.get('preferences', {
            'tone': 'casual',
            'detailLevel': 'balanced',
            'targetAudience': 'general'
        })
        
        input_text = data['text']
        title, topic = extract_topic_details(input_text)
        conversation = generate_conversation(
            input_text,
            preferences,
            title,
            topic
        )

        return jsonify({
            'conversation': conversation,
            'title': title,
            'topic': topic
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)