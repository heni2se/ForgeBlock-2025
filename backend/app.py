"""
ForgeBlock Signature Verification Backend
FastAPI for signature comparison using Siamese Network

Endpoints:
- POST /api/compare-signatures: Compare two uploaded signatures
- GET /api/dataset/list: List available signatures from test/validation datasets
- POST /api/compare-from-dataset: Compare signatures from dataset paths
- GET /api/test-users: List test users with their genuine signatures
- GET /api/test-users/{user_id}/signatures: Get genuine signatures for a specific test user
- POST /api/verify-signature: Verify uploaded signature against a user's genuine signatures
- GET /api/enrolled-users: List enrolled users with adaptive thresholds
- POST /api/enroll-user: Enroll a new user with 5+ signatures
- GET /api/thresholds: Get current threshold values (default or adaptive)
- GET /health: Health check endpoint
"""

import os
import json
import numpy as np
import cv2
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.layers import Layer
from scipy.spatial.distance import cosine, euclidean, cityblock
from itertools import combinations
import uvicorn

# ============================================
# CONFIGURATION
# ============================================

DATASET_PATHS = {
    "training": "../dataset/00 Training",
    "validation": "../dataset/01 Validation",
    "testing": "../dataset/02 Testing"
}

MODEL_PATH = "../FinishLine/embedding_signet.keras"

THRESHOLDS_FILE = "../FinishLine/thresholds_signet_validation.json"

EMBEDDINGS_DIR = "../embeddings"

ENROLL_DIR = "../enrolled_users"
os.makedirs(ENROLL_DIR, exist_ok=True)

# Default thresholds (will be overridden if JSON exists)
DEFAULT_THRESHOLDS = {
    "cosine_threshold": 0.9134632349014282,
    "euclidean_threshold": 0.40666562550682195,
    "manhattan_threshold": 5.26983118057251
}

THRESHOLDS = DEFAULT_THRESHOLDS.copy()

if os.path.exists(THRESHOLDS_FILE):
    try:
        with open(THRESHOLDS_FILE, 'r') as f:
            loaded_thresholds = json.load(f)
            THRESHOLDS.update(loaded_thresholds)
            DEFAULT_THRESHOLDS.update(loaded_thresholds)
            print(f"✅ Loaded thresholds from: {THRESHOLDS_FILE}")
    except Exception as e:
        print(f"⚠️ Could not load thresholds file: {e}")
        print(f"Using default thresholds: {THRESHOLDS}")

IMG_SIZE = (224, 224)

# ============================================
# CUSTOM LAYER DEFINITION
# ============================================

class L2NormalizationLayer(Layer):
    """Custom L2 normalization layer for the embedding model."""
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def call(self, inputs):
        return tf.nn.l2_normalize(inputs, axis=-1)
    
    def get_config(self):
        return super().get_config()

# ============================================
# INITIALIZE FASTAPI APP
# ============================================

app = FastAPI(
    title="ForgeBlock Signature Verification API",
    description="API for comparing and verifying signatures using a Siamese Network",
    version="1.0.0"
)

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
embedding_model = None

def load_embedding_model():
    """Load the embedding model with custom objects."""
    global embedding_model
    if embedding_model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model not found at: {MODEL_PATH}")
        print(f"Loading model from: {MODEL_PATH}")
        embedding_model = load_model(
            MODEL_PATH,
            custom_objects={"L2NormalizationLayer": L2NormalizationLayer}
        )
        print("Model loaded successfully!")
    return embedding_model

# ============================================
# PYDANTIC MODELS
# ============================================

class DatasetCompareRequest(BaseModel):
    """Request body for comparing signatures from dataset paths."""
    signature1_path: str
    signature2_path: str

class SignatureFile(BaseModel):
    """Represents a signature file in the dataset."""
    filename: str
    path: str
    category: str
    dataset: str

class CompareResponse(BaseModel):
    """Response for signature comparison."""
    matchPercentage: float
    features: dict
    verdict: str

class TestUserSignature(BaseModel):
    """Represents a genuine signature for a test user."""
    filename: str
    path: str
    
class TestUser(BaseModel):
    """Represents a test user with their genuine signatures."""
    user_id: str
    display_name: str
    genuine_count: int
    signatures: List[TestUserSignature]

# ============================================
# IMAGE PREPROCESSING
# ============================================

