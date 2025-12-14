"""
AI Assistant Service - Role-Aware Chat Assistant

Provides intelligent, context-aware assistance to users based on their role.
The assistant follows strict role boundaries and never reveals data outside 
the user's permissions.
"""

import os
from datetime import datetime, timedelta
import uuid
from typing import Optional
from flask import session
from app import db
from app.models.user import User, Role
from app.models.request import ProductRequest, Reservation, RequestStatus
from app.models.warehouse import Warehouse, Stock
from app.models.supplier import Supplier
from app.models.shipment import Shipment
from app.models.chat import ChatSession, ChatMessage
from app.services.encryption import EncryptionService


class AIAssistantService:
    """
    Role-aware AI assistant using Groq API (Llama 4 Scout model).
    
    The assistant:
    - Knows who the user is
    - Knows what they are doing
    - Knows why they might be waiting
    - Explains things proactively
    - Never reveals data outside role boundaries
    """
    
    def __init__(self):
        self.api_key = os.getenv('GROQ_API_KEY', '')
        self.model = "llama-3.3-70b-versatile"  # Better for chat than vision model
        self.max_history = 10  # Keep last 10 exchanges per session
    
    def chat(self, user: User, message: str, session_id: str) -> dict:
        """
        Process a chat message and return AI response.
        
        Args:
            user: Current authenticated user
            message: User's message
            session_id: Session ID for conversation history
        
        Returns:
            dict with 'response' and 'context_summary'
        """
        # Ensure session exists in DB
        self._ensure_session(session_id, user.id)
        
        if not self.api_key:
            return {
                'response': self._get_mock_response(user, message),
                'context_summary': 'Mock mode - No API key configured'
            }
        
        try:
            from groq import Groq
            client = Groq(api_key=self.api_key)
            
            # Get conversation history from DB
            history = self._get_conversation_history(session_id)
            
            # Build role-specific context
            context = self._build_context(user)
            system_prompt = self._build_system_prompt(user, context)
            
            # Build messages array
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(history)
            messages.append({"role": "user", "content": message})
            
            # Call Groq API
            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=600,
                temperature=0.7
            )
            
            ai_response = response.choices[0].message.content
            
            # Save to history (DB)
            self._add_to_history(session_id, message, ai_response)
            
            return {
                'response': ai_response,
                'context_summary': context.get('summary', '')
            }
            
        except Exception as e:
            print(f"[AI ASSISTANT] Error: {str(e)}")
            return {
                'response': f"I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
                'context_summary': f"Error: {str(e)}"
            }
    
    def get_context(self, user: User) -> dict:
        """Get current context summary for user's role"""
        return self._build_context(user)
    
    def clear_history(self, session_id: str):
        """Clear conversation history for a session"""
        chat_session = ChatSession.query.get(session_id)
        if chat_session:
            # Delete session (cascades to messages)
            db.session.delete(chat_session)
            db.session.commit()
    
    def get_history(self, session_id: str) -> list:
        """Get conversation history for public API"""
        # Also triggers cleanup of old sessions
        self._cleanup_old_sessions()
        
        msgs = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.created_at).all()
        return [msg.to_dict() for msg in msgs]

    def get_latest_session(self, user_id: int) -> Optional[ChatSession]:
        """Get latest active session for user from DB"""
        self._cleanup_old_sessions()
        return ChatSession.query.filter_by(
            user_id=user_id, 
            is_active=True
        ).order_by(ChatSession.updated_at.desc()).first()

    def _ensure_session(self, session_id: str, user_id: int):
        """Ensure DB session exists"""
        chat_session = ChatSession.query.get(session_id)
        if not chat_session:
            chat_session = ChatSession(id=session_id, user_id=user_id)
            db.session.add(chat_session)
            db.session.commit()
        else:
            # Update timestamp
            chat_session.updated_at = datetime.utcnow()
            db.session.commit()

    def _cleanup_old_sessions(self):
        """Delete sessions older than 24 hours"""
        try:
            cutoff = datetime.utcnow() - timedelta(hours=24)
            # Find old sessions
            old_sessions = ChatSession.query.filter(ChatSession.updated_at < cutoff).all()
            for sess in old_sessions:
                db.session.delete(sess)
            if old_sessions:
                db.session.commit()
        except Exception as e:
            print(f"[AI CLEANUP] Error: {e}")
            db.session.rollback()
    
    def _build_system_prompt(self, user: User, context: dict) -> str:
        """Build role-specific system prompt"""
        
        role = user.role.value
        name = user.first_name
        
        base_prompt = f"""You are a friendly, helpful AI assistant named "Hub Buddy" for the Import/Export Hub application.
You're chatting with {name}, who works as a {role.replace('_', ' ')}.

YOUR PERSONALITY:
- You're warm, friendly, and encouraging - like a helpful coworker who's always happy to help!
- Use casual, conversational language (contractions, friendly phrases like "No worries!", "Great question!", "You're all set!")
- Be positive and reassuring, especially when explaining delays or issues
- Celebrate wins! Say "Awesome!", "Nice work!", "Looking good!" when things are going well
- DO NOT use emojis - keep it text-only
- Keep things light and approachable - you're a buddy, not a robot!

IMPORTANT BOUNDARIES:
- You ONLY know what {role}s are allowed to see - that's the rule!
- Don't reveal internal details, other people's stuff, or behind-the-scenes info
- If you can't share something, just say "I don't have visibility into that, but here's what I can help with!"

CURRENT TIME: {datetime.now().strftime('%Y-%m-%d %H:%M')}

HOW TO STRUCTURE YOUR RESPONSES:
- Keep it conversational but organized
- Use bullet points for quick lists
- Use numbered lists (1. 2. 3.) when there are steps to follow
- Bold **key info** so it stands out
- For status updates, try something like:
  "**Here's what's up:** [status]"
  "**What's happening now:** [explanation]"  
  "**Your next move:** [action]"
- End with encouragement or offer more help: "Let me know if you need anything else!"
- NAVIGATION ACTIONS: If you suggest a specific page, append a navigation action like <<Button Label|/url>>
  Example: "You can create a new request here. <<Create Request|/dealer/new-request>>"
"""
        
        role_specific = self._get_role_specific_prompt(role, context)
        
        return base_prompt + "\n\n" + role_specific
    
    def _get_role_specific_prompt(self, role: str, context: dict) -> str:
        """Get role-specific instructions and context"""
        
        prompts = {
            'ADMIN': f"""
YOUR ROLE CONTEXT: System Administrator

QUICK LINKS (Use ONLY these exact paths):
- User Management (Add/Edit): /admin/users
- Warehouse Config (Add/Edit): /admin/warehouses
- System Settings: /admin/settings

YOU CAN SEE:
- System statistics and configuration
- User accounts and setup status
- Warehouse and supplier records
- Overall system health

YOU CANNOT SEE/REVEAL:
- Active order details
- Specific warehouse operations
- Procurement decisions in progress
- Delivery tracking specifics

CURRENT CONTEXT:
{context.get('details', 'System ready for use.')}

BEHAVIOR:
- Help with system setup and configuration questions
- Explain system rules and thresholds
- Alert about missing configurations
- Guide on user and entity management
""",
            
            'DEALER': f"""
YOUR ROLE CONTEXT: Dealer (Customer)

QUICK LINKS (Use ONLY these exact paths):
- Create Request: /dealer/new-request
- My Orders: /dealer/requests
- Track Shipment: /dealer/tracking

YOU CAN SEE:
- Status of dealer's own orders only
- Delivery estimates and tracking
- Order history

YOU CANNOT SEE/REVEAL:
- Which warehouses stock is coming from
- Internal warehouse delays or issues
- AI inspection scores or damage details
- Procurement decisions or supplier names
- Stock levels at any warehouse

CURRENT CONTEXT:
{context.get('details', 'No active orders.')}

BEHAVIOR:
- Explain order status in simple terms like "Your order is being prepared"
- Give realistic delivery expectations without internal details
- Reassure about quality checks without specifics
- Never say "warehouse X is delayed" - say "we're working on your order"
""",
            
            'WAREHOUSE_OPERATOR': f"""
YOUR ROLE CONTEXT: Warehouse Operator at {context.get('warehouse_name', 'assigned warehouse')}

QUICK LINKS (Use ONLY these exact paths):
- Pending Tasks: /warehouse/pick-tasks
- Upload Inspection: /warehouse/upload
- Completed Tasks: /warehouse/completed

YOU CAN SEE:
- Pick tasks assigned to YOUR warehouse only
- Inspection results for items you handle
- Your completed tasks

YOU CANNOT SEE/REVEAL:
- Other warehouses' tasks or stock
- Who the dealer is
- Import/supplier operations
- Procurement decisions
- Overall system statistics

CURRENT CONTEXT:
{context.get('details', 'No pending tasks.')}

BEHAVIOR:
- Explain why a task is pending or what's needed
- Guide on how to take better photos for inspection
- Confirm when work is complete
- Explain if system is waiting for other steps (without revealing other warehouses)
""",
            
            'PROCUREMENT_MANAGER': f"""
YOUR ROLE CONTEXT: Procurement Manager

QUICK LINKS (Use ONLY these exact paths):
- Approval Queue: /procurement/pending
- Issue Resolution: /procurement/issues
- Resolved Items: /procurement/resolved

YOU CAN SEE:
- Requests needing procurement decisions
- AI inspection findings and confidence scores
- Blocked/damaged items needing resolution
- Import approval requests
- Replacement options from all sources

YOU CANNOT SEE/REVEAL:
- Specific warehouse operations or delays
- Logistics planning details
- System configuration

CURRENT CONTEXT:
{context.get('details', 'No pending decisions.')}

BEHAVIOR:
- Summarize pending issues clearly
- Explain AI findings in plain language
- List resolution options with pros/cons
- Act as a decision-support advisor
- Never auto-approve or make decisions - only advise
""",
            
            'LOGISTICS_PLANNER': f"""
YOUR ROLE CONTEXT: Logistics Planner

QUICK LINKS (Use ONLY these exact paths):
- Pending Allocations: /logistics/allocations
- Shipment Tracking: /logistics/shipments
- Delivery Schedule: /logistics/delivery

YOU CAN SEE:
- Requests that are FULLY ready for allocation
- Shipment planning and tracking
- Delivery routes and status

YOU CANNOT SEE/REVEAL:
- Why items were blocked during inspection
- AI confidence scores or damage details
- Procurement decisions or import sources
- Warehouse-level operations

CURRENT CONTEXT:
{context.get('details', 'No shipments pending.')}

BEHAVIOR:
- Explain why logistics is waiting (without internal details)
- Confirm when items are ready for planning
- Suggest efficient routes or warn about risks
- Track shipment progress
"""
        }
        
        return prompts.get(role, prompts['DEALER'])
    
    def _build_context(self, user: User) -> dict:
        """Build role-appropriate context from database"""
        
        role = user.role.value
        context = {'role': role, 'summary': '', 'details': ''}
        
        try:
            if role == 'ADMIN':
                context = self._build_admin_context()
            elif role == 'DEALER':
                context = self._build_dealer_context(user)
            elif role == 'WAREHOUSE_OPERATOR':
                context = self._build_warehouse_context(user)
            elif role == 'PROCUREMENT_MANAGER':
                context = self._build_procurement_context()
            elif role == 'LOGISTICS_PLANNER':
                context = self._build_logistics_context()
        except Exception as e:
            context['details'] = f"Unable to load context: {str(e)}"
        
        return context
    
    def _build_admin_context(self) -> dict:
        """Build context for admin role"""
        user_count = User.query.count()
        warehouse_count = Warehouse.query.filter_by(is_active=True).count()
        supplier_count = Supplier.query.filter_by(is_active=True).count()
        
        return {
            'role': 'ADMIN',
            'summary': f'{user_count} users, {warehouse_count} warehouses, {supplier_count} suppliers',
            'details': f"""System Overview:
- Total Users: {user_count}
- Active Warehouses: {warehouse_count}
- Active Suppliers: {supplier_count}
- System Status: Operational"""
        }
    
    def _build_dealer_context(self, user: User) -> dict:
        """Build context for dealer role - only their orders"""
        requests = ProductRequest.query.filter_by(dealer_id=user.id).order_by(
            ProductRequest.created_at.desc()
        ).limit(5).all()
        
        if not requests:
            return {
                'role': 'DEALER',
                'summary': 'No orders',
                'details': 'You have no orders yet. You can create a new product request anytime.'
            }
        
        # Simplified status for dealer
        status_map = {
            'PENDING': 'Processing your request',
            'AWAITING_RECOMMENDATION': 'Checking availability',
            'AWAITING_PROCUREMENT_APPROVAL': 'Under review',
            'RESERVED': 'Order confirmed, preparing',
            'PICKING': 'Being prepared',
            'INSPECTION_PENDING': 'Quality check in progress',
            'PARTIALLY_BLOCKED': 'Under review',
            'BLOCKED': 'Under review',
            'READY_FOR_ALLOCATION': 'Almost ready to ship',
            'ALLOCATED': 'Ready for delivery',
            'IN_TRANSIT': 'On the way',
            'COMPLETED': 'Delivered'
        }
        
        order_summaries = []
        for req in requests:
            status_text = status_map.get(req.status.value, 'In progress')
            order_summaries.append(f"- Order #{req.request_number}: {status_text}")
        
        return {
            'role': 'DEALER',
            'summary': f'{len(requests)} recent orders',
            'details': f"Your Recent Orders:\n" + "\n".join(order_summaries)
        }
    
    def _build_warehouse_context(self, user: User) -> dict:
        """Build context for warehouse operator - only their warehouse"""
        if not user.assigned_warehouse_id:
            return {
                'role': 'WAREHOUSE_OPERATOR',
                'warehouse_name': 'Unassigned',
                'summary': 'No warehouse assigned',
                'details': 'You are not assigned to any warehouse. Please contact admin.'
            }
        
        warehouse = Warehouse.query.get(user.assigned_warehouse_id)
        
        # Get pending pick tasks for this warehouse
        pending_picks = Reservation.query.filter_by(
            warehouse_id=user.assigned_warehouse_id,
            is_picked=False,
            is_blocked=False
        ).count()
        
        return {
            'role': 'WAREHOUSE_OPERATOR',
            'warehouse_name': warehouse.name if warehouse else 'Unknown',
            'summary': f'{pending_picks} tasks pending',
            'details': f"""Your Warehouse: {warehouse.name if warehouse else 'Unknown'}
Location: {warehouse.city if warehouse else 'Unknown'}
Pending Pick Tasks: {pending_picks}"""
        }
    
    def _build_procurement_context(self) -> dict:
        """Build context for procurement manager"""
        # Get requests needing attention
        pending_approval = ProductRequest.query.filter_by(
            status=RequestStatus.AWAITING_PROCUREMENT_APPROVAL
        ).count()
        
        blocked = ProductRequest.query.filter(
            ProductRequest.status.in_([RequestStatus.PARTIALLY_BLOCKED, RequestStatus.BLOCKED])
        ).count()
        
        return {
            'role': 'PROCUREMENT_MANAGER',
            'summary': f'{pending_approval} approvals, {blocked} issues',
            'details': f"""Pending Decisions:
- Awaiting Approval: {pending_approval}
- Blocked/Issues: {blocked}

Use the Pending Approvals page to review and resolve these items."""
        }
    
    def _build_logistics_context(self) -> dict:
        """Build context for logistics planner"""
        ready_for_allocation = ProductRequest.query.filter_by(
            status=RequestStatus.READY_FOR_ALLOCATION
        ).count()
        
        in_transit = Shipment.query.filter(
            Shipment.status.in_(['DISPATCHED', 'IN_TRANSIT'])
        ).count()
        
        return {
            'role': 'LOGISTICS_PLANNER',
            'summary': f'{ready_for_allocation} ready to ship, {in_transit} in transit',
            'details': f"""Logistics Overview:
- Ready for Allocation: {ready_for_allocation}
- Currently In Transit: {in_transit}

Go to Allocations page to create shipment plans for ready orders."""
        }
    
    def get_history(self, session_id: str) -> list:
        """Get conversation history for public API"""
        return self._get_conversation_history(session_id)

    def _get_conversation_history(self, session_id: str) -> list:
        """Get conversation history from DB"""
        msgs = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.created_at).all()
        return [{"role": msg.role, "content": EncryptionService.decrypt(msg.content)} for msg in msgs]
    
    def _add_to_history(self, session_id: str, user_message: str, ai_response: str):
        """Add message pair to history (DB)"""
        # Add user message (encrypted)
        user_msg = ChatMessage(
            session_id=session_id,
            role='user',
            content=EncryptionService.encrypt(user_message)
        )
        db.session.add(user_msg)
        
        # Add assistant message (encrypted)
        ai_msg = ChatMessage(
            session_id=session_id,
            role='assistant',
            content=EncryptionService.encrypt(ai_response)
        )
        db.session.add(ai_msg)
        
        db.session.commit()
    
    def _get_mock_response(self, user: User, message: str) -> str:
        """Generate mock response when no API key is configured"""
        role = user.role.value
        name = user.first_name
        
        greetings = {
            'ADMIN': f"Hey {name}! Great to see you! I'm Hub Buddy, your friendly assistant. I can help you with system setup, user management, and keeping everything running smoothly. What can I help you with today?",
            'DEALER': f"Hi there, {name}! Welcome back! I'm Hub Buddy, and I'm here to help you track your orders and make sure everything's going smoothly. What would you like to know?",
            'WAREHOUSE_OPERATOR': f"Hey {name}! Ready to crush it today? I'm Hub Buddy, here to help you with pick tasks, inspections, and anything warehouse-related. What do you need?",
            'PROCUREMENT_MANAGER': f"Hi {name}! Great to see you! I'm Hub Buddy, your procurement sidekick. I can help you review issues, make decisions, and keep things moving. What's on your plate?",
            'LOGISTICS_PLANNER': f"Hey {name}! Let's get those shipments rolling! I'm Hub Buddy, here to help with planning, tracking, and making deliveries happen. What can I do for you?"
        }
        
        # Simple keyword-based mock responses
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['hello', 'hi', 'hey', 'help']):
            return greetings.get(role, greetings['DEALER'])
        
        if 'status' in message_lower or 'order' in message_lower:
            if role == 'DEALER':
                return "Sure thing! Your orders are being processed and everything's on track. Want me to check on a specific order? Just give me the order number and I'll get you the details!"
            return "You got it! Let me check what's happening... Everything's looking good from what I can see! What specific info would you like?"
        
        if 'pending' in message_lower or 'task' in message_lower:
            return "Let me take a look! You can see all your pending items on the dashboard, but I'm happy to walk you through anything. What would you like to know more about?"
        
        if any(word in message_lower for word in ['thank', 'thanks', 'thx']):
            return "You're so welcome! That's what I'm here for. Don't hesitate to ask if you need anything else!"
        
        if any(word in message_lower for word in ['bye', 'goodbye', 'see you']):
            return f"Catch you later, {name}! Feel free to come back anytime. Have a great day!"
        
        return f"Great question! I'd love to help you with that. Let me see what I can find based on your role as {role.replace('_', ' ')}. Can you give me a bit more detail about what you need?"


# Singleton instance
ai_assistant_service = AIAssistantService()
