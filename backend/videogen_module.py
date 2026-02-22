import asyncio
import os
from playwright.async_api import async_playwright
from websocket_logger import log_to_frontend

GROK_VIDEO_URL = "https://grok.com/"

async def generate_video(image_path: str, prompt_text: str = "") -> str:
    await log_to_frontend(f"🚀 Starting Grok Video generation...", "info")
    
    async with async_playwright() as p:
        try:
            await log_to_frontend("🔌 Connecting to Chrome on port 9222 for Grok...", "info")
            try:
                browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
                context = browser.contexts[0]
            except Exception as cdp_err:
                await log_to_frontend(f"⚠️ Could not connect to port 9222: {cdp_err}. Launching standalone Chrome window... Make sure to log in to Grok if prompted.", "warning")
                import os
                user_data_dir = os.path.join(os.getcwd(), "grok_chrome_data")
                os.makedirs(user_data_dir, exist_ok=True)
                # Use Playwright's bundled Chromium (avoids OS-level ProcessSingleton/Crashpad issues)
                context = await p.chromium.launch_persistent_context(
                    user_data_dir,
                    headless=False
                )
            
            page = None
            for p_page in context.pages:
                if "grok" in p_page.url.lower():
                   page = p_page
                   await log_to_frontend(f"✅ Found existing Grok tab.", "success")
                   break
            
            if not page:
                await log_to_frontend("✨ Opening new Grok background tab...", "info")
                page = await context.new_page()
                await page.add_init_script("window.blur();")
                await page.goto(GROK_VIDEO_URL)
            
            try:
                await page.wait_for_load_state("networkidle", timeout=10000)
            except:
                pass


            # 1. Upload Image
            await log_to_frontend("📎 Attempting to upload image to Grok...", "info")
            file_input_selector = 'input[type="file"]'
            
            try:
                await page.locator(file_input_selector).first.set_input_files(image_path)
                await log_to_frontend("✅ Image attached directly.", "success")
                await asyncio.sleep(2) # Wait for upload preview
            except Exception as e:
                await log_to_frontend(f"⚠️ Could not find standard file input... Error: {e}", "warning")
                
            # 2. Enter Prompt (Optional if Grok just animates based on image)
            if prompt_text:
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
                        await log_to_frontend("📝 Filled video prompt.", "info")
                    else:
                        await log_to_frontend("⚠️ Grok Textarea not found.", "warning")
                except Exception as e:
                     await log_to_frontend(f"Error entering Grok prompt: {e}", "error")

            # 3. Click Generate/Send
            try:
                generate_btn = page.get_by_role("button", name="Generate", exact=False)
                if await generate_btn.count() > 0:
                    await generate_btn.first.click()
                elif await page.get_by_label("Send message").count() > 0:
                    await page.get_by_label("Send message").first.click()
                else:
                    await page.keyboard.press("Enter")
                await log_to_frontend("🚀 Clicked Send to Grok.", "info")
            except Exception as e:
                 await log_to_frontend(f"Error clicking Generate on Grok: {e}", "error")
                 return None

            # 4. Wait for Video Generation
            await log_to_frontend("⏳ Waiting 30s for Grok video generation...", "info")
            # Video takes longer than images
            await asyncio.sleep(30) 

            # 5. Download Video
            try:
                 # Look for a download button or a video element
                 download_btn = page.get_by_label("Download")
                 if await download_btn.count() > 0:
                     async with page.expect_download() as download_info:
                         await download_btn.first.click()
                     
                     download = await download_info.value
                     output_dir = os.path.join(os.getcwd(), "downloads")
                     os.makedirs(output_dir, exist_ok=True)
                     # Ensure it has a video extension
                     filename = download.suggested_filename
                     if not filename.endswith(('.mp4', '.webm')):
                         filename += '.mp4'
                     path = os.path.join(output_dir, filename)
                     await download.save_as(path)
                     await log_to_frontend(f"✅ Saved Grok video to disk", "success")
                     await page.close()
                     return path
                 else:
                     video_src = await page.evaluate('''() => {
                         const v = document.querySelector('video');
                         return v ? v.src : null;
                     }''')
                     if video_src:
                         await log_to_frontend(f"⚠️ Found video source but no download button.", "warning")
                         await page.close()
                         return None
                     
                     await log_to_frontend("⚠️ Download button or Video element not found.", "warning")
                     await page.close()
                     return None
            except Exception as e:
                await log_to_frontend(f"Error downloading Grok Video: {e}", "error")
                if page: await page.close()
                return None

        except Exception as e:
            await log_to_frontend(f"❌ Fatal Grok Playwright Error: {e}", "error")
            return None
