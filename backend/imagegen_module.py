import asyncio
import os
from playwright.async_api import async_playwright
from websocket_logger import log_to_frontend

WHISK_URL = "https://labs.google/fx/tools/whisk/project"

async def generate_image(prompt_text: str) -> str:
    await log_to_frontend(f"🚀 Starting Whisk generation for prompt: {prompt_text}", "info")
    
    async with async_playwright() as p:
        try:
            await log_to_frontend("🔌 Connecting to Chrome on port 9222...", "info")
            try:
                browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
                context = browser.contexts[0]
            except Exception as cdp_err:
                await log_to_frontend(f"⚠️ Could not connect to port 9222: {cdp_err}. Launching standalone Chrome window...", "warning")
                user_data_dir = os.path.join(os.getcwd(), "whisk_chrome_data")
                os.makedirs(user_data_dir, exist_ok=True)
                
                # Use Playwright's bundled Chromium (avoids OS-level ProcessSingleton/Crashpad issues)
                context = await p.chromium.launch_persistent_context(
                    user_data_dir,
                    headless=False
                )
            
            page = None
            for p_page in context.pages:
                if "whisk" in p_page.url.lower():
                   page = p_page
                   await log_to_frontend(f"✅ Found existing Whisk tab: {page.url}", "success")
                   break
            
            if not page:
                await log_to_frontend("✨ Opening Whisk tab silently in background...", "info")
                page = await context.new_page()
                # Blur and move the window offscreen so it doesn't interrupt the user
                await page.add_init_script("""
                    window.moveTo(-2000, -2000);
                    window.blur();
                """)
                await page.goto(WHISK_URL)
                # Push the window offscreen after navigation too
                try:
                    await page.evaluate("window.moveTo(-2000, -2000); window.blur();")
                except:
                    pass
            
            try:
                await page.wait_for_load_state("networkidle", timeout=10000)
            except:
                pass

            input_selector = "textarea" 
            try:
                await page.wait_for_selector(input_selector, timeout=5000)
                inputs = await page.query_selector_all(input_selector)
                target_input = None
                for inp in inputs:
                    is_visible = await inp.is_visible()
                    if is_visible:
                         target_input = inp
                         break
                
                if target_input:
                    await target_input.fill(prompt_text)
                    await asyncio.sleep(0.5)
                    await target_input.press("Enter")
                    await log_to_frontend("📝 Filled text prompt and pressed Enter.", "info")
                else:
                    return None
            except Exception as e:
                 await log_to_frontend(f"❌ Error entering/submitting prompt: {e}", "error")
                 return None

            await log_to_frontend("⏳ Waiting 15s for visual generation...", "info")
            await asyncio.sleep(15) 

            try:
                images = await page.query_selector_all("img")
                valid_images = []
                for img in images:
                    src = await img.get_attribute("src")
                    if src and ("googleusercontent" in src or "blob" in src or "data:image" in src):
                        # Filter out tiny icons
                        bbox = await img.bounding_box()
                        if bbox and bbox['width'] > 200 and bbox['height'] > 200:
                            valid_images.append((img, src))
                
                if valid_images:
                    # Get the last/newest valid image added to the DOM
                    target_img, src = valid_images[-1]
                    await log_to_frontend(f"🖼️ Found generated image element.", "info")
                    
                    # Try to click it first to bring up any modals if needed, though we can just download the src
                    output_dir = os.path.join(os.getcwd(), "downloads")
                    os.makedirs(output_dir, exist_ok=True)
                    path = os.path.join(output_dir, f"whisk_gen_{int(asyncio.get_event_loop().time())}.png")
                    
                    if src.startswith('data:image'):
                        import base64
                        header, encoded = src.split(",", 1)
                        with open(path, "wb") as f:
                            f.write(base64.b64decode(encoded))
                    else:
                        # Grab the buffer directly via Playwright
                        img_buffer = await target_img.screenshot()
                        with open(path, "wb") as f:
                            f.write(img_buffer)
                            
                    await log_to_frontend(f"✅ Saved Whisk image to disk", "success")
                    await page.close()
                    return path
                else:
                    await log_to_frontend("⚠️ Could not locate generated image in DOM.", "warning")
                    await page.close()
                    return None
                    
            except Exception as e:
                await log_to_frontend(f"❌ Error extracting Whisk image: {e}", "error")
                await page.close()
                return None

        except Exception as e:
            await log_to_frontend(f"❌ Fatal Playwright Error: {e}", "error")
            return None