def preprocess_signature_image(img_input, img_size=IMG_SIZE):
    """
    Preprocess signature image for the model.
    Matches preprocessing from notebook exactly.
    
    Args:
        img_input: Image bytes, numpy array, or file path string
        img_size: Target size tuple (height, width)
    
    Returns:
        Preprocessed image array ready for model input
    """
    # Handle different input types
    if isinstance(img_input, str):
        img = cv2.imread(img_input)
        if img is None:
            raise ValueError(f"Failed to read image from path: {img_input}")
    elif isinstance(img_input, bytes):
        nparr = np.frombuffer(img_input, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image bytes")
    else:
        img = img_input

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Background normalization
    gray_blur = cv2.GaussianBlur(gray, (31, 31), 0)
    corrected = cv2.divide(gray, gray_blur, scale=255)
    
    # CLAHE for contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(corrected)
    
    # High-pass filtering for sharpening
    highpass = cv2.subtract(enhanced, cv2.GaussianBlur(enhanced, (9, 9), 0))
    sharpened = cv2.addWeighted(enhanced, 0.8, highpass, 0.5, 0)
    
    # Thresholding and contour detection
    _, thresh = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Crop to signature region with padding
    if contours:
        pts = np.vstack(contours)
        x, y, w, h = cv2.boundingRect(pts)
        pad = 0.12
        x1 = max(0, int(x - w * pad))
        y1 = max(0, int(y - h * pad))
        x2 = min(gray.shape[1], int(x + w * (1 + pad)))
        y2 = min(gray.shape[0], int(y + h * (1 + pad)))
        cropped = img[y1:y2, x1:x2]
    else:
        cropped = img
    
    # Resize and convert to RGB
    resized = cv2.resize(cropped, img_size)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    
    # Normalize to [-1, 1] range (MobileNetV2 preprocessing)
    cnn_ready = rgb.astype(np.float32)
    cnn_ready = (cnn_ready - 127.5) / 127.5
    
    return cnn_ready

def compute_embedding(img_array, model):
    """
    Compute the embedding vector for a signature image.
    Manually apply L2 normalization to match notebook exactly.
    
    Args:
        img_array: Preprocessed image array
        model: Loaded embedding model
    
    Returns:
        L2-normalized embedding vector
    """
    img_batch = np.expand_dims(img_array, axis=0)
    emb = model.predict(img_batch, verbose=0)[0]
    emb = emb / (np.linalg.norm(emb) + 1e-12)
    return emb

# ============================================
# SIMILARITY COMPUTATION - EXACTLY FROM NOTEBOOK
# ============================================

def compute_similarity_metrics(emb1, emb2):
    """
    Compute the 3 core metrics from the notebook:
    1. Cosine Similarity: 1 - cosine_distance (higher = match)
    2. Euclidean Distance: euclidean (lower = match)
    3. Manhattan Distance: cityblock (lower = match)
    
    These MUST match the notebook's verification GUI output exactly.
    """
    
    cos_sim = float(1 - cosine(emb1, emb2))
    euc_dist = float(euclidean(emb1, emb2))
    man_dist = float(cityblock(emb1, emb2))
    
    return {
        "cosineSimilarity": round(cos_sim, 4),
        "euclideanDistance": round(euc_dist, 4),
        "manhattanDistance": round(man_dist, 4)
    }

def compute_match_percentage(features, thresholds=None):
    """
    Compute match percentage based on how well metrics perform relative to thresholds.
    This ensures the percentage aligns with the verdict (genuine/forged).
    
    For each metric:
    - If passing threshold: score = 50 + (how much it exceeds threshold) * 50
    - If failing threshold: score = (how close to threshold) * 50
    
    This way:
    - All 3 passing = 75-100%
    - 2 passing (genuine verdict) = 50-75%  
    - 1 passing (forged verdict) = 25-50%
    - 0 passing = 0-25%
    """
    if thresholds is None:
        thresholds = THRESHOLDS
    
    cos_sim = features["cosineSimilarity"]
    euc_dist = features["euclideanDistance"]
    man_dist = features["manhattanDistance"]
    
    cos_thresh = thresholds.get("cosine_threshold", thresholds.get("cosine", 0.85))
    euc_thresh = thresholds.get("euclidean_threshold", thresholds.get("euclidean", 0.80))
    man_thresh = thresholds.get("manhattan_threshold", thresholds.get("manhattan", 1.50))
    
    # Cosine: higher is better, threshold is minimum for genuine
    if cos_sim >= cos_thresh:
        excess = (cos_sim - cos_thresh) / (1.0 - cos_thresh) if cos_thresh < 1.0 else 1.0
        cos_score = 50 + excess * 50
    else:
        cos_score = (cos_sim / cos_thresh) * 50 if cos_thresh > 0 else 0
    
    # Euclidean: lower is better, threshold is maximum for genuine
    if euc_dist <= euc_thresh:
        closeness = 1 - (euc_dist / euc_thresh) if euc_thresh > 0 else 1.0
        euc_score = 50 + closeness * 50
    else:
        max_bad = euc_thresh * 2
        if euc_dist >= max_bad:
            euc_score = 0
        else:
            euc_score = (1 - (euc_dist - euc_thresh) / euc_thresh) * 50
    
    # Manhattan: lower is better, threshold is maximum for genuine
    if man_dist <= man_thresh:
        closeness = 1 - (man_dist / man_thresh) if man_thresh > 0 else 1.0
        man_score = 50 + closeness * 50
    else:
        max_bad = man_thresh * 2
        if man_dist >= max_bad:
            man_score = 0
        else:
            man_score = (1 - (man_dist - man_thresh) / man_thresh) * 50
    
    match_percentage = (cos_score + euc_score + man_score) / 3.0
    
    return round(float(min(100, max(0, match_percentage))), 2)

def determine_verdict(features):
    """
    Majority voting using the 3 metrics from notebook:
    
    - Cosine similarity: vote = (score >= threshold)
    - Euclidean distance: vote = (score <= threshold)
    - Manhattan distance: vote = (score <= threshold)
    
    Final verdict: 2+ votes = "genuine", else "forged"
    """
    
    cos_sim = features["cosineSimilarity"]
    euc_dist = features["euclideanDistance"]
    man_dist = features["manhattanDistance"]
    
    cos_vote = 1 if cos_sim >= THRESHOLDS["cosine_threshold"] else 0
    euc_vote = 1 if euc_dist <= THRESHOLDS["euclidean_threshold"] else 0
    man_vote = 1 if man_dist <= THRESHOLDS["manhattan_threshold"] else 0
    
    total_votes = cos_vote + euc_vote + man_vote
    
    # Majority voting: 2 or more votes = genuine
    if total_votes >= 2:
        return "genuine"
    else:
        return "forged"

def compare_two_signatures(img1_input, img2_input):
    """
    Core comparison logic for two signature inputs.
    Results MUST match notebook verification GUI exactly.
    
    Args:
        img1_input: First signature (bytes or file path)
        img2_input: Second signature (bytes or file path)
    
    Returns:
        Dictionary with matchPercentage, features, and verdict
    """
    model = load_embedding_model()
    
    # Preprocess images
    img1_processed = preprocess_signature_image(img1_input)
    img2_processed = preprocess_signature_image(img2_input)
    
    # Compute embeddings
    emb1 = compute_embedding(img1_processed, model)
    emb2 = compute_embedding(img2_processed, model)
    
    # Compute the 3 core metrics
    features = compute_similarity_metrics(emb1, emb2)
    match_percentage = compute_match_percentage(features)
    verdict = determine_verdict(features)
    
    return {
        "matchPercentage": float(match_percentage),
        "features": {
            "cosineSimilarity": float(features["cosineSimilarity"]),
            "euclideanDistance": float(features["euclideanDistance"]),
            "manhattanDistance": float(features["manhattanDistance"])
        },
        "verdict": str(verdict)
    }

# ============================================
# ENROLLED USER FUNCTIONS
# ============================================

def get_enrolled_users(account_email: str = None):
    """
    Get all enrolled users with their adaptive thresholds.
    
    Args:
        account_email: Optional email to filter enrolled users by account
    
    Returns list of enrolled users.
    """
    users = []
    
    if not os.path.exists(ENROLL_DIR):
        return users
    
    for user_folder in sorted(os.listdir(ENROLL_DIR)):
        user_path = os.path.join(ENROLL_DIR, user_folder)
        if not os.path.isdir(user_path):
            continue
        
        # Check for thresholds file
        thresholds_path = os.path.join(user_path, "thresholds.json")
        embeddings_path = os.path.join(user_path, "embeddings.npy")
        account_info_path = os.path.join(user_path, "account_info.json")
        
        if account_email:
            if os.path.exists(account_info_path):
                try:
                    with open(account_info_path, 'r') as f:
                        account_info = json.load(f)
                    if account_info.get("account_email") != account_email:
                        continue  # Skip this user, belongs to different account
                except Exception:
                    continue  # Skip if can't read account info
            else:
                continue  # Skip users without account info when filtering
        
        # Get signature files
        signatures = []
        for filename in sorted(os.listdir(user_path)):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                signatures.append({
                    "filename": filename,
                    "path": os.path.join(user_path, filename)
                })
        
        # Load adaptive thresholds if available
        adaptive_thresholds = None
        if os.path.exists(thresholds_path):
            try:
                with open(thresholds_path, 'r') as f:
                    adaptive_thresholds = json.load(f)
            except Exception as e:
                print(f"Warning: Could not load thresholds for {user_folder}: {e}")
        
        if signatures:
            users.append({
                "user_id": user_folder,
                "display_name": user_folder.replace("_", " "),
                "signature_count": len(signatures),
                "signatures": signatures,
                "has_adaptive_threshold": adaptive_thresholds is not None,
                "adaptive_thresholds": adaptive_thresholds,
                "has_embeddings": os.path.exists(embeddings_path)
            })
    
    return users


def compute_adaptive_thresholds(embeddings_array):
    """
    Compute adaptive thresholds based on intra-user signature comparisons.
    Uses mean +/- 1.5*std for more lenient thresholds.
    
    Args:
        embeddings_array: numpy array of shape (n_signatures, embedding_dim)
    
    Returns:
        Dictionary with cosine, euclidean, manhattan thresholds
    """
    cos_distances = []
    euc_distances = []
    man_distances = []
    
    for emb1, emb2 in combinations(embeddings_array, 2):
        cos_distances.append(1 - cosine(emb1, emb2))  # similarity
        euc_distances.append(euclidean(emb1, emb2))
        man_distances.append(cityblock(emb1, emb2))
    
    thr_cos_val = np.mean(cos_distances) - 1.5 * np.std(cos_distances)
    thr_eu_val = np.mean(euc_distances) + 1.5 * np.std(euc_distances)
    thr_man_val = np.mean(man_distances) + 1.5 * np.std(man_distances)
    
    return {
        "cosine": float(thr_cos_val),
        "euclidean": float(thr_eu_val),
        "manhattan": float(thr_man_val)
    }


def verify_with_adaptive_threshold(uploaded_bytes, enrolled_user_path, reference_signature_path=None, use_default_threshold=False):
    """
    Verify an uploaded signature against an enrolled user using adaptive thresholds.
    
    Args:
        uploaded_bytes: Image bytes of the signature to verify
        enrolled_user_path: Path to the enrolled user's folder
        reference_signature_path: Optional specific signature path for 1:1 comparison
        use_default_threshold: If True, use default thresholds instead of adaptive
    
    Returns:
        Dictionary with verification results
    """
    # Load thresholds
    thresholds_file = os.path.join(enrolled_user_path, "thresholds.json")
    
    if use_default_threshold or not os.path.exists(thresholds_file):
        thresholds = DEFAULT_THRESHOLDS.copy()
        threshold_type = "default"
    else:
        with open(thresholds_file, 'r') as f:
            thresholds = json.load(f)
        threshold_type = "adaptive"
    
    model = load_embedding_model()
    
    # Preprocess and embed uploaded signature
    uploaded_processed = preprocess_signature_image(uploaded_bytes)
    uploaded_emb = compute_embedding(uploaded_processed, model)
    
    if reference_signature_path and os.path.exists(reference_signature_path):
        # Load and embed the specific reference signature
        with open(reference_signature_path, 'rb') as f:
            ref_bytes = f.read()
        ref_processed = preprocess_signature_image(ref_bytes)
        ref_emb = compute_embedding(ref_processed, model)
        
        # Compute metrics for 1:1 comparison
        cos_sim = float(1 - cosine(uploaded_emb, ref_emb))
        euc_dist = float(euclidean(uploaded_emb, ref_emb))
        man_dist = float(cityblock(uploaded_emb, ref_emb))
        
        features = {
            "cosineSimilarity": round(cos_sim, 4),
            "euclideanDistance": round(euc_dist, 4),
            "manhattanDistance": round(man_dist, 4)
        }
        comparisons_count = 1
    else:
        # Compare against all enrolled signatures (original behavior)
        embeddings_path = os.path.join(enrolled_user_path, "embeddings.npy")
        if not os.path.exists(embeddings_path):
            raise ValueError("User embeddings not found. Please re-enroll.")
        
        enrolled_embeddings = np.load(embeddings_path)
        
        all_cos = []
        all_euc = []
        all_man = []
        
        for enrolled_emb in enrolled_embeddings:
            cos_sim = float(1 - cosine(uploaded_emb, enrolled_emb))
            euc_dist = float(euclidean(uploaded_emb, enrolled_emb))
            man_dist = float(cityblock(uploaded_emb, enrolled_emb))
            
            all_cos.append(cos_sim)
            all_euc.append(euc_dist)
            all_man.append(man_dist)
        
        features = {
            "cosineSimilarity": round(float(np.mean(all_cos)), 4),
            "euclideanDistance": round(float(np.mean(all_euc)), 4),
            "manhattanDistance": round(float(np.mean(all_man)), 4)
        }
        comparisons_count = len(enrolled_embeddings)
    
    # Get threshold values with fallback for both key formats
    cos_threshold = thresholds.get("cosine_threshold", thresholds.get("cosine", 0.85))
    euc_threshold = thresholds.get("euclidean_threshold", thresholds.get("euclidean", 0.8))
    man_threshold = thresholds.get("manhattan_threshold", thresholds.get("manhattan", 1.5))
    
    # Determine verdict using thresholds
    cos_vote = 1 if features["cosineSimilarity"] >= cos_threshold else 0
    euc_vote = 1 if features["euclideanDistance"] <= euc_threshold else 0
    man_vote = 1 if features["manhattanDistance"] <= man_threshold else 0
    
    total_votes = cos_vote + euc_vote + man_vote
    verdict = "genuine" if total_votes >= 2 else "forged"
    
    match_percentage = compute_match_percentage(features, thresholds)
    
    return {
        "matchPercentage": float(match_percentage),
        "features": features,
        "verdict": str(verdict),
        "thresholds_used": {
            "cosine": round(float(cos_threshold), 4),
            "euclidean": round(float(euc_threshold), 4),
            "manhattan": round(float(man_threshold), 4)
        },
        "threshold_type": threshold_type,
        "comparisons_count": comparisons_count,
        "comparison_mode": "1:1" if (reference_signature_path and os.path.exists(reference_signature_path)) else "all"
    }

# ============================================
# API ENDPOINTS
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": embedding_model is not None,
        "default_thresholds": DEFAULT_THRESHOLDS
    }

