from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber
import google.generativeai as genai
from werkzeug.serving import WSGIRequestHandler

WSGIRequestHandler.protocol_version = "HTTP/1.1"

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

GEMINI_API_KEY = "AIzaSyCYS1M4u1YjlSPmRcook-eO-B2UV2OtyNc"
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')

def extract_key_points(text):
    """Extract key points from the paper for structured discussion"""
    try:
        analysis_prompt = f"""Analyze this research paper and identify 5 key points for discussion:
        1. Main objective/problem being addressed
        2. Methodology or approach
        3. Key findings or results
        4. Practical implications
        5. Future directions or challenges
        
        Format the response as:
        Point1: [brief description]
        Point2: [brief description]
        Point3: [brief description]
        Point4: [brief description]
        Point5: [brief description]
        
        Text: {text[:3000]}"""
        
        response = model.generate_content(analysis_prompt)
        points = response.text.strip().split('\n')
        return points
    except Exception as e:
        print(f"Error extracting key points: {e}")
        return []

def extract_paper_details(text):
    """Extract title and main topic from the paper text"""
    try:
        analysis_prompt = f"""Analyze the following research paper text and extract:
        1. The paper's title
        2. The main research topic/field
        Keep the response in simple format: "Title: [title]\nTopic: [topic]"
        
        Text: {text[:2000]}"""
        
        response = model.generate_content(analysis_prompt)
        analysis = response.text.strip()
        
        title_line = [line for line in analysis.split('\n') if line.startswith('Title:')]
        topic_line = [line for line in analysis.split('\n') if line.startswith('Topic:')]
        
        title = title_line[0].replace('Title:', '').strip() if title_line else "Untitled Research Paper"
        topic = topic_line[0].replace('Topic:', '').strip() if topic_line else "General Research"
        
        return title, topic
    except Exception as e:
        print(f"Error extracting paper details: {e}")
        return "Untitled Research Paper", "General Research"

def generate_prompt(role, context, paper_title, paper_topic, conversation_stage, key_points):
    """Generate prompts based on conversation stage"""
    stages = {
        0: "introduction",
        1: "objective",
        2: "methodology",
        3: "findings",
        4: "implications",
        5: "conclusion"
    }
    
    stage = stages.get(conversation_stage, "discussion")
    current_point = key_points[conversation_stage - 1] if 0 < conversation_stage < len(key_points) + 1 else ""
    
    base_prompts = {
        "host": {
            "introduction": f"""You're hosting a research podcast discussing {paper_title}. 
                Welcome the audience and introduce today's topic.
                Acknowledge our guest expert who will help explore this research.
                Do not mention any names or use speaker labels.
                Keep responses between 2-3 sentences.""",
            
            "objective": """Ask about the research objective and its importance.
                Be curious and encouraging.
                Focus on why this research matters.
                Keep responses between 2-3 sentences.
                Do not use any names or speaker labels.""",
            
            "methodology": """Inquire about the research approach and methods.
                Show genuine interest in the process.
                Ask for clarification on complex aspects.
                Keep responses between 2-3 sentences.
                Do not use any names or speaker labels.""",
            
            "findings": """Ask about the key research findings.
                Show enthusiasm about the discoveries.
                Focus on their significance.
                Keep responses between 2-3 sentences.
                Do not use any names or speaker labels.""",
            
            "implications": """Ask about practical applications and impact.
                Focus on real-world benefits.
                Show interest in potential implementations.
                Keep responses between 2-3 sentences.
                Do not use any names or speaker labels.""",
            
            "conclusion": """Ask about future research directions.
                Discuss exciting possibilities ahead.
                Wrap up the conversation naturally.
                Keep responses between 2-3 sentences.
                Do not use any names or speaker labels."""
        },
        
        "guest": {
            "introduction": f"""You're a research expert discussing {paper_title}.
                Express enthusiasm for the topic and mention your relevant expertise.
                Keep it natural without using any names or speaker labels.
                Keep responses between 2-3 sentences.""",
            
            "objective": """Explain the main research objective clearly.
                Use simple language and relatable examples.
                Focus on why this work matters.
                Keep responses between 2-3 sentences.
                Do not use any names or speaker labels.""",
            
            "methodology": """Describe the research approach engagingly.
                Make complex methods understandable.
                Use clear, accessible language.
                Keep responses between 2-3 sentences.
                Do not use any names or speaker labels.""",
            
            "findings": """Share the key findings with enthusiasm.
                Explain their significance clearly.
                Use accessible terms and examples.
                Keep responses between 2-3 sentences.
                Do not use any names or speaker labels.""",
            
            "implications": """Discuss practical applications enthusiastically.
                Share potential real-world impact.
                Use concrete examples.
                Keep responses between 2-3 sentences.
                Do not use any names or speaker labels.""",
            
            "conclusion": """Share thoughts on future possibilities.
                Express optimism about potential developments.
                End on an engaging note.
                Keep responses between 2-3 sentences.
                Do not use any names or speaker labels."""
        }
    }
    
    stage_prompt = base_prompts[role][stage]
    return f"{stage_prompt}\nContext: {context}\nCurrent point: {current_point}"

def chat_with_model(prompt):
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Error in chat API request: {e}")
        return "Error: Unable to fetch response."

def extract_text_from_pdf(pdf_file):
    try:
        with pdfplumber.open(pdf_file) as pdf:
            text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return None

@app.route('/api/generate-podcast', methods=['POST'])
def generate_podcast():
    try:
        if 'pdf' not in request.files:
            return jsonify({'error': 'No PDF file provided'}), 400

        pdf_file = request.files['pdf']
        if pdf_file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        research_paper_text = extract_text_from_pdf(pdf_file)
        if not research_paper_text:
            return jsonify({'error': 'Failed to extract text from PDF'}), 400

        # Extract paper details and key points
        title, topic = extract_paper_details(research_paper_text)
        key_points = extract_key_points(research_paper_text)
        conversation = []
        
        # Generate structured conversation through different stages
        for stage in range(6):  # 0=intro, 1-4=main points, 5=conclusion
            context = key_points[stage - 1] if 0 < stage < len(key_points) + 1 else research_paper_text[:1500]
            
            # Host question/comment
            host_prompt = generate_prompt("host", context, title, topic, stage, key_points)
            host_response = chat_with_model(host_prompt)
            conversation.append({"speaker": "Host", "message": host_response})
            
            # Guest response
            guest_prompt = generate_prompt("guest", host_response, title, topic, stage, key_points)
            guest_response = chat_with_model(guest_prompt)
            conversation.append({"speaker": "Guest", "message": guest_response})

        return jsonify({
            'conversation': conversation,
            'title': title,
            'topic': topic
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True, host='0.0.0.0')