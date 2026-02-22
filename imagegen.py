import asyncio
import os
import sys
from playwright.async_api import async_playwright

# Google Labs Whisk Project URL
WHISK_URL = "https://labs.google/fx/tools/whisk/project"

async def run():
    print("🚀 Starting Whisk Automation...")
    
    async with async_playwright() as p:
        try:
            # Connect to the existing Chrome instance
            # Ensure Chrome is running with --remote-debugging-port=9222
            print("🔌 Connecting to Chrome on port 9222...")
            browser = await p.chromium.connect_over_cdp("http://localhost:9222")
            context = browser.contexts[0]
            
            # Find the Whisk tab or open a new one
            page = None
            for p_page in context.pages:
                if "whisk" in p_page.url.lower(): # adjust if url is different
                   page = p_page
                   print(f"✅ Found existing Whisk tab: {page.url}")
                   break
            
            if not page:
                print("✨ Opening new Whisk tab...")
                page = await context.new_page()
                await page.goto(WHISK_URL)
            
            # Bring the page to front
            await page.bring_to_front()
            
            # Wait for the page to load 
            # (We might need to adjust this wait if there are specific elements to look for)
            try:
                await page.wait_for_load_state("networkidle", timeout=10000)
            except:
                print("⚠️  Page load timeout (networkidle), continuing anyway...")

            while True:
                # 1. Get User Prompt
                prompt_text = input("\n📝 Enter your image prompt (or 'exit' to quit): ").strip()
                if prompt_text.lower() in ['exit', 'quit']:
                    break
                
                if not prompt_text:
                    continue

                print(f"🤖 Automating prompt: '{prompt_text}'")

                # 2. Locate Input Area
                # We need to find the correct selector. Based on typical React apps:
                # Option A: Textarea with specific placeholder or aria-label
                # Option B: Contenteditable div
                
                print("🔍 Looking for input area...")
                
                # Attempt 1: Look for a textarea (most common for prompts)
                input_selector = "textarea" 
                
                # Try to find a specific one if multiple exist
                # You might need to inspect the page and update this selector
                # For now, let's try to find a textarea that looks like a prompt input
                try:
                     # Wait for any textarea to be visible
                    await page.wait_for_selector(input_selector, timeout=5000)
                    
                    # If multiple, maybe focus on the one that is visible and enabled
                    inputs = await page.query_selector_all(input_selector)
                    target_input = None
                    for inp in inputs:
                        is_visible = await inp.is_visible()
                        if is_visible:
                             target_input = inp
                             break
                    
                    if target_input:
                        await target_input.fill(prompt_text)
                        print("✅ Entered prompt.")
                    else:
                        print("❌ Could not find a visible textarea. Trying fallback...")
                        # Fallback: maybe it's a contenteditable div?
                        # await page.click("div[contenteditable='true']")
                        # await page.keyboard.type(prompt_text)

                except Exception as e:
                     print(f"❌ Error entering prompt: {e}")
                     continue

                # 3. Locate and Click 'Generate' Button
                print("🔍 Looking for 'Generate' button...")
                try:
                    # Look for button with text "Generate"
                    generate_btn = page.get_by_role("button", name="Generate", exact=False)
                    
                    if await generate_btn.count() > 0:
                        await generate_btn.first.click()
                        print("🚀 Clicked Generate!")
                    else:
                        print("❌ 'Generate' button not found via accessibility role. Trying exact text...")
                        # Fallback
                        await page.click("text=Generate")

                except Exception as e:
                     print(f"❌ Error clicking Generate: {e}")
                     continue

                # 4. Wait for Generation and Download
                print("⏳ Waiting for generation (approx 10-20s)...")
                # This is tricky without knowing the exact "loading" or "result" DOM.
                # Heuristic: Wait for an image to appear or change?
                # Or simply wait for a fixed time for now.
                
                # BETTER APPROACH: Wait for the download button or the resulting image to appear
                # For this v1, let's just wait a bit and attempt to finding a download button
                await asyncio.sleep(15) 

                print("📥 Attempting to download...")
                
                # Try to find a download button
                # Common icons might be svg paths or buttons with 'Download' label
                try:
                     download_btn = page.get_by_label("Download")
                     if await download_btn.count() > 0:
                         async with page.expect_download() as download_info:
                             await download_btn.first.click()
                         
                         download = await download_info.value
                         # Save to downloads folder
                         output_dir = "downloads"
                         os.makedirs(output_dir, exist_ok=True)
                         path = os.path.join(output_dir, download.suggested_filename)
                         await download.save_as(path)
                         print(f"✅ Saved image to: {path}")
                     else:
                         print("⚠️ Download button not found. You might need to save manually for now.")
                         
                except Exception as e:
                    print(f"❌ Error downloading: {e}")

        except Exception as main_e:
            print(f"\n❌ distinct Error: {main_e}")
            print("\nPlease ensure Chrome is running with: --remote-debugging-port=9222")

if __name__ == "__main__":
    asyncio.run(run())