@app.get("/api/dataset/list")
async def list_dataset_signatures():
    """
    Lists all available signatures from training, validation, and testing datasets.
    """
    result = {
        "training": {"genuine": [], "forged": []},
        "validation": {"genuine": [], "forged": []},
        "testing": {"genuine": [], "forged": []}
    }
    
    for dataset_name, base_path in DATASET_PATHS.items():
        if os.path.exists(base_path):
            # Navigate through user folders in dataset
            for user_folder in sorted(os.listdir(base_path)):
                user_path = os.path.join(base_path, user_folder)
                if not os.path.isdir(user_path):
                    continue
                
                # Look for genuine and forged subfolders
                for category in ["genuine", "forged"]:
                    category_path = os.path.join(user_path, category)
                    if os.path.exists(category_path):
                        files = [f for f in os.listdir(category_path)
                                if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
                        for filename in sorted(files):
                            file_path = os.path.join(category_path, filename)
                            result[dataset_name][category].append({
                                "filename": filename,
                                "path": file_path,
                                "user": user_folder,
                                "category": category,
                                "dataset": dataset_name
                            })
        else:
            print(f"Warning: Dataset path not found: {base_path}")
    
    return result

@app.get("/api/test-users")
async def get_test_users_list():
    """
    Get list of all test users with their genuine signature counts.
    Used to populate the folder dropdown in the verify page.
    """
    users = get_test_users()
    return {
        "users": users,
        "total_users": len(users)
    }

@app.get("/api/test-users/{user_id}/signatures")
async def get_user_signatures(user_id: str):
    """
    Get all genuine signatures for a specific test user.
    """
    test_path = DATASET_PATHS["testing"]
    user_path = os.path.join(test_path, user_id)
    
    if not os.path.exists(user_path):
        raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
    
    genuine_path = os.path.join(user_path, "genuine")
    signatures = []
    
    if os.path.exists(genuine_path):
        for filename in sorted(os.listdir(genuine_path)):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                signatures.append({
                    "filename": filename,
                    "path": os.path.join(genuine_path, filename)
                })
    
    return {
        "user_id": user_id,
        "signatures": signatures,
        "count": len(signatures)
    }

@app.get("/api/signature-image")
async def get_signature_image(path: str):
    """
    Serve a signature image from the dataset.
    Used to display genuine signatures in the frontend.
    """
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Image not found: {path}")
    
    # Security check: ensure path is within dataset directories
    abs_path = os.path.abspath(path)
    valid_base = False
    for dataset_path in DATASET_PATHS.values():
        if abs_path.startswith(os.path.abspath(dataset_path)):
            valid_base = True
            break
    
    if not valid_base:
        raise HTTPException(status_code=403, detail="Access denied: Path outside dataset")
    
    return FileResponse(path)

@app.post("/api/verify-signature")
async def verify_signature(
    signature: UploadFile = File(...),
    user_id: str = Form(...),
    reference_path: Optional[str] = Form(None)
):
    """
    Verify an uploaded signature against a test user's genuine signatures.
    
    Args:
        signature: Uploaded signature image to verify
        user_id: ID of the test user to verify against
        reference_path: Optional specific signature path to compare against
    
    Returns:
        Verification result with matchPercentage, features, and verdict
    """
    try:
        # Get user's genuine signatures
        test_path = DATASET_PATHS["testing"]
        user_path = os.path.join(test_path, user_id)
        
        if not os.path.exists(user_path):
            raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
        
        # Read uploaded signature
        img_bytes = await signature.read()
        
        # Debug: print received reference path
        print(f"[DEBUG] Received reference_path: {reference_path}")
        
        if reference_path:
            # Normalize the path (handle URL encoding, etc.)
            normalized_path = reference_path.strip()
            print(f"[DEBUG] Normalized path: {normalized_path}")
            print(f"[DEBUG] Path exists: {os.path.exists(normalized_path)}")
            
            if os.path.exists(normalized_path):
                # Direct 1:1 comparison - same as compare page
                result = compare_two_signatures(img_bytes, normalized_path)
                result["reference_used"] = normalized_path
                result["comparison_type"] = "single"
                result["thresholds_used"] = {
                    "cosine": float(THRESHOLDS["cosine_threshold"]),
                    "euclidean": float(THRESHOLDS["euclidean_threshold"]),
                    "manhattan": float(THRESHOLDS["manhattan_threshold"])
                }
                result["threshold_type"] = "default"
                print(f"[DEBUG] 1:1 comparison result: {result['matchPercentage']}%")
                return result
            else:
                print(f"[DEBUG] Path does not exist, falling back to multi-signature comparison")
        
        # Fallback: compare against all genuine signatures (only if no specific reference)
        genuine_path = os.path.join(user_path, "genuine")
        if not os.path.exists(genuine_path):
            raise HTTPException(status_code=404, detail=f"No genuine signatures found for user: {user_id}")
        
        genuine_files = [
            os.path.join(genuine_path, f) 
            for f in os.listdir(genuine_path) 
            if f.lower().endswith(('.png', '.jpg', '.jpeg'))
        ]
        
        if not genuine_files:
            raise HTTPException(status_code=404, detail=f"No genuine signatures found for user: {user_id}")
        
        result = verify_against_user_signatures(img_bytes, genuine_files)
        result["user_id"] = user_id
        result["comparison_type"] = "multi"
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] Error in verify_signature: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compare-signatures")
async def compare_uploaded_signatures(
    signature1: UploadFile = File(...),
    signature2: UploadFile = File(...)
):
    """
    Compare two uploaded signature images.
    
    Args:
        signature1: First signature image file
        signature2: Second signature image file
    
    Returns:
        CompareResponse with matchPercentage, features (3 metrics), and verdict
    """
    try:
        img1_bytes = await signature1.read()
        img2_bytes = await signature2.read()
        
        result = compare_two_signatures(img1_bytes, img2_bytes)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compare-from-dataset")
