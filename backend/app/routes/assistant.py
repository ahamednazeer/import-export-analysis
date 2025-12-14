"""
AI Assistant Routes

Provides chat and context endpoints for the AI assistant.
All endpoints require authentication and respect role boundaries.
"""

from flask import Blueprint, request, jsonify, session
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.services.ai_assistant import ai_assistant_service
import uuid

assistant_bp = Blueprint('assistant', __name__)


@assistant_bp.route('/chat', methods=['POST'])
@jwt_required()
def chat():
    """
    Send a message to the AI assistant.
    
    Request body:
        message: str - The user's message
    
    Returns:
        response: str - AI assistant's response
        context_summary: str - Brief summary of current context
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    message = data.get('message', '').strip()
    
    if not message:
        return jsonify({'error': 'Message is required'}), 400
    
    # Get or create session ID for conversation continuity
    session_id = session.get('assistant_session_id')
    
    if not session_id:
        # Check for existing active session in DB
        active_session = ai_assistant_service.get_latest_session(user.id)
        if active_session:
            session_id = active_session.id
        else:
            session_id = str(uuid.uuid4())
            
        session['assistant_session_id'] = session_id
    
    result = ai_assistant_service.chat(user, message, session_id)
    
    return jsonify({
        'response': result['response'],
        'context_summary': result.get('context_summary', ''),
        'user_role': user.role.value
    })


@assistant_bp.route('/context', methods=['GET'])
@jwt_required()
def get_context():
    """
    Get current context summary for the user's role.
    
    Returns:
        role: str - User's role
        summary: str - Brief context summary
        details: str - Detailed context information
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    context = ai_assistant_service.get_context(user)
    
    return jsonify(context)


@assistant_bp.route('/history', methods=['GET'])
@jwt_required()
def get_history():
    """
    Get conversation history for the current session.
    
    Returns:
        history: list - List of message objects
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    session_id = session.get('assistant_session_id')
    
    # If no session in cookie, try to find active session in DB
    if not session_id and user:
        active_session = ai_assistant_service.get_latest_session(user.id)
        if active_session:
            session_id = active_session.id
            # Restore session to cookie
            session['assistant_session_id'] = session_id
    
    history = []
    
    if session_id:
        history = ai_assistant_service.get_history(session_id)
    
    return jsonify({'history': history})


@assistant_bp.route('/history', methods=['DELETE'])
@jwt_required()
def clear_history():
    """
    Clear conversation history for the current session.
    
    Returns:
        message: str - Confirmation message
    """
    session_id = session.get('assistant_session_id')
    
    if session_id:
        ai_assistant_service.clear_history(session_id)
        # Generate new session ID
        session['assistant_session_id'] = str(uuid.uuid4())
    
    return jsonify({'message': 'Conversation history cleared'})


@assistant_bp.route('/welcome', methods=['GET'])
@jwt_required()
def get_welcome():
    """
    Get a role-specific welcome message.
    
    Returns:
        message: str - Welcome message for the user's role
        suggestions: list - Suggested questions/actions
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    role = user.role.value
    name = user.first_name
    
    welcome_messages = {
        'ADMIN': {
            'message': f"Hey {name}! I'm Hub Buddy, your friendly system assistant! I'm here to help you manage users, check on system health, and make sure everything's running smoothly. What can I help with?",
            'suggestions': [
                "How's the system looking?",
                "Who's on the team?",
                "Give me a quick overview!"
            ]
        },
        'DEALER': {
            'message': f"Hi {name}! I'm Hub Buddy! I'm here to help you keep track of your orders and answer any questions. What would you like to know?",
            'suggestions': [
                "How are my orders doing?",
                "Help me create a new order",
                "When can I expect delivery?"
            ]
        },
        'WAREHOUSE_OPERATOR': {
            'message': f"Hey {name}! Ready to tackle today's tasks? I'm Hub Buddy, here to help with picks, inspections, and all things warehouse!",
            'suggestions': [
                "What's on my to-do list?",
                "How do I upload photos?",
                "Why was this item flagged?"
            ]
        },
        'PROCUREMENT_MANAGER': {
            'message': f"Hi {name}! I'm Hub Buddy, your procurement sidekick! I can help you review issues, understand AI findings, and figure out the best path forward.",
            'suggestions': [
                "What needs my attention?",
                "Tell me about the blocked items",
                "What are my options here?"
            ]
        },
        'LOGISTICS_PLANNER': {
            'message': f"Hey {name}! Let's get things moving! I'm Hub Buddy, here to help with shipments, routes, and deliveries.",
            'suggestions': [
                "What's ready to ship?",
                "Any issues I should know about?",
                "Show me what's pending"
            ]
        }
    }
    
    default = {
        'message': f"Hey {name}! I'm Hub Buddy! How can I help you today?",
        'suggestions': ["What can you help me with?"]
    }
    
    return jsonify(welcome_messages.get(role, default))
