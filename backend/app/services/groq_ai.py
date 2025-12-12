import os
import base64
import json
from datetime import datetime, timedelta
from flask import current_app


class GroqAIService:
    """Service for AI-powered image inspection using Groq API"""
    
    def __init__(self):
        self.api_key = os.getenv('GROQ_API_KEY', '')
        self.model = "meta-llama/llama-4-scout-17b-16e-instruct"  # Llama 4 Scout - replacement for deprecated vision models
    
    def analyze_image(self, image_path: str, image_type: str = 'package') -> dict:
        """
        Analyze an image for damage and expiry detection using Groq AI.
        
        Args:
            image_path: Path to the image file
            image_type: Type of image - 'package', 'label', 'contents', or 'damage'
        
        Returns:
            dict with keys:
                - result: 'OK', 'DAMAGED', 'EXPIRED', 'LOW_CONFIDENCE', 'ERROR'
                - confidence: 0-100
                - damage_detected: bool
                - damage_type: str or None
                - damage_severity: 'minor', 'moderate', 'severe' or None
                - expiry_detected: bool
                - detected_expiry_date: str or None
                - is_expired: bool
                - seal_intact: bool or None
                - spoilage_detected: bool
                - raw_response: str
        """
        if not self.api_key:
            # Return mock response if no API key
            print("[GROQ DEBUG] No API key configured, using mock")
            return self._mock_analysis()
        
        try:
            print(f"[GROQ DEBUG] Using API key: {self.api_key[:10]}... Image type: {image_type}")
            from groq import Groq
            
            client = Groq(api_key=self.api_key)
            
            # Read and encode image
            with open(image_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
            
            # Determine mime type
            ext = image_path.rsplit('.', 1)[-1].lower()
            mime_types = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'webp': 'image/webp'
            }
            mime_type = mime_types.get(ext, 'image/jpeg')
            
            # Create type-specific prompt
            prompt = self._get_prompt_for_type(image_type)

            # Call Groq API
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{image_data}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1500,  # Increased for detailed response
                temperature=0.1
            )
            
            raw_response = response.choices[0].message.content
            print(f"[GROQ DEBUG] Raw response: {raw_response[:200]}...")
            
            # Parse JSON response
            try:
                # Extract JSON from response
                json_start = raw_response.find('{')
                json_end = raw_response.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = raw_response[json_start:json_end]
                    ai_result = json.loads(json_str)
                else:
                    raise ValueError("No JSON found in response")
                
                # Map to our format with enhanced logic
                result = 'OK'
                quality_grade = ai_result.get('quality_grade', 'B')
                
                # Check for critical issues first
                if ai_result.get('spoilage_detected'):
                    result = 'DAMAGED'  # Spoilage is treated as critical damage
                elif ai_result.get('is_expired'):
                    result = 'EXPIRED'
                elif ai_result.get('damage_detected') and ai_result.get('damage_severity') in ['moderate', 'severe']:
                    result = 'DAMAGED'
                elif ai_result.get('tamper_evidence'):
                    result = 'DAMAGED'  # Tampered packages are rejected
                elif quality_grade == 'F':
                    result = 'DAMAGED'
                elif ai_result.get('overall_result') in ['DAMAGED', 'SPOILED']:
                    result = 'DAMAGED'
                elif ai_result.get('overall_result') == 'NEEDS_REVIEW' or quality_grade == 'C':
                    result = 'LOW_CONFIDENCE'
                elif ai_result.get('confidence_score', 100) < 70:
                    result = 'LOW_CONFIDENCE'
                
                return {
                    'result': result,
                    'confidence': ai_result.get('confidence_score', 80),
                    'damage_detected': ai_result.get('damage_detected', False),
                    'damage_type': ai_result.get('damage_type') if ai_result.get('damage_type') != 'none' else None,
                    'damage_severity': ai_result.get('damage_severity') if ai_result.get('damage_severity') != 'none' else None,
                    'expiry_detected': ai_result.get('expiry_date_iso') is not None,
                    'detected_expiry_date': ai_result.get('expiry_date_iso'),
                    'is_expired': ai_result.get('is_expired', False),
                    'seal_intact': ai_result.get('seal_intact'),
                    'spoilage_detected': ai_result.get('spoilage_detected', False),
                    'raw_response': raw_response
                }
                
            except json.JSONDecodeError as e:
                return {
                    'result': 'LOW_CONFIDENCE',
                    'confidence': 50,
                    'damage_detected': False,
                    'damage_type': None,
                    'damage_severity': None,
                    'expiry_detected': False,
                    'detected_expiry_date': None,
                    'is_expired': False,
                    'seal_intact': None,
                    'spoilage_detected': False,
                    'raw_response': f"Parse error: {str(e)}. Response: {raw_response}"
                }
                
        except Exception as e:
            print(f"[GROQ DEBUG] Exception: {type(e).__name__}: {str(e)}")
            return {
                'result': 'ERROR',
                'confidence': 0,
                'damage_detected': False,
                'damage_type': None,
                'damage_severity': None,
                'expiry_detected': False,
                'detected_expiry_date': None,
                'is_expired': False,
                'seal_intact': None,
                'spoilage_detected': False,
                'raw_response': f"API error: {str(e)}"
            }
    
    def _get_prompt_for_type(self, image_type: str) -> str:
        """Get specialized prompt based on image type"""
        
        base_response_format = """
## RESPONSE FORMAT
Respond ONLY with valid JSON (no markdown, no extra text):
{
    "damage_detected": true/false,
    "damage_type": "none" or specific type (tear, dent, puncture, water_damage, crushing, scratch, crack),
    "damage_severity": "none", "minor", "moderate", or "severe",
    "damage_location": "description of where damage is located or null",
    "seal_intact": true/false/null,
    "tamper_evidence": true/false,
    "spoilage_detected": true/false,
    "spoilage_type": "none" or type (mold, discoloration, leakage, swelling),
    "expiry_date_text": "extracted text exactly as shown or null",
    "expiry_date_iso": "YYYY-MM-DD format or null",
    "is_expired": true/false/null,
    "days_until_expiry": number or null,
    "batch_number": "extracted batch/lot number or null",
    "overall_result": "OK", "DAMAGED", "EXPIRED", "SPOILED", or "NEEDS_REVIEW",
    "confidence_score": 0-100,
    "quality_grade": "A" (perfect), "B" (minor issues), "C" (significant issues), "F" (reject),
    "explanation": "detailed explanation of all findings"
}"""
        
        if image_type == 'label':
            return f"""You are an expert OCR and label inspector. This image shows a product LABEL. Focus on extracting and analyzing text information.

## PRIMARY FOCUS: LABEL ANALYSIS

### 1. DATE EXTRACTION (CRITICAL)
Use OCR to carefully read and extract:
- **Expiry Date / Best Before / Use By**: Look for dates in any format (DD/MM/YYYY, MM-DD-YY, etc.)
- **Manufacturing Date / Production Date**: When was this product made?
- **Pack Date**: When was it packaged?

### 2. BATCH & TRACKING INFORMATION
Extract:
- Batch number / Lot number (often starts with "LOT", "BATCH", "L:")
- Serial number
- Production line code
- Country of origin

### 3. STORAGE INSTRUCTIONS
Look for:
- Temperature requirements (e.g., "Keep refrigerated", "Store below 25°C")
- Handling instructions (e.g., "Keep dry", "Protect from sunlight")
- Storage conditions

### 4. PRODUCT INFORMATION
- Product name and variant
- Net weight / Volume
- Ingredients (if visible)
- Nutritional information presence

### 5. LABEL CONDITION
- Is the label legible and readable?
- Any damage, fading, or smudging?
- Is the label properly attached?
{base_response_format}"""
        
        elif image_type == 'contents':
            return f"""You are an expert product quality inspector. This image shows the CONTENTS of a product package. Focus on inspecting the actual product inside.

## PRIMARY FOCUS: PRODUCT CONTENTS INSPECTION

### 1. PRODUCT CONDITION (CRITICAL)
Examine the actual product for:
- **Freshness**: Does it look fresh and properly preserved?
- **Color**: Is the color normal or abnormal (discoloration, darkening, fading)?
- **Texture**: Does the surface appear normal?
- **Shape**: Is the product properly formed or deformed?

### 2. SPOILAGE DETECTION (CRITICAL)
Look carefully for signs of:
- **Mold/Fungus**: Any fuzzy growth, spots, or patches
- **Rot/Decay**: Soft spots, browning, or decomposition
- **Contamination**: Foreign objects, insects, debris
- **Freezer burn**: Ice crystals, dry patches (for frozen items)
- **Separation**: Liquid separation, curdling

### 3. QUANTITY & COMPLETENESS
- Does the quantity appear correct?
- Any missing pieces or incomplete product?
- Are all components present?

### 4. PACKAGING RESIDUE
- Any packaging material stuck to product?
- Contamination from packaging?

### 5. OVERALL PRODUCT QUALITY
Would you confidently consume/use this product?
{base_response_format}"""
        
        elif image_type == 'damage':
            return f"""You are an expert damage assessment specialist. This image specifically documents DAMAGE to a product or package. Perform detailed damage analysis.

## PRIMARY FOCUS: DAMAGE DOCUMENTATION

### 1. DAMAGE TYPE IDENTIFICATION (CRITICAL)
Identify ALL visible damage types:
- **STRUCTURAL**: Tears, rips, punctures, holes, breaks, cracks
- **COMPRESSION**: Dents, crushing, flattening, deformation
- **IMPACT**: Shattered areas, impact marks, collision damage
- **MOISTURE**: Water stains, wet damage, warping, swelling
- **HANDLING**: Scratches, scuffs, abrasions, rough handling marks
- **THERMAL**: Burn marks, melting, freezing damage

### 2. DAMAGE SEVERITY ASSESSMENT (CRITICAL)
Rate the damage severity:
- **MINOR**: Cosmetic only, product integrity intact
- **MODERATE**: Some compromise to protection, product may be affected
- **SEVERE**: Significant damage, product likely compromised

### 3. DAMAGE LOCATION & EXTENT
- Precisely describe WHERE the damage is located
- Estimate the SIZE/AREA affected (e.g., "2cm tear on top corner")
- Is damage localized or widespread?

### 4. PRODUCT IMPACT ASSESSMENT
- Has the damage compromised the seal/barrier?
- Could contents be contaminated?
- Is the product still safe to use/consume?

### 5. CAUSE ANALYSIS
What likely caused this damage?
- Shipping/transit damage
- Handling damage
- Manufacturing defect
- Storage conditions
{base_response_format}"""
        
        else:  # 'package' or default
            return f"""You are an expert quality control inspector analyzing a product PACKAGE image. Perform a thorough inspection focusing on packaging integrity.

## PRIMARY FOCUS: PACKAGE INSPECTION

### 1. PHYSICAL DAMAGE ASSESSMENT
Carefully examine the entire package for:
- **Structural damage**: Tears, rips, punctures, holes, or cuts in packaging material
- **Compression damage**: Dents, crushing, deformation, or flattening
- **Impact damage**: Cracks, breaks, or shattered areas
- **Moisture damage**: Water stains, wet spots, warping, bubbling, or swelling
- **Handling damage**: Scratches, scuffs, abrasions, or rough handling marks
- **Corner/edge damage**: Bent corners, frayed edges, or worn areas

### 2. SEAL & TAMPER INSPECTION (CRITICAL)
Check security features:
- Is the seal/closure intact and properly closed?
- Any signs of opening, resealing, or tampering?
- Are shrink wraps, security labels, or bands in place?
- Is vacuum seal (if applicable) still holding?

### 3. CONTAMINATION INDICATORS
Look for signs of:
- Product leakage visible on outside
- Staining or residue
- Bloating or swelling (gas buildup inside)
- Foreign substances on package

### 4. LABEL VISIBILITY
Quick check:
- Is any expiry date visible? Extract it if yes.
- Is the batch number visible? Extract it if yes.
- Is the label intact and readable?

### 5. OVERALL PACKAGE CONDITION
Consider: Would this package be acceptable for retail display?
{base_response_format}"""
    
    def _mock_analysis(self) -> dict:
        """Return mock analysis when no API key is configured"""
        import random
        
        # Randomly generate result for testing
        result_options = ['OK', 'OK', 'OK', 'DAMAGED', 'LOW_CONFIDENCE']
        result = random.choice(result_options)
        
        mock = {
            'result': result,
            'confidence': random.randint(75, 98) if result == 'OK' else random.randint(55, 85),
            'damage_detected': result == 'DAMAGED',
            'damage_type': 'minor_dent' if result == 'DAMAGED' else None,
            'damage_severity': 'minor' if result == 'DAMAGED' else None,
            'expiry_detected': True,
            'detected_expiry_date': (datetime.now() + timedelta(days=random.randint(30, 365))).strftime('%Y-%m-%d'),
            'is_expired': False,
            'seal_intact': True,
            'spoilage_detected': False,
            'raw_response': 'MOCK_RESPONSE: No Groq API key configured'
        }
        
        return mock