async def compare_dataset_signatures(request: DatasetCompareRequest):
    """
    Compare two signatures using their dataset file paths.
    
    Args:
        request: Contains signature1_path and signature2_path
    
    Returns:
        CompareResponse with matchPercentage, features (3 metrics), and verdict
    """
    try:
        if not os.path.exists(request.signature1_path):
            raise HTTPException(status_code=404, detail=f"Signature 1 not found: {request.signature1_path}")
        if not os.path.exists(request.signature2_path):
            raise HTTPException(status_code=404, detail=f"Signature 2 not found: {request.signature2_path}")
        
        result = compare_two_signatures(request.signature1_path, request.signature2_path)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compare-mixed")
async def compare_mixed_sources(
    signature1: Optional[UploadFile] = File(None),
    signature2: Optional[UploadFile] = File(None),
    signature1_path: Optional[str] = Form(None),
    signature2_path: Optional[str] = Form(None)
):
    """
    Compare signatures from mixed sources (upload OR dataset path).
    """
    try:
        if signature1 is not None:
            img1_input = await signature1.read()
        elif signature1_path is not None:
            if not os.path.exists(signature1_path):
                raise HTTPException(status_code=404, detail=f"Signature 1 path not found: {signature1_path}")
            img1_input = signature1_path
        else:
            raise HTTPException(status_code=400, detail="Signature 1 required: provide either file or path")
        
        if signature2 is not None:
            img2_input = await signature2.read()
        elif signature2_path is not None:
            if not os.path.exists(signature2_path):
                raise HTTPException(status_code=404, detail=f"Signature 2 path not found: {signature2_path}")
            img2_input = signature2_path
        else:
            raise HTTPException(status_code=400, detail="Signature 2 required: provide either file or path")
        
        result = compare_two_signatures(img1_input, img2_input)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# API ENDPOINTS - ENROLLMENT
