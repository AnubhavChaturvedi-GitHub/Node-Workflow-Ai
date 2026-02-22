from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import asyncio
from imagegen_module import generate_image
from videogen_module import generate_video
import os

# Fix for Playwright EPERM sandboxing issues on macOS
local_tmp = os.path.join(os.getcwd(), ".playwright_tmp")
os.makedirs(local_tmp, exist_ok=True)
os.environ["TMPDIR"] = local_tmp
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = local_tmp
from groq import AsyncGroq
from websocket_logger import manager, log_to_frontend

app = FastAPI()

os.makedirs(os.path.join(os.getcwd(), "downloads"), exist_ok=True)
app.mount("/downloads", StaticFiles(directory=os.path.join(os.getcwd(), "downloads")), name="downloads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

class PromptRequest(BaseModel):
    prompt: str

class VideoRequest(BaseModel):
    image_url: str

@app.post("/api/llm")
async def enhance_prompt(req: PromptRequest):
    # Retrieve the API key from environment variables
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY environment variable not set.")
        
    client = AsyncGroq(api_key=api_key)
    
    system_prompt = (
        "You are an expert prompt engineer for AI image generation models. "
        "Take the user's base idea and expand it into a highly detailed, cinematic, "
        "and visually descriptive prompt. Focus on lighting, camera angle, medium, and atmosphere. "
        "Return ONLY the expanded prompt string with no conversational filler."
    )
    
    try:
        await log_to_frontend("🧠 Starting LLM enhancement...", "info")
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_completion_tokens=1024,
            stream=True,
        )
        
        enhanced = ""
        async for chunk in response:
            if chunk.choices[0].delta.content:
                text_chunk = chunk.choices[0].delta.content
                enhanced += text_chunk
                await log_to_frontend(text_chunk, "llm_chunk")
                
        await log_to_frontend("\n✅ LLM enhancement complete.", "success")
        return {"enhanced_prompt": enhanced.strip()}
        
    except Exception as e:
        await log_to_frontend(f"❌ Groq API Error: {e}", "error")
        raise HTTPException(status_code=500, detail=f"Failed to expand prompt: {e}")

@app.post("/api/generate-image")
async def create_image(req: PromptRequest):
    # Uses the playright script
    try:
        await log_to_frontend(f"🎨 Received request to generate image: '{req.prompt}'", "info")
        image_path = await generate_image(req.prompt)
        if image_path:
            # Convert local path to URL
            filename = os.path.basename(image_path)
            url = f"http://localhost:8000/downloads/{filename}"
            await log_to_frontend(f"✅ Image generation pipeline complete: {url}", "success")
            return {"image_url": url, "status": "success"}
        else:
            await log_to_frontend("❌ Failed to generate image", "error")
            raise HTTPException(status_code=500, detail="Failed to generate image")
    except Exception as e:
        await log_to_frontend(f"❌ Image Error: {e}", "error")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-video")
async def create_video(req: VideoRequest):
    try:
        # Extract the local file path from the served URL
        filename = req.image_url.split('/')[-1]
        local_image_path = os.path.join(os.getcwd(), 'downloads', filename)
        
        await log_to_frontend(f"🎬 Received request to animate image: {filename}", "info")
        
        if not os.path.exists(local_image_path):
             await log_to_frontend(f"❌ Image file not found at {local_image_path}", "error")
             raise HTTPException(status_code=404, detail=f"Image file not found at {local_image_path}")
             
        # Call the Grok Playwright automation
        video_path = await generate_video(local_image_path)
        
        if video_path:
            # Convert local path to URL
            video_filename = os.path.basename(video_path)
            url = f"http://localhost:8000/downloads/{video_filename}"
            await log_to_frontend(f"✅ Video generation pipeline complete: {url}", "success")
            return {"video_url": url, "status": "success"}
        else:
             await log_to_frontend("❌ Failed to generate video via Grok", "error")
             raise HTTPException(status_code=500, detail="Failed to generate video via Grok")
             
    except Exception as e:
        await log_to_frontend(f"❌ Video Generation Error: {e}", "error")
        raise HTTPException(status_code=500, detail=str(e))
