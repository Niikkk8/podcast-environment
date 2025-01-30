# server/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber
import google.generativeai as genai
from werkzeug.serving import WSGIRequestHandler

# Increase timeout
WSGIRequestHandler.protocol_version = "HTTP/1.1"

app = Flask(__name__)
# Configure CORS with additional options
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Configure max content length (100MB)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

# Configure Gemini API
GEMINI_API_KEY = "AIzaSyCYS1M4u1YjlSPmRcook-eO-B2UV2OtyNc"
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')

class ChatBot:
    def __init__(self, name, personality, instructions):
        self.name = name
        self.personality = personality
        self.instructions = instructions

    def chat(self, input_text):
        try:
            prompt = f"{self.personality}\n{self.instructions}\n\nInput: {input_text}"
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

def extract_paper_details(text):
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    title = lines[0] if lines else "Untitled Paper"
    topic = lines[1] if len(lines) > 1 else "General Research"
    return title, topic

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response

@app.route('/api/test', methods=['GET'])
def test():
    return jsonify({'status': 'Backend server is running'})

@app.route('/api/generate-podcast', methods=['POST', 'OPTIONS'])
def generate_podcast():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        if 'pdf' not in request.files:
            return jsonify({'error': 'No PDF file provided'}), 400

        pdf_file = request.files['pdf']
        if pdf_file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        research_paper_text = extract_text_from_pdf(pdf_file)
        if not research_paper_text:
            return jsonify({'error': 'Failed to extract text from PDF'}), 400

        research_paper_title, research_paper_topic = extract_paper_details(research_paper_text)

        HOST_PERSONALITY_PROMPT = f"""
        You are the host of a podcast discussing the research paper titled '{research_paper_title}'. 
        The paper focuses on {research_paper_topic}. You are an enthusiastic, friendly, and knowledgeable interviewer. 
        Your goal is to break down complex concepts and keep the conversation engaging.
        Keep your responses concise and natural, as if speaking in a real podcast.
        """

        GUEST_PERSONALITY_PROMPT = f"""
        You are the guest, an expert in {research_paper_topic}. You passionately discuss the research paper '{research_paper_title}', 
        making exaggerated but engaging statements about its impact. Your responses are insightful yet humorous.
        Keep your responses concise and natural, as if speaking in a real podcast.
        """

        host = ChatBot(
            name="Host",
            personality=HOST_PERSONALITY_PROMPT,
            instructions="Ask insightful questions based on the research paper."
        )

        guest = ChatBot(
            name="Guest",
            personality=GUEST_PERSONALITY_PROMPT,
            instructions="Provide expert answers in a humorous manner based on the research paper."
        )

        try:
            conversation = []
            # Initial message from host
            print("Generating initial host message...")
            message = host.chat(f"Let's begin by discussing the introduction of the paper: {research_paper_text[:1000]}...")
            conversation.append({"speaker": "Host", "message": message})

            # Generate exchanges (reduced to 5 for faster response)
            for i in range(5):
                print(f"Generating exchange {i + 1}/5...")
                # Guest response
                response = guest.chat(message)
                conversation.append({"speaker": "Guest", "message": response})
                
                # Host follow-up
                message = host.chat(response)
                conversation.append({"speaker": "Host", "message": message})

            print("Conversation generation completed!")
            return jsonify({
                'conversation': conversation,
                'title': research_paper_title,
                'topic': research_paper_topic
            })

        except Exception as e:
            print(f"Error in conversation generation: {e}")
            return jsonify({'error': 'Failed to generate conversation'}), 500

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting server...")
    app.run(debug=True, port=5000, threaded=True, host='0.0.0.0')