# ============================================

@app.get("/api/enrolled-users")
async def get_enrolled_users_list(account_email: Optional[str] = None):
    """
    Get list of all enrolled users with their adaptive thresholds.
    
    Args:
        account_email: Optional query param to filter by account email
    """
    print(f"[DEBUG] get_enrolled_users_list called with account_email: {account_email}")
    
    users = get_enrolled_users(account_email)
    
    print(f"[DEBUG] Returning {len(users)} users")
    
    return {
        "users": users,
        "total_users": len(users)
    }

@app.get("/api/enrolled-users/{user_id}")
async def get_enrolled_user_details(user_id: str):
    """
    Get details for a specific enrolled user including their adaptive thresholds.
    """
    user_path = os.path.join(ENROLL_DIR, user_id.replace(" ", "_"))
    
    if not os.path.exists(user_path):
        raise HTTPException(status_code=404, detail=f"Enrolled user not found: {user_id}")
    
    users = get_enrolled_users()
    user = next((u for u in users if u["user_id"] == user_id.replace(" ", "_")), None)
    
    if not user:
        raise HTTPException(status_code=404, detail=f"Enrolled user not found: {user_id}")
    
    return user


@app.post("/api/enroll-user")
async def enroll_user(
    username: str = Form(...),
    signatures: List[UploadFile] = File(...),
    account_email: Optional[str] = Form(None)  # Added account_email parameter
):
    """
    Enroll a new user with their signatures.
    Requires minimum 5 signatures to compute reliable adaptive thresholds.
    
    Args:
        username: Name for the enrolled user
        signatures: List of signature image files (minimum 5)
        account_email: Optional email of the account enrolling this user
    
    Returns:
        Enrollment result with computed adaptive thresholds
    """
    print(f"[DEBUG] enroll_user called with account_email: {account_email}")
    
    if len(signatures) < 5:
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum 5 signatures required for enrollment. Received: {len(signatures)}"
        )
    
    # Sanitize username for folder name
    safe_username = username.strip().replace(" ", "_")
    user_folder = os.path.join(ENROLL_DIR, safe_username)
    
    if os.path.exists(user_folder):
        import shutil
        shutil.rmtree(user_folder)
    
    os.makedirs(user_folder, exist_ok=True)
    
    try:
        model = load_embedding_model()
        embeddings_list = []
        saved_files = []
        
        for i, sig_file in enumerate(signatures):
            # Read and save signature
            file_bytes = await sig_file.read()
            filename = f"signature_{i+1}_{sig_file.filename}"
            save_path = os.path.join(user_folder, filename)
            
            with open(save_path, "wb") as f:
                f.write(file_bytes)
            saved_files.append(filename)
            
            # Compute embedding
            processed = preprocess_signature_image(file_bytes)
            embedding = compute_embedding(processed, model)
            embeddings_list.append(embedding)
        
        # Stack embeddings and save
        embeddings_array = np.vstack(embeddings_list)
        np.save(os.path.join(user_folder, "embeddings.npy"), embeddings_array)
        
        # Compute and save adaptive thresholds
        adaptive_thresholds = compute_adaptive_thresholds(embeddings_array)
        with open(os.path.join(user_folder, "thresholds.json"), 'w') as f:
            json.dump(adaptive_thresholds, f, indent=2)
        
        if account_email:
            account_info = {
                "account_email": account_email,
                "enrolled_at": str(np.datetime64('now'))
            }
            with open(os.path.join(user_folder, "account_info.json"), 'w') as f:
                json.dump(account_info, f, indent=2)
        
        return {
            "success": True,
            "message": f"Successfully enrolled '{username}'",
            "user_id": safe_username,
            "signatures_saved": len(saved_files),
            "account_email": account_email,  # Return account_email in response
            "adaptive_thresholds": {
                "cosine": round(float(adaptive_thresholds["cosine"]), 4),
                "euclidean": round(float(adaptive_thresholds["euclidean"]), 4),
                "manhattan": round(float(adaptive_thresholds["manhattan"]), 4)
            }
        }
        
    except Exception as e:
        # Cleanup on failure
        import shutil
        if os.path.exists(user_folder):
            shutil.rmtree(user_folder)
        raise HTTPException(status_code=500, detail=f"Enrollment failed: {str(e)}")


@app.delete("/api/enrolled-users/{user_id}")
async def delete_enrolled_user(user_id: str):
    """
    Delete an enrolled user and their data.
    """
    import shutil
    user_path = os.path.join(ENROLL_DIR, user_id.replace(" ", "_"))
    
    if not os.path.exists(user_path):
        raise HTTPException(status_code=404, detail=f"Enrolled user not found: {user_id}")
    
    shutil.rmtree(user_path)
    return {"success": True, "message": f"Deleted enrolled user: {user_id}"}


@app.get("/api/thresholds")
async def get_thresholds(user_id: Optional[str] = None, user_type: Optional[str] = None):
    """
    Get current threshold values.
    
    Args:
        user_id: Optional user ID to get adaptive thresholds for
        user_type: 'enrolled' or 'test' - determines which thresholds to return
    
    Returns:
        Threshold values and type (default or adaptive)
    """
    if user_type == "enrolled" and user_id:
        # Try to get adaptive thresholds for enrolled user
        user_path = os.path.join(ENROLL_DIR, user_id.replace(" ", "_"))
        thresholds_path = os.path.join(user_path, "thresholds.json")
        
        if os.path.exists(thresholds_path):
            with open(thresholds_path, 'r') as f:
                adaptive = json.load(f)
            return {
                "thresholds": {
                    "cosine": round(float(adaptive["cosine"]), 4),
                    "euclidean": round(float(adaptive["euclidean"]), 4),
                    "manhattan": round(float(adaptive["manhattan"]), 4)
                },
                "type": "adaptive",
                "user_id": user_id
            }
    
    # Return default thresholds
    return {
        "thresholds": {
            "cosine": round(DEFAULT_THRESHOLDS["cosine_threshold"], 4),
            "euclidean": round(DEFAULT_THRESHOLDS["euclidean_threshold"], 4),
            "manhattan": round(DEFAULT_THRESHOLDS["manhattan_threshold"], 4)
        },
        "type": "default",
        "user_id": None
    }


@app.get("/api/enrolled-users/{user_id}/signature-image")
async def get_enrolled_signature_image(user_id: str, filename: str):
    """
    Serve a signature image from an enrolled user's folder.
    """
    user_path = os.path.join(ENROLL_DIR, user_id.replace(" ", "_"))
    file_path = os.path.join(user_path, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Image not found: {filename}")
    
    return FileResponse(file_path)


@app.post("/api/verify-enrolled")
async def verify_against_enrolled_user(
    signature: UploadFile = File(...),
    user_id: str = Form(...),
    reference_path: str = Form(None),
    use_default_threshold: str = Form("false")
):
    """
    Verify an uploaded signature against an enrolled user using adaptive thresholds.
    """
    try:
        print(f"[DEBUG] verify-enrolled called")
        print(f"[DEBUG] user_id: {user_id}")
        print(f"[DEBUG] reference_path: {reference_path}")
        print(f"[DEBUG] use_default_threshold: {use_default_threshold}")
        
        user_path = os.path.join(ENROLL_DIR, user_id.replace(" ", "_"))
        print(f"[DEBUG] user_path: {user_path}")
        print(f"[DEBUG] user_path exists: {os.path.exists(user_path)}")
        
        if not os.path.exists(user_path):
            raise HTTPException(status_code=404, detail=f"Enrolled user not found: {user_id}")
        
        img_bytes = await signature.read()
        print(f"[DEBUG] img_bytes length: {len(img_bytes)}")
        
        use_default = use_default_threshold.lower() in ("true", "1", "yes")
        print(f"[DEBUG] use_default parsed: {use_default}")
        
        actual_reference_path = None
        if reference_path:
            if os.path.exists(reference_path):
                actual_reference_path = reference_path
            else:
                potential_path = os.path.join(user_path, os.path.basename(reference_path))
                print(f"[DEBUG] potential_path: {potential_path}")
                print(f"[DEBUG] potential_path exists: {os.path.exists(potential_path)}")
                if os.path.exists(potential_path):
                    actual_reference_path = potential_path
        
        print(f"[DEBUG] actual_reference_path: {actual_reference_path}")
        print(f"[DEBUG] Calling verify_with_adaptive_threshold...")
        
        result = verify_with_adaptive_threshold(img_bytes, user_path, actual_reference_path, use_default)
        print(f"[DEBUG] result: {result}")
        
        result["user_id"] = user_id
        result["threshold_mode"] = "default" if use_default else "adaptive"
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[ERROR] verify-enrolled failed: {str(e)}")
        print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# EXISTING API ENDPOINTS (test users, compare, etc.)
# ============================================


# ============================================
# STARTUP EVENT
# ============================================

@app.on_event("startup")
async def startup_event():
    """Pre-load the model on startup."""
    print("Starting ForgeBlock Signature Verification API...")
    try:
        load_embedding_model()
    except Exception as e:
        print(f"⚠️ Warning: Could not preload model: {e}")

# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

# ============================================
# NEW FUNCTIONS
# ============================================

def get_test_users():
    """
    Get all test users from the testing dataset.
    Returns list of test users with their genuine signature counts.
    """
    users = []
    test_path = DATASET_PATHS["testing"]
    
    if not os.path.exists(test_path):
        return users
    
    for user_folder in sorted(os.listdir(test_path)):
        user_path = os.path.join(test_path, user_folder)
        if not os.path.isdir(user_path):
            continue
        
        genuine_path = os.path.join(user_path, "genuine")
        signatures = []
        
        if os.path.exists(genuine_path):
            for filename in sorted(os.listdir(genuine_path)):
                if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                    signatures.append({
                        "filename": filename,
                        "path": os.path.join(genuine_path, filename)
                    })
        
        if signatures:
            users.append({
                "user_id": user_folder,
                "display_name": user_folder.replace("_", " "),
                "genuine_count": len(signatures),
                "signatures": signatures
            })
    
    return users


def verify_against_user_signatures(uploaded_bytes, genuine_file_paths):
    """
    Verify an uploaded signature against multiple genuine signatures.
    Uses majority voting across all comparisons.
    
    Args:
        uploaded_bytes: Uploaded signature image bytes
        genuine_file_paths: List of paths to genuine signature files
    
    Returns:
        Verification result with averaged metrics
    """
    model = load_embedding_model()
    
    # Preprocess uploaded signature
    uploaded_processed = preprocess_signature_image(uploaded_bytes)
    uploaded_emb = compute_embedding(uploaded_processed, model)
    
    # Compare against all genuine signatures
    all_cos = []
    all_euc = []
    all_man = []
    
    for genuine_path in genuine_file_paths:
        genuine_processed = preprocess_signature_image(genuine_path)
        genuine_emb = compute_embedding(genuine_processed, model)
        
        cos_sim = float(1 - cosine(uploaded_emb, genuine_emb))
        euc_dist = float(euclidean(uploaded_emb, genuine_emb))
        man_dist = float(cityblock(uploaded_emb, genuine_emb))
        
        all_cos.append(cos_sim)
        all_euc.append(euc_dist)
        all_man.append(man_dist)
    
    # Average metrics across all comparisons
    avg_features = {
        "cosineSimilarity": round(float(np.mean(all_cos)), 4),
        "euclideanDistance": round(float(np.mean(all_euc)), 4),
        "manhattanDistance": round(float(np.mean(all_man)), 4)
    }
    
    match_percentage = compute_match_percentage(avg_features)
    verdict = determine_verdict(avg_features)
    
    return {
        "matchPercentage": float(match_percentage),
        "features": avg_features,
        "verdict": str(verdict),
        "comparisons_count": len(genuine_file_paths),
        "thresholds_used": {
            "cosine": float(THRESHOLDS["cosine_threshold"]),
            "euclidean": float(THRESHOLDS["euclidean_threshold"]),
            "manhattan": float(THRESHOLDS["manhattan_threshold"])
        },
        "threshold_type": "default"
    }